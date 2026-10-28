'use client';
// La app entera en una pantalla de móvil: preparar el plan, ver el sitio justo y mandarlo al grupo.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlanForm from './PlanForm';
import Results from './Results';
import PersonSheet from './PersonSheet';
import VenueSheet from './VenueSheet';
import Loader from './Loader';
import { COLORS, MODE_TXT, Mark, ShareIcon, CopyIcon, planTxt } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import { api, listNames, load, nameOf, save, uid, wait, whenDate } from '@/lib/client';
import { encodeProposal } from '@/lib/share.js';
import type { Option, Person, Plan, Result, Sort, When } from '@/lib/types';

const newPerson = (): Person => ({ id: uid(), name: '', mode: 'TRANSIT', loc: null, label: '' });
type Saved = Omit<Person, 'id'>;

export default function Planner() {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<Person[]>(() => [newPerson(), newPerson()]);
  const [plan, setPlan] = useState<Plan>('canas');
  const [when, setWhen] = useState<When>({ kind: 'now' });
  const [view, setView] = useState<'plan' | 'results'>('plan');
  const [result, setResult] = useState<Result | null>(null);
  // Copia de quién venía y cómo en el momento de buscar: los resultados no cambian si luego editas.
  const [searched, setSearched] = useState<{ people: Person[]; plan: Plan; when: When } | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [sort, setSort] = useState<Sort>('justo');
  const [editing, setEditing] = useState<number | null>(null);
  const [venueOpen, setVenueOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');
  const [last, setLast] = useState<Saved[] | null>(null);

  useEffect(() => {
    // Enlaces antiguos (/#q=…) a la página nueva de propuestas.
    const m = window.location.hash.match(/^#q=([\w-]+)/);
    if (m) router.replace(`/p/${m[1]}`);
    const saved = load<Saved[] | null>('dq:ultimo', null);
    if (saved?.length && saved.every((p) => p.loc)) setLast(saved);
  }, [router]);

  useGSAP(() => {
    if (reduceMotion() || view !== 'plan') return;
    gsap.from('.plan-view .block, .plan-view .privacy', { y: 18, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.06, clearProps: 'transform,opacity' });
  }, { dependencies: [view], scope: root });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(''), 2600);
    return () => clearTimeout(t);
  }, [toast]);

  const updatePerson = (i: number, p: Person) => setPeople((ps) => ps.map((x, k) => (k === i ? p : x)));
  const removePerson = (i: number) => setPeople((ps) => ps.filter((_, k) => k !== i));
  const addPerson = () => {
    setPeople((ps) => [...ps, newPerson()]);
    setEditing(people.length);
  };
  const pristine = people.every((p) => !p.loc && !p.name.trim());
  const recall = last && pristine
    ? { names: listNames(last.map((p, i) => nameOf(p, i))), apply: () => setPeople(last.map((p) => ({ ...p, id: uid() }))) }
    : null;

  const missing = people.findIndex((p) => !p.loc);
  const missingCount = people.filter((p) => !p.loc).length;

  async function search() {
    if (missing >= 0) return setEditing(missing);
    setError('');
    setLoading(true);
    const started = performance.now();
    try {
      const at = whenDate(when);
      const r = await api<Result>('/api/search', {
        friends: people.map((p) => ({ mode: p.mode, loc: p.loc })), plan, when: at ? at.toISOString() : undefined,
      });
      await wait(Math.max(0, 900 - (performance.now() - started))); // que la animación llegue a leerse
      const best = [...r.options].sort((a, b) => a.justo.score - b.justo.score)[0];
      setSearched({ people, plan, when });
      setResult(r);
      setSelectedId(best.id);
      setSort('justo');
      setView('results');
      save('dq:ultimo', people.map(({ name, mode, loc, label }) => ({ name, mode, loc, label })));
      window.scrollTo({ top: 0 });
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const selected: Option | null = result ? result.options.find((o) => o.id === selectedId) ?? result.options[0] : null;

  function shareData(o: Option) {
    const s = searched!;
    const payload = {
      n: o.name, a: o.address, t: o.type, i: o.id, l: [o.loc.lat, o.loc.lng], pl: s.plan, w: result!.departureTime,
      p: o.times.map((t, i) => [nameOf(s.people[i], i), s.people[i].mode, t.min]),
    };
    const url = `${window.location.origin}/p/${encodeProposal(payload)}`;
    const lines = o.times.map((t, i) => `• ${nameOf(s.people[i], i)}: ${t.est ? '≈' : ''}${t.min} min ${MODE_TXT[s.people[i].mode]}`);
    const text = `📍 ¿Quedamos en ${o.name} para ${planTxt(s.plan)}?\n${o.address}\n\n⏱️ Lo que tarda cada uno:\n${lines.join('\n')}\n\nEs el sitio más justo para todos:`;
    return { url, text };
  }

  async function share() {
    if (!selected) return;
    const { url, text } = shareData(selected);
    if (navigator.share) {
      try { await navigator.share({ text, url }); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  }

  async function copy() {
    if (!selected) return;
    const { url, text } = shareData(selected);
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setToast('Copiado. Pégalo en el grupo.');
    } catch {
      setToast('No se ha podido copiar. Usa «Mandar al grupo».');
    }
  }

  const bias = people.find((p) => p.loc)?.loc ?? null;
  const showResults = view === 'results' && result && selected && searched;

  return (
    <div className="app" ref={root}>
      <header className={showResults ? 'top compact' : 'top'}>
        <Mark />
        <h1>¿Dónde quedamos?</h1>
        {!showResults && <p className="lede">El punto medio del mapa engaña. Buscamos el sitio donde <strong>todos tardáis lo mismo</strong>, cada uno con su transporte.</p>}
      </header>

      {showResults ? (
        <Results
          result={result} people={searched.people} plan={searched.plan} when={searched.when} selected={selected} sort={sort}
          onSelect={setSelectedId} onSort={setSort} onOpenVenue={() => setVenueOpen(true)}
          onEdit={() => { setView('plan'); window.scrollTo({ top: 0 }); }}
        />
      ) : (
        <PlanForm
          people={people} plan={plan} when={when} recall={recall}
          onOpenPerson={setEditing} onAddPerson={addPerson} onPlan={setPlan} onWhen={setWhen}
        />
      )}

      <footer className="foot">
        <p><strong>Fet a la terreta.</strong></p>
        <p>Tiempos y sitios de Google Maps. Mapa de OpenFreeMap y OpenStreetMap.</p>
      </footer>

      <div className="bar">
        <div className="bar-in">
          {showResults ? (
            <>
              <button type="button" className="cta" onClick={share}><ShareIcon />Mandar al grupo</button>
              <button type="button" className="icon-btn" onClick={copy} aria-label="Copiar el mensaje"><CopyIcon /></button>
            </>
          ) : (
            <button type="button" className={missing >= 0 ? 'cta pending' : 'cta'} onClick={search} disabled={loading}>
              {missing < 0
                ? 'Buscar el sitio justo'
                : missingCount > 1
                  ? `Faltan ${missingCount} salidas`
                  : `Falta desde dónde ${missing === 0 ? 'sales' : `sale ${nameOf(people[missing], missing)}`}`}
            </button>
          )}
        </div>
        {error && !showResults && <p className="bar-error" role="alert">{error}</p>}
      </div>

      {editing != null && people[editing] && (
        <PersonSheet
          key={people[editing].id}
          person={people[editing]} index={editing} color={COLORS[editing]} canRemove={people.length > 2} bias={bias}
          onChange={(p) => updatePerson(editing, p)} onRemove={() => removePerson(editing)} onClose={() => setEditing(null)}
        />
      )}
      {venueOpen && selected && (
        <VenueSheet option={selected} isSelected onChoose={() => setSelectedId(selected.id)} onClose={() => setVenueOpen(false)} />
      )}
      {loading && <Loader />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

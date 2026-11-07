'use client';
// La app entera en una pantalla de móvil: preparar el plan, ver el sitio justo y mandarlo al grupo.
import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import PlanForm from './PlanForm';
import Results from './Results';
import PersonSheet from './PersonSheet';
import TripSheet from './TripSheet';
import VenueSheet from './VenueSheet';
import Loader from './Loader';
import { COLORS, MODE_LABEL, MODE_TXT, Mark, ShareIcon, CopyIcon, SponsorLink, SPONSORS_URL, planTxt } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import { api, isQuota, listNames, load, nameOf, save, uid, wait, whenDate } from '@/lib/client';
import { track } from './Analytics';
import { encodeProposal } from '@/lib/share.js';
import { routeForLink, routeForSharedLink } from '@/lib/polyline.js';
import { routeFor, routeIfReady } from '@/lib/routes';
import { DEFAULT_MODES } from '@/lib/core.js';
import type { Mode, Option, Person, Plan, Result, Sort, Trip, When } from '@/lib/types';

const newPerson = (): Person => ({ id: uid(), name: '', modes: [...DEFAULT_MODES] as Mode[], loc: null, label: '' });
type Saved = Omit<Person, 'id'>;
// Lo guardado antes de poder marcar varios transportes traía uno solo: andar, más el que eligió.
const upgrade = (p: Saved & { mode?: Mode }): Saved => ({
  name: p.name, loc: p.loc, label: p.label,
  modes: p.modes?.length ? p.modes : p.mode ? (['WALK', ...(p.mode === 'WALK' ? [] : [p.mode])] as Mode[]) : ([...DEFAULT_MODES] as Mode[]),
});

// freeRouting: si los tiempos pueden venir de OpenStreetMap (OSRM/OpenTripPlanner), para citarlo.
export default function Planner({ freeRouting = false }: { freeRouting?: boolean }) {
  const router = useRouter();
  const root = useRef<HTMLDivElement>(null);
  const [people, setPeople] = useState<Person[]>(() => [newPerson(), newPerson()]);
  const [plan, setPlan] = useState<Plan>('canas');
  const [when, setWhen] = useState<When>({ kind: 'now' });
  // «Ya tenemos destino»: adónde vais y en qué seguís juntos desde el punto de encuentro.
  const [trip, setTrip] = useState<Trip>({ on: false, loc: null, label: '', mode: 'DRIVE' });
  const [tripOpen, setTripOpen] = useState(false);
  const [view, setView] = useState<'plan' | 'results'>('plan');
  const [result, setResult] = useState<Result | null>(null);
  // Copia de quién venía y cómo en el momento de buscar: los resultados no cambian si luego editas.
  const [searched, setSearched] = useState<{ people: Person[]; plan: Plan; when: When; trip: Trip | null } | null>(null);
  const [selectedId, setSelectedId] = useState('');
  const [sort, setSort] = useState<Sort>('justo');
  const [editing, setEditing] = useState<number | null>(null);
  const [venueOpen, setVenueOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ text: string; quota: boolean } | null>(null);
  const [toast, setToast] = useState('');
  const [last, setLast] = useState<Saved[] | null>(null);

  useEffect(() => {
    // Enlaces antiguos (/#q=…) a la página nueva de propuestas.
    const m = window.location.hash.match(/^#q=([\w-]+)/);
    if (m) router.replace(`/p/${m[1]}`);
    const saved = load<Saved[] | null>('dq:ultimo', null);
    if (saved?.length && saved.every((p) => p.loc)) setLast(saved.map(upgrade));
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
  const noDest = trip.on && !trip.loc;
  const noDriver = trip.on && trip.mode === 'DRIVE' && !people.some((p) => p.modes.includes('DRIVE'));

  async function search() {
    if (missing >= 0) return setEditing(missing);
    if (noDest) return setTripOpen(true);
    if (noDriver) return setEditing(0);
    setError(null);
    setLoading(true);
    const started = performance.now();
    try {
      const at = whenDate(when);
      const going = trip.on && trip.loc ? { to: trip.loc, together: trip.mode } : {};
      const r = await api<Result>('/api/search', {
        friends: people.map((p) => ({ modes: p.modes, loc: p.loc })), plan, when: at ? at.toISOString() : undefined, ...going,
      });
      await wait(Math.max(0, 900 - (performance.now() - started))); // que la animación llegue a leerse
      const best = [...r.options].sort((a, b) => a.justo.score - b.justo.score)[0];
      setSearched({ people, plan, when, trip: trip.on ? trip : null });
      setResult(r);
      setSelectedId(best.id);
      setSort('justo');
      setView('results');
      save('dq:ultimo', people.map(({ name, modes, loc, label }) => ({ name, modes, loc, label })));
      window.scrollTo({ top: 0 });
      track('Búsqueda', {
        plan: trip.on ? `destino (${MODE_LABEL[trip.mode]})` : plan, personas: people.length,
        hora: when.kind === 'now' ? 'ahora' : 'más tarde', estimada: r.options.some((o) => o.times.some((t) => t.est)),
      });
    } catch (e) {
      // Sin cupo gratis no es un fallo: la app es gratis y Google Maps cobra cada búsqueda.
      if (isQuota(e) && e.reason === 'cap') setError({ text: `Por hoy se han acabado las búsquedas gratis. Vuelven a las ${e.resetText}.`, quota: true });
      else setError({ text: (e as Error).message, quota: false });
      track('Búsqueda fallida', { motivo: isQuota(e) ? (e.reason === 'cap' ? 'sin cupo' : 'no disponible') : 'error' });
    } finally {
      setLoading(false);
    }
  }

  const selected: Option | null = result ? result.options.find((o) => o.id === selectedId) ?? result.options[0] : null;

  // El enlace corto se pide en cuanto te quedas en un sitio, no al pulsar: así el menú de compartir del
  // móvil se abre al instante (Safari lo bloquea si antes hay que esperar a la red).
  const shortIds = useRef(new Map<string, string>());
  useEffect(() => {
    if (!selected || !searched || !result) return;
    let live = true;
    const t = setTimeout(async () => {
      // Que el enlace lleve las rutas de todos: se esperan (4 s como mucho) antes de pedirlo.
      const all = searched.people.map((p, i) => (p.loc ? routeFor(p.loc, selected.times[i].mode, selected.loc, result.departureTime) : null));
      const dest = searched.trip?.loc;
      if (dest && selected.shared?.min) all.push(routeFor(selected.loc, selected.shared.mode, dest, result.departureTime));
      await Promise.race([Promise.all(all), wait(4000)]);
      if (!live) return;
      const long = new URL(shareData(selected).url).pathname.slice(3);
      if (shortIds.current.has(long) || long.length <= 8) return;
      fetch('/api/share', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ d: long }) })
        .then((r) => (r.ok ? r.json() : null)).then((d) => d?.id && shortIds.current.set(long, d.id)).catch(() => {});
    }, 700);
    return () => { live = false; clearTimeout(t); };
  }, [selected?.id, searched]); // eslint-free: shareData solo lee estado ya incluido aquí

  function shareData(o: Option) {
    const s = searched!;
    // La ruta de cada uno que ya haya llegado, sin sus primeros metros: el enlace no lleva direcciones.
    const routes = s.people.map((p, i) => {
      const r = p.loc ? routeIfReady(p.loc, o.times[i].mode, o.loc) : null;
      return r ? routeForLink(r) : '';
    });
    // Con destino, el enlace lleva también adónde vais y el trayecto juntos (desde un sitio público).
    const t = s.trip?.loc && o.shared ? { ...o.shared, to: s.trip.loc, label: s.trip.label } : null;
    const together = t ? routeIfReady(o.loc, t.mode, t.to) : null;
    const payload = {
      n: o.name, a: o.address, t: o.type, i: o.id, l: [o.loc.lat, o.loc.lng], pl: t ? null : s.plan, w: result!.departureTime,
      p: o.times.map((x, i) => [nameOf(s.people[i], i), x.mode, x.min]), r: routes,
      d: t ? [t.label, t.to.lat, t.to.lng, t.mode, t.min, together ? routeForSharedLink(together) : ''] : null,
    };
    const long = encodeProposal(payload);
    const url = `${window.location.origin}/p/${shortIds.current.get(long) || long}`;
    const lines = o.times.map((x, i) => `• ${nameOf(s.people[i], i)}: ${x.est ? '≈' : ''}${x.min} min ${MODE_TXT[x.mode]}`);
    const text = t
      ? (t.min
        ? `📍 ¿Quedamos en ${o.name} para ir juntos a ${t.label}?\n${o.address}\n\n⏱️ Lo que tarda cada uno hasta aquí:\n${lines.join('\n')}\n\n➡️ Y desde aquí, ${t.est ? '≈' : ''}${t.min} min juntos ${MODE_TXT[t.mode]} hasta ${t.label}. Es el punto de encuentro más justo:`
        : `📍 ¿Quedamos directamente en ${t.label}?\n${o.name}, ${o.address}\n\n⏱️ Lo que tarda cada uno:\n${lines.join('\n')}\n\nOs pilla de camino: no hace falta quedar antes.`)
      : `📍 ¿Quedamos en ${o.name} para ${planTxt(s.plan)}?\n${o.address}\n\n⏱️ Lo que tarda cada uno:\n${lines.join('\n')}\n\nEs el sitio más justo para todos:`;
    return { url, text };
  }

  async function share() {
    if (!selected) return;
    const { url, text } = shareData(selected);
    if (navigator.share) {
      try { await navigator.share({ text, url }); track('Mandar al grupo', { via: 'menú del móvil' }); return; }
      catch (e) { if ((e as Error).name === 'AbortError') return; }
    }
    track('Mandar al grupo', { via: 'WhatsApp' });
    window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank', 'noopener');
  }

  async function copy() {
    if (!selected) return;
    const { url, text } = shareData(selected);
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setToast('Copiado. Pégalo en el grupo.');
      track('Mandar al grupo', { via: 'copiar' });
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
          result={result} people={searched.people} plan={searched.plan} when={searched.when} trip={searched.trip} selected={selected} sort={sort}
          onSelect={setSelectedId} onSort={setSort} onOpenVenue={() => setVenueOpen(true)}
          onEdit={() => { setView('plan'); window.scrollTo({ top: 0 }); }}
        />
      ) : (
        <PlanForm
          people={people} plan={plan} when={when} trip={trip} recall={recall}
          onOpenPerson={setEditing} onOpenTrip={() => setTripOpen(true)} onTrip={setTrip} onAddPerson={addPerson} onPlan={setPlan} onWhen={setWhen}
        />
      )}

      <footer className="foot">
        <SponsorLink />
        <p><strong>Fet a la terreta.</strong></p>
        <p>
          {freeRouting
            ? 'Sitios de Google Maps. Tiempos de Google Maps y de OSRM y OpenTripPlanner con datos de OpenStreetMap.'
            : 'Tiempos y sitios de Google Maps.'}{' '}
          Mapa de OpenFreeMap y OpenStreetMap.
        </p>
      </footer>

      <div className="bar">
        <div className="bar-in">
          {showResults ? (
            <>
              <button type="button" className="cta" onClick={share}><ShareIcon />Mandar al grupo</button>
              <button type="button" className="icon-btn" onClick={copy} aria-label="Copiar el mensaje"><CopyIcon /></button>
            </>
          ) : (
            <button type="button" className={missing >= 0 || noDest || noDriver ? 'cta pending' : 'cta'} onClick={search} disabled={loading}>
              {missing >= 0
                ? missingCount > 1
                  ? `Faltan ${missingCount} salidas`
                  : `Falta desde dónde ${missing === 0 ? 'sales' : `sale ${nameOf(people[missing], missing)}`}`
                : noDest
                  ? 'Falta adónde vais'
                  : noDriver
                    ? 'Falta quién lleva el coche'
                    : trip.on ? 'Buscar dónde quedar' : 'Buscar el sitio justo'}
            </button>
          )}
        </div>
        {error && !showResults && (
          <p className={error.quota ? 'bar-error quota' : 'bar-error'} role="alert">
            {error.text}
            {error.quota && <> Cada búsqueda cuesta dinero en Google Maps: si quieres que haya más, <a href={SPONSORS_URL} target="_blank" rel="noopener noreferrer">apoya el proyecto</a>.</>}
          </p>
        )}
      </div>

      {editing != null && people[editing] && (
        <PersonSheet
          key={people[editing].id}
          person={people[editing]} index={editing} color={COLORS[editing]} canRemove={people.length > 2} bias={bias}
          onChange={(p) => updatePerson(editing, p)} onRemove={() => removePerson(editing)} onClose={() => setEditing(null)}
        />
      )}
      {tripOpen && (
        <TripSheet trip={trip} bias={bias} onChange={setTrip} onClose={() => setTripOpen(false)} />
      )}
      {venueOpen && selected && (
        <VenueSheet option={selected} isSelected onChoose={() => setSelectedId(selected.id)} onClose={() => setVenueOpen(false)} />
      )}
      {loading && <Loader />}
      {toast && <div className="toast" role="status">{toast}</div>}
    </div>
  );
}

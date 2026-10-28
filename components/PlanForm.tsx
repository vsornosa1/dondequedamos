'use client';
// La primera pantalla: quién viene (cada uno es una línea), qué plan y cuándo.
import { useRef, type CSSProperties } from 'react';
import { COLORS, PLANS, ModeIcon, PlanIcon, MODE_LABEL } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import { dayLabel, defaultLater, hhmm, initialOf, nameOf, whenText } from '@/lib/client';
import type { Person, Plan, When } from '@/lib/types';

type Props = {
  people: Person[];
  plan: Plan;
  when: When;
  recall: { names: string; apply: () => void } | null;
  onOpenPerson: (i: number) => void;
  onAddPerson: () => void;
  onPlan: (p: Plan) => void;
  onWhen: (w: When) => void;
};

export default function PlanForm({ people, plan, when, recall, onOpenPerson, onAddPerson, onPlan, onWhen }: Props) {
  return (
    <div className="view plan-view">
      <section className="block" aria-labelledby="h-who">
        <h2 id="h-who">Quién viene y desde dónde</h2>
        <People people={people} onOpen={onOpenPerson} />
        {people.length < 8 && (
          <button type="button" className="add-person" onClick={onAddPerson}>
            <span aria-hidden="true">+</span>Añadir a alguien
          </button>
        )}
        {recall && (
          <button type="button" className="recall" onClick={recall.apply}>
            Repetir con {recall.names}
          </button>
        )}
      </section>

      <section className="block" aria-labelledby="h-plan">
        <h2 id="h-plan">Qué plan</h2>
        <Plans plan={plan} onPlan={onPlan} />
      </section>

      <section className="block" aria-labelledby="h-when">
        <h2 id="h-when">Cuándo</h2>
        <WhenPicker when={when} onWhen={onWhen} />
      </section>

      <p className="privacy">No guardamos ninguna dirección. Se usan para calcular y se olvidan.</p>
    </div>
  );
}

function People({ people, onOpen }: { people: Person[]; onOpen: (i: number) => void }) {
  const list = useRef<HTMLOListElement>(null);
  const count = useRef(people.length);
  // Quien se añade entra en la lista como una línea nueva que se dibuja.
  useGSAP(() => {
    const added = people.length > count.current;
    count.current = people.length;
    if (!added || reduceMotion()) return;
    const row = list.current?.lastElementChild;
    if (row) gsap.from(row, { height: 0, opacity: 0, duration: 0.4, ease: 'power3.out', clearProps: 'height,opacity' });
  }, { dependencies: [people.length], scope: list });

  return (
    <ol className="people" ref={list}>
      {people.map((p, i) => (
        <li key={p.id} className="person" style={{ '--c': COLORS[i] } as CSSProperties}>
          <button type="button" className="person-btn" onClick={() => onOpen(i)}>
            <span className="stop" aria-hidden="true">{initialOf(p, i)}</span>
            <span className="person-main">
              <span className="person-name">{nameOf(p, i)}</span>
              <span className={p.loc ? 'person-where' : 'person-where missing'}>
                {p.loc ? p.label : i === 0 ? '¿Desde dónde sales?' : '¿Desde dónde sale?'}
              </span>
            </span>
            <span className="person-mode" title={MODE_LABEL[p.mode]}>
              <ModeIcon mode={p.mode} />
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

function Plans({ plan, onPlan }: { plan: Plan; onPlan: (p: Plan) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const { contextSafe } = useGSAP({ scope: box });
  const choose = contextSafe((p: Plan, el: HTMLElement) => {
    onPlan(p);
    if (!reduceMotion()) gsap.fromTo(el.querySelector('svg'), { scale: 0.6, rotate: -14 }, { scale: 1, rotate: 0, duration: 0.5, ease: 'back.out(3)' });
  });
  return (
    <div className="plans" role="radiogroup" aria-labelledby="h-plan" ref={box}>
      {PLANS.map((p) => (
        <button key={p.id} type="button" role="radio" aria-checked={plan === p.id} onClick={(e) => choose(p.id, e.currentTarget)}>
          <PlanIcon plan={p.id} />
          <span>{p.label}</span>
        </button>
      ))}
    </div>
  );
}

const DAYS = Array.from({ length: 7 }, (_, i) => i);
const SLOTS = Array.from({ length: (26 * 60 - 8 * 60) / 30 + 1 }, (_, k) => 8 * 60 + k * 30); // de 08:00 a 02:00

function WhenPicker({ when, onWhen }: { when: When; onWhen: (w: When) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const times = useRef<HTMLDivElement>(null);
  const later = when.kind === 'later' ? when : null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();

  useGSAP(() => {
    if (!later) return;
    if (!reduceMotion()) gsap.from('.when-later', { height: 0, opacity: 0, duration: 0.45, ease: 'power3.out', clearProps: 'height,opacity' });
  }, { dependencies: [!!later], scope: box });

  // Al abrir o cambiar de día, la hora elegida queda a la vista.
  useGSAP(() => {
    const strip = times.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (strip && chip) strip.scrollLeft = chip.offsetLeft - strip.clientWidth / 2 + chip.clientWidth / 2;
  }, { dependencies: [later?.day, !!later] });

  const setDay = (day: number) => {
    if (!later) return;
    const firstFree = SLOTS.find((m) => m > nowMin + 15) ?? 20 * 60;
    onWhen({ kind: 'later', day, minutes: day === 0 && later.minutes <= nowMin + 15 ? firstFree : later.minutes });
  };

  return (
    <div className="when" ref={box}>
      <div className="seg2" role="radiogroup" aria-label="Cuándo">
        <button type="button" role="radio" aria-checked={!later} onClick={() => onWhen({ kind: 'now' })}>Ahora</button>
        <button type="button" role="radio" aria-checked={!!later} onClick={() => !later && onWhen(defaultLater())}>Más tarde</button>
      </div>
      {later && (
        <div className="when-later">
          <div className="hstrip" role="radiogroup" aria-label="Día">
            {DAYS.map((d) => (
              <button key={d} type="button" role="radio" className="day" aria-checked={later.day === d} onClick={() => setDay(d)}>
                {dayLabel(d)}
              </button>
            ))}
          </div>
          <div className="hstrip" role="radiogroup" aria-label="Hora" ref={times}>
            {SLOTS.map((m) => {
              const past = later.day === 0 && m <= nowMin + 15;
              return (
                <button
                  key={m} type="button" role="radio" className="slot" aria-checked={later.minutes === m} disabled={past}
                  onClick={() => onWhen({ ...later, minutes: m })}
                >
                  {hhmm(m)}
                  {m >= 24 * 60 && <small>madrugada</small>}
                </button>
              );
            })}
          </div>
          <p className="when-sum">Calculamos con el transporte y el tráfico de {whenText(when)}.</p>
        </div>
      )}
      {!later && <p className="hint">El metro de un domingo no es el de un martes a las 9: usamos los horarios y el tráfico del momento.</p>}
    </div>
  );
}

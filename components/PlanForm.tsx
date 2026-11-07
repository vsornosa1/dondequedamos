'use client';
// La primera pantalla: quién viene (cada uno es una línea), qué plan y cuándo.
import { Fragment, useRef, type CSSProperties } from 'react';
import { COLORS, PLANS, ClockIcon, FlagIcon, ModeIcon, PlanIcon, MODE_LABEL } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import { dayParts, defaultLater, hhmm, initialOf, nameOf, whenText } from '@/lib/client';
import type { Mode, Person, Plan, Trip, When } from '@/lib/types';

type Props = {
  people: Person[];
  plan: Plan;
  when: When;
  trip: Trip;
  recall: { names: string; apply: () => void } | null;
  onOpenPerson: (i: number) => void;
  onOpenTrip: () => void;
  onTrip: (t: Trip) => void;
  onAddPerson: () => void;
  onPlan: (p: Plan) => void;
  onWhen: (w: When) => void;
};

export default function PlanForm({ people, plan, when, trip, recall, onOpenPerson, onOpenTrip, onTrip, onAddPerson, onPlan, onWhen }: Props) {
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
        <h2 id="h-plan">{trip.on ? 'Adónde vais' : 'Qué plan'}</h2>
        {/* O buscamos el sitio, o ya lo tenéis y buscamos dónde quedar antes para ir juntos. */}
        <div className="seg2 goal" role="radiogroup" aria-label="Qué buscáis">
          <button type="button" role="radio" aria-checked={!trip.on} onClick={() => onTrip({ ...trip, on: false })}>Buscar sitio</button>
          <button
            type="button" role="radio" aria-checked={trip.on}
            onClick={() => { if (trip.on) return; onTrip({ ...trip, on: true }); if (!trip.loc) onOpenTrip(); }}
          >
            Ya tenemos destino
          </button>
        </div>
        {trip.on ? (
          <TripPicker trip={trip} people={people} onOpen={onOpenTrip} onTrip={onTrip} />
        ) : (
          <>
            <Plans plan={plan} onPlan={onPlan} />
            {plan === 'canas' && people.some((p) => p.modes.includes('DRIVE')) && (
              <p className="hint plan-note">Con cañas no contamos el coche: quien lo tenga irá a pie, en bici o en bus o metro.</p>
            )}
          </>
        )}
      </section>

      <section className="block" aria-labelledby="h-when">
        <h2 id="h-when">Cuándo</h2>
        <WhenPicker when={when} onWhen={onWhen} />
      </section>

      <p className="privacy">No guardamos ninguna dirección. Se usan para calcular y se olvidan. Contamos visitas sin cookies y sin datos personales.</p>
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
            <span className={p.modes.length > 1 ? 'person-mode many' : 'person-mode'} title={p.modes.map((m) => MODE_LABEL[m]).join(', ')}>
              {p.modes.map((m) => <ModeIcon key={m} mode={m} />)}
            </span>
          </button>
        </li>
      ))}
    </ol>
  );
}

// Cómo seguís juntos desde el punto de encuentro: de lo más habitual (compartir coche) a lo menos.
const TOGETHER: Mode[] = ['DRIVE', 'TRANSIT', 'BICYCLE', 'WALK'];

function TripPicker({ trip, people, onOpen, onTrip }: { trip: Trip; people: Person[]; onOpen: () => void; onTrip: (t: Trip) => void }) {
  const drivers = people.some((p) => p.modes.includes('DRIVE'));
  const note = {
    DRIVE: drivers
      ? 'Quien tiene coche lo lleva hasta el punto de encuentro y desde allí vais juntos. Quedáis en una gasolinera o un aparcamiento.'
      : null,
    TRANSIT: 'Quedáis en una estación y desde allí seguís juntos en bus, metro o tren.',
    BICYCLE: 'Quien tiene bici la lleva hasta el punto de encuentro. Quedáis en una cafetería.',
    WALK: 'Quedáis en una cafetería y desde allí seguís juntos andando.',
  }[trip.mode];
  return (
    <div className="trip">
      <button type="button" className={trip.loc ? 'dest-btn' : 'dest-btn missing'} onClick={onOpen}>
        <span className="stop dest" aria-hidden="true"><FlagIcon /></span>
        <span className="person-main">
          <span className="person-name">{trip.loc ? trip.label : '¿Adónde vais?'}</span>
          <span className={trip.loc ? 'person-where' : 'person-where missing'}>{trip.loc ? 'Destino. Toca para cambiarlo' : 'El pueblo o el sitio al que vais'}</span>
        </span>
      </button>
      <p className="ps-label" id="h-together">Desde el punto de encuentro, vais juntos</p>
      <div className="plans four" role="radiogroup" aria-labelledby="h-together">
        {TOGETHER.map((m) => (
          <button key={m} type="button" role="radio" aria-checked={trip.mode === m} onClick={() => onTrip({ ...trip, mode: m })}>
            <ModeIcon mode={m} />
            <span>{MODE_LABEL[m]}</span>
          </button>
        ))}
      </div>
      {note
        ? <p className="hint plan-note">{note}</p>
        : <p className="hint plan-note warn">Para ir juntos en coche, alguien tiene que llevarlo: marca «Coche» a quien lo tenga.</p>}
    </div>
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
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function WhenPicker({ when, onWhen }: { when: When; onWhen: (w: When) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const times = useRef<HTMLDivElement>(null);
  const later = when.kind === 'later' ? when : null;
  const now = new Date();
  const nowMin = now.getHours() * 60 + now.getMinutes();
  // Para hoy solo se ofrecen las horas que aún no han pasado.
  const slots = later?.day === 0 ? SLOTS.filter((m) => m > nowMin + 15) : SLOTS;

  // Se recorta solo mientras se despliega; después las filas llegan hasta el borde de la tarjeta.
  useGSAP(() => {
    if (!later || reduceMotion()) return;
    gsap.fromTo('.when-later', { height: 0, opacity: 0, overflow: 'hidden' }, { height: 'auto', opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'height,opacity,overflow' });
  }, { dependencies: [!!later], scope: box });

  // Al abrir o cambiar de día, la hora elegida queda en el centro.
  useGSAP(() => {
    const strip = times.current;
    const chip = strip?.querySelector<HTMLElement>('[aria-checked="true"]');
    if (strip && chip) strip.scrollLeft = chip.offsetLeft - (strip.clientWidth - chip.clientWidth) / 2;
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
            {DAYS.map((d) => {
              const { name, num } = dayParts(d);
              return (
                <button key={d} type="button" role="radio" className="day" aria-checked={later.day === d} onClick={() => setDay(d)}>
                  <span className="day-name">{name}</span>
                  <span className="day-num">{num}</span>
                </button>
              );
            })}
          </div>
          <div className="hstrip" role="radiogroup" aria-label="Hora" ref={times}>
            {slots.map((m) => (
              <Fragment key={m}>
                {m === 24 * 60 && <span className="strip-sep" aria-hidden="true">madrugada</span>}
                <button
                  type="button" role="radio" className="slot" aria-checked={later.minutes === m}
                  aria-label={m >= 24 * 60 ? `${hhmm(m)} de madrugada` : undefined}
                  onClick={() => onWhen({ ...later, minutes: m })}
                >
                  {hhmm(m)}
                </button>
              </Fragment>
            ))}
          </div>
          <p className="when-sum">
            <ClockIcon />
            <span><b>{cap(whenText(when))}</b>Con el transporte y el tráfico de esa hora.</span>
          </p>
        </div>
      )}
      {!later && <p className="hint">El metro de un domingo no es el de un martes a las 9: usamos los horarios del momento.</p>}
    </div>
  );
}

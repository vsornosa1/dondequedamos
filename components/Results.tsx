'use client';
// Segunda pantalla: el cartel del sitio, el diagrama de líneas, el resto de opciones y el mapa.
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Sign from './Sign';
import Diagram from './Diagram';
import Directions from './Directions';
import OptionsCarousel from './OptionsCarousel';
import { BackIcon, COLORS, MODE_TXT, planTxt } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import { nameOf, whenText } from '@/lib/client';
import type { Option, Person, Plan, Result, Sort, Trip, When } from '@/lib/types';

const MeetMap = dynamic(() => import('./MeetMap'), { ssr: false, loading: () => <div className="map" /> });

type Props = {
  result: Result;
  people: Person[];
  plan: Plan;
  when: When;
  trip: Trip | null; // con destino: adónde vais (los tiempos de cada uno son hasta el punto de encuentro)
  selected: Option;
  sort: Sort;
  onSelect: (id: string) => void;
  onSort: (s: Sort) => void;
  onEdit: () => void;
  onOpenVenue: () => void;
};

export default function Results({ result, people, plan, when, trip, selected, sort, onSelect, onSort, onEdit, onOpenVenue }: Props) {
  // Con destino, el círculo de cada uno es lo que tardaría yendo solo y el eje mide hasta el destino.
  const going = trip?.loc && result.trip ? { ...result.trip, label: trip.label } : null;
  const ghosts = going ? going.direct : result.midpoint.times;
  const root = useRef<HTMLDivElement>(null);
  const options = useMemo(() => {
    const list = [...result.options].sort((a, b) => a[sort].score - b[sort].score).slice(0, 5);
    return list.some((o) => o.id === selected.id) ? list : [...list, selected];
  }, [result, sort, selected]);

  // La escala del diagrama no cambia al pasar de un sitio a otro: solo se mueven las líneas.
  const scaleMax = useMemo(
    () => Math.max(...ghosts.map((t) => t.min), ...result.options.flatMap((o) => o.times.map((t) => t.min + (o.shared?.min ?? 0)))),
    [result, ghosts],
  );
  const lines = useMemo(() => selected.times.map((t, i) => ({
    name: nameOf(people[i], i), mode: t.mode, min: t.min, est: t.est,
    ghost: ghosts[i]?.min ?? null, color: COLORS[i],
  })), [selected, people, ghosts]);

  // La foto espera a que dejes de pasar tarjetas: no se piden fotos de sitios por los que solo pasas.
  const [photo, setPhoto] = useState(selected.photo);
  useEffect(() => {
    const t = setTimeout(() => setPhoto(selected.photo), 380);
    return () => clearTimeout(t);
  }, [selected]);

  useGSAP(() => {
    if (reduceMotion()) return;
    gsap.timeline()
      .from('.res-top, .sign', { y: 26, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.06 })
      .from('.insight, .legend', { opacity: 0, duration: 0.4 }, 0.6)
      .from('.card', { x: 60, opacity: 0, duration: 0.5, ease: 'power3.out', stagger: 0.05, clearProps: 'transform,opacity' }, 0.4);
  }, { scope: root });

  const t = result.midpoint.times.map((x) => x.min);
  const slow = t.indexOf(Math.max(...t)), fast = t.indexOf(Math.min(...t));
  const shared = selected.shared;
  const insight = going && shared
    ? tripInsight(going, shared, selected, people)
    : result.midpoint.stats.gap - selected.justo.gap >= 5 && slow !== fast
      ? `En el punto medio del mapa, ${nameOf(people[slow], slow)} tardaría ${t[slow]} min y ${nameOf(people[fast], fast)} solo ${t[fast]}. Aquí la diferencia baja a ${Math.round(selected.justo.gap)} min.`
      : `En ${selected.name} nadie tarda más de ${Math.round(selected.justo.max)} min.`;
  const estimated = lines.some((l) => l.est) || !!shared?.est;
  const signLine = going && shared
    ? shared.min > 0
      ? `Desde aquí, ${shared.est ? '≈' : ''}${shared.min} min juntos ${MODE_TXT[shared.mode]} hasta ${going.label}.`
      : `Está en ${going.label}: os pilla de camino a todos.`
    : undefined;

  return (
    <div className="view results" ref={root}>
      <div className="res-top">
        <button type="button" className="back" onClick={onEdit}><BackIcon />Cambiar datos</button>
        <span className="res-when">{going ? `Para ir juntos a ${going.label}` : `Para ${planTxt(plan)}`}, {whenText(when)}</span>
      </div>

      <Sign option={selected} plan={plan} badge={going ? 'juntos' : plan} photo={photo} line={signLine} onMore={onOpenVenue} />

      <section className="diagram" aria-label="Lo que tarda cada uno">
        <Diagram lines={lines} morphKey={selected.id} scaleMax={scaleMax} shared={going ? shared?.min ?? 0 : undefined} />
        <p className="insight">{insight}</p>
        {going ? (
          <div className="legend">
            <span><svg viewBox="0 0 22 10" aria-hidden="true"><line x1="3" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>Cada uno hasta el punto de encuentro</span>
            <span><svg viewBox="0 0 22 10" aria-hidden="true"><line className="dg-trunk" x1="3" y1="5" x2="19" y2="5" /></svg>Juntos hasta {going.label}</span>
            <span><svg viewBox="0 0 14 14" aria-hidden="true"><circle className="dg-ghost" cx="7" cy="7" r="5" /></svg>Yendo cada uno por su cuenta</span>
          </div>
        ) : (
          <div className="legend">
            <span><svg viewBox="0 0 22 10" aria-hidden="true"><line x1="3" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>Lo que tarda cada uno hasta aquí</span>
            <span><svg viewBox="0 0 14 14" aria-hidden="true"><circle className="dg-ghost" cx="7" cy="7" r="5" /></svg>En el punto medio del mapa</span>
          </div>
        )}
        {estimated && <p className="note">≈ es un tiempo estimado: no hemos podido calcular la ruta real de ese transporte (por hoy se ha acabado el cálculo gratis o no hay ruta en esa zona).</p>}
      </section>

      <section className="alts" aria-labelledby="h-alts">
        <div className="alts-head">
          <h2 id="h-alts">Opciones</h2>
          <div className="seg" role="radiogroup" aria-label="Ordenar opciones">
            <button type="button" role="radio" aria-checked={sort === 'justo'} onClick={() => onSort('justo')}>Más justo</button>
            <button type="button" role="radio" aria-checked={sort === 'rapido'} onClick={() => onSort('rapido')}>Menos tiempo</button>
          </div>
        </div>
        <OptionsCarousel options={options} selectedId={selected.id} sort={sort} onSelect={onSelect} />
        <p className="swipe-hint">Desliza para ver otros sitios.</p>
      </section>

      <MeetMap
        people={people} midpoint={result.midpoint.loc} options={options} selected={selected} plan={plan}
        onSelect={onSelect} onOpen={onOpenVenue} departure={result.departureTime}
        dest={going ? { loc: going.to, label: going.label } : null}
      />

      <Directions
        to={selected.loc} placeId={selected.id}
        people={selected.times.map((t, i) => ({ name: nameOf(people[i], i), mode: t.mode, min: t.min, est: t.est, from: people[i].loc }))}
        then={going && shared ? { ...shared, name: going.label, to: going.to } : null}
      />

      <details className="how">
        <summary>{going ? 'Cómo elegimos el punto de encuentro' : 'Cómo elegimos el sitio'}</summary>
        {going ? (
          <p>
            Probamos varios puntos entre vosotros y {going.label}, con los horarios de esa hora, y medimos dos cosas: lo que tarda cada uno
            en llegar al punto y lo que tardáis juntos desde ahí hasta {going.label}. Gana el punto que os deja antes allí (quien más tarda en llegar
            al punto, más el trayecto juntos) repartiendo lo que cada uno hace solo, y sin que nadie dé un rodeo para nada: si a alguien le pilla
            de camino, se le espera allí. Luego buscamos dónde esperaros en esa zona: una gasolinera o un aparcamiento si vais en coche, una
            estación si vais en bus, metro o tren, y una cafetería si vais andando o en bici. Quien tiene coche lo lleva hasta el punto de encuentro.
          </p>
        ) : (
        <p>
          Probamos varias zonas entre vosotros con los horarios de transporte de esa hora, buscamos los sitios más populares de
          la zona que sale más equilibrada y calculamos lo que tarda cada uno hasta cada sitio (en coche, sin contar el tráfico).
          «Más justo» pone primero el sitio donde quien más tarda, tarda menos, sin alargar el viaje al resto por nada: un minuto más para
          quien más tarda solo compensa si la media del grupo baja más de dos. Por eso, si unos vais andando y otros en coche,
          suele ser el coche el que se acerca.
        </p>
        )}
      </details>
    </div>
  );
}

// La frase de debajo del diagrama con destino: cuándo llegáis y, si a alguien le compensa mucho quedar,
// lo que tardaría yendo solo.
function tripInsight(going: { label: string; direct: { min: number }[] }, shared: { min: number }, o: Option, people: Person[]) {
  if (!shared.min) return `Lo más rápido es quedar ya en ${going.label}: nadie tarda más de ${Math.round(o.justo.max)} min.`;
  const arrive = Math.round(o.justo.max + shared.min);
  const gain = o.times.map((t, i) => (going.direct[i]?.min ?? 0) - (t.min + shared.min));
  const k = gain.indexOf(Math.max(...gain));
  const alone = gain[k] >= 5 ? ` Por su cuenta, ${nameOf(people[k], k)} tardaría ${going.direct[k].min} min.` : '';
  return `Quedando aquí llegáis juntos a ${going.label} en ${arrive} min: el último llega al punto en ${Math.round(o.justo.max)} y luego son ${shared.min} min juntos.${alone}`;
}

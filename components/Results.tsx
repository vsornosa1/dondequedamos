'use client';
// Segunda pantalla: el cartel del sitio, el diagrama de líneas, el resto de opciones y el mapa.
import { useEffect, useMemo, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import Sign from './Sign';
import Diagram from './Diagram';
import OptionsCarousel from './OptionsCarousel';
import { BackIcon, COLORS, planTxt } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import { nameOf, whenText } from '@/lib/client';
import type { Option, Person, Plan, Result, Sort, When } from '@/lib/types';

const MeetMap = dynamic(() => import('./MeetMap'), { ssr: false, loading: () => <div className="map" /> });

type Props = {
  result: Result;
  people: Person[];
  plan: Plan;
  when: When;
  selected: Option;
  sort: Sort;
  onSelect: (id: string) => void;
  onSort: (s: Sort) => void;
  onEdit: () => void;
  onOpenVenue: () => void;
};

export default function Results({ result, people, plan, when, selected, sort, onSelect, onSort, onEdit, onOpenVenue }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const options = useMemo(() => {
    const list = [...result.options].sort((a, b) => a[sort].score - b[sort].score).slice(0, 5);
    return list.some((o) => o.id === selected.id) ? list : [...list, selected];
  }, [result, sort, selected]);

  // La escala del diagrama no cambia al pasar de un sitio a otro: solo se mueven las líneas.
  const scaleMax = useMemo(
    () => Math.max(...result.midpoint.times.map((t) => t.min), ...result.options.flatMap((o) => o.times.map((t) => t.min))),
    [result],
  );
  const lines = useMemo(() => selected.times.map((t, i) => ({
    name: nameOf(people[i], i), mode: people[i].mode, min: t.min, est: t.est,
    ghost: result.midpoint.times[i]?.min ?? null, color: COLORS[i],
  })), [selected, people, result]);

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
  const insight = result.midpoint.stats.gap - selected.justo.gap >= 5 && slow !== fast
    ? `En el punto medio del mapa, ${nameOf(people[slow], slow)} tardaría ${t[slow]} min y ${nameOf(people[fast], fast)} solo ${t[fast]}. Aquí la diferencia baja a ${Math.round(selected.justo.gap)} min.`
    : `En ${selected.name} nadie tarda más de ${Math.round(selected.justo.max)} min.`;
  const estimated = lines.some((l) => l.est);

  return (
    <div className="view results" ref={root}>
      <div className="res-top">
        <button type="button" className="back" onClick={onEdit}><BackIcon />Cambiar datos</button>
        <span className="res-when">Para {planTxt(plan)}, {whenText(when)}</span>
      </div>

      <Sign option={selected} plan={plan} photo={photo} onMore={onOpenVenue} />

      <section className="diagram" aria-label="Lo que tarda cada uno">
        <Diagram lines={lines} morphKey={selected.id} scaleMax={scaleMax} />
        <p className="insight">{insight}</p>
        <div className="legend">
          <span><svg viewBox="0 0 22 10" aria-hidden="true"><line x1="3" y1="5" x2="19" y2="5" stroke="currentColor" strokeWidth="5" strokeLinecap="round" /></svg>Lo que tarda cada uno hasta aquí</span>
          <span><svg viewBox="0 0 14 14" aria-hidden="true"><circle className="dg-ghost" cx="7" cy="7" r="5" /></svg>En el punto medio del mapa</span>
        </div>
        {estimated && <p className="note">≈ es un tiempo estimado: Google no tenía ruta para ese transporte en esa zona.</p>}
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
      />

      <details className="how">
        <summary>Cómo elegimos el sitio</summary>
        <p>
          Probamos varias zonas entre vosotros con los horarios de transporte y el tráfico reales de esa hora, buscamos los sitios
          mejor valorados de la zona que sale más equilibrada y calculamos lo que tarda cada uno hasta cada sitio. «Más justo»
          pone primero el sitio donde quien más tarda, tarda menos, sin alargar el viaje al resto por nada: un minuto más para
          quien más tarda solo compensa si la media del grupo baja más de dos. Por eso, si unos vais andando y otros en coche,
          suele ser el coche el que se acerca.
        </p>
      </details>
    </div>
  );
}

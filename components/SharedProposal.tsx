'use client';
// Lo que ve quien recibe el enlace en el grupo: el sitio, lo que tarda cada uno y cómo llegar.
import { useRef } from 'react';
import dynamic from 'next/dynamic';
import Diagram from './Diagram';
import Directions from './Directions';
import { COLORS, MODE_TXT, Mark, PlanIcon, SponsorLink, planTxt } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import type { Proposal } from '@/lib/types';

const RouteMap = dynamic(() => import('./RouteMap'), { ssr: false, loading: () => <div className="map" /> });

export default function SharedProposal({ p }: { p: Proposal }) {
  const root = useRef<HTMLDivElement>(null);
  const lines = p.people.map((x, i) => ({ ...x, color: COLORS[i] }));
  const max = Math.max(...p.people.map((x) => x.min));
  const gap = max - Math.min(...p.people.map((x) => x.min));
  // Con destino: el sitio del enlace es dónde quedar antes, y desde ahí seguís juntos.
  const trip = p.trip;
  const directions = p.loc
    ? `https://www.google.com/maps/dir/?api=1&destination=${p.loc.lat},${p.loc.lng}${p.placeId?.startsWith('ChIJ') ? `&destination_place_id=${p.placeId}` : ''}`
    : null;
  // Se muestra en hora de España en el servidor y en el móvil, para que coincidan.
  const when = p.when
    ? new Intl.DateTimeFormat('es-ES', { weekday: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(p.when))
    : '';

  useGSAP(() => {
    if (reduceMotion()) return;
    gsap.from('.sign, .diagram, .shared-actions', { y: 24, opacity: 0, duration: 0.55, ease: 'power3.out', stagger: 0.08 });
  }, { scope: root });

  return (
    <div className="app shared" ref={root}>
      <header className="top compact">
        <Mark />
        <p className="brand">¿Dónde quedamos?</p>
      </header>

      <article className="sign">
        <div className="sign-body">
          <p className="sign-label">
            <PlanIcon plan={trip ? 'juntos' : p.plan} />
            {trip ? (trip.min ? `Te proponen quedar aquí para ir juntos a ${trip.name}` : `Te proponen quedar en ${trip.name}`) : `Te proponen quedar para ${planTxt(p.plan)}`}
          </p>
          <h1 className="sign-name">{p.name}</h1>
          {(p.type || p.address) && <ul className="sign-facts">{[p.type, p.address].filter(Boolean).map((f) => <li key={f}>{f}</li>)}</ul>}
          <p className="sign-line">
            {trip?.min
              ? `Desde aquí, ${trip.min} min juntos ${MODE_TXT[trip.mode]} hasta ${trip.name}. Llegáis en ${max + trip.min} min.`
              : `Nadie tarda más de ${max} min. Diferencia: ${gap} min.`}
          </p>
          {when && <p className="sign-when">Calculado para el {when}.</p>}
        </div>
      </article>

      <section className="diagram" aria-label="Lo que tarda cada uno">
        <Diagram lines={lines} shared={trip ? trip.min : undefined} />
        <p className="insight">
          {trip?.min
            ? `Cada línea mide lo que tarda cada uno hasta el punto de encuentro; desde ahí, ${trip.min} min juntos hasta ${trip.name}. Es el punto más justo para todos.`
            : 'Cada línea mide lo que tarda cada uno en llegar. Es el sitio más justo para todos.'}
        </p>
      </section>

      {p.loc && (
        <>
          <RouteMap to={p.loc} plan={trip ? 'juntos' : p.plan} name={p.name} people={p.people} routes={p.routes} trip={trip} />
          <Directions to={p.loc} placeId={p.placeId} people={p.people} fromHere then={trip ? { ...trip, to: trip.loc } : null} />
        </>
      )}

      <footer className="foot">
        <SponsorLink />
        <p><strong>Fet a la terreta.</strong></p>
        <p>Tiempos y sitios de Google Maps. Mapa de OpenFreeMap y OpenStreetMap.</p>
      </footer>

      <div className="bar">
        <div className="bar-in shared-actions">
          {directions && <a className="cta" href={directions} target="_blank" rel="noopener noreferrer">Cómo llegar</a>}
          <a className={directions ? 'cta ghost' : 'cta'} href="/">Calcular el nuestro</a>
        </div>
      </div>
    </div>
  );
}

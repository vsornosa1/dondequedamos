'use client';
// Lo que ve quien recibe el enlace en el grupo: el sitio, lo que tarda cada uno y cómo llegar.
import { useRef } from 'react';
import Diagram from './Diagram';
import { COLORS, Mark, PlanIcon, SponsorLink, planTxt } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import type { Proposal } from '@/lib/types';

export default function SharedProposal({ p }: { p: Proposal }) {
  const root = useRef<HTMLDivElement>(null);
  const lines = p.people.map((x, i) => ({ ...x, color: COLORS[i] }));
  const max = Math.max(...p.people.map((x) => x.min));
  const gap = max - Math.min(...p.people.map((x) => x.min));
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
          <p className="sign-label"><PlanIcon plan={p.plan} />Te proponen quedar para {planTxt(p.plan)}</p>
          <h1 className="sign-name">{p.name}</h1>
          {(p.type || p.address) && <ul className="sign-facts">{[p.type, p.address].filter(Boolean).map((f) => <li key={f}>{f}</li>)}</ul>}
          <p className="sign-line">Nadie tarda más de {max} min. Diferencia: {gap} min.</p>
          {when && <p className="sign-when">Calculado para el {when}.</p>}
        </div>
      </article>

      <section className="diagram" aria-label="Lo que tarda cada uno">
        <Diagram lines={lines} />
        <p className="insight">Cada línea mide lo que tarda cada uno en llegar. Es el sitio más justo para todos.</p>
      </section>

      <footer className="foot">
        <SponsorLink />
        <p><strong>Fet a la terreta.</strong></p>
        <p>Tiempos y sitios de Google Maps.</p>
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

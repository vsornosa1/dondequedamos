'use client';
// Mientras Google calcula: las líneas del logo se juntan una y otra vez.
import { useEffect, useRef, useState } from 'react';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';

const STEPS = ['Mirando el metro y el bus de esa hora', 'Calculando el tráfico', 'Probando zonas entre vosotros', 'Buscando sitios en la zona más justa'];

export default function Loader() {
  const root = useRef<HTMLDivElement>(null);
  const [step, setStep] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setStep((s) => Math.min(s + 1, STEPS.length - 1)), 1100);
    return () => clearInterval(t);
  }, []);

  useGSAP(() => {
    gsap.from(root.current, { opacity: 0, duration: 0.25 });
    if (reduceMotion()) return;
    gsap.timeline({ repeat: -1, repeatDelay: 0.15 })
      .fromTo('.ld-line', { drawSVG: '0%' }, { drawSVG: '100%', duration: 0.7, ease: 'power2.inOut', stagger: 0.12 })
      .fromTo('.ld-dot', { scale: 0, transformOrigin: '50% 50%' }, { scale: 1, duration: 0.35, ease: 'back.out(3)' }, '-=0.2')
      .to('.ld-line, .ld-dot', { opacity: 0, duration: 0.3, delay: 0.35 })
      .set('.ld-line, .ld-dot', { opacity: 1 });
  }, { scope: root });

  return (
    <div className="loader" ref={root} role="status" aria-live="polite">
      <svg className="ld-mark" viewBox="0 0 48 48" aria-hidden="true">
        <g fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
          <path className="ld-line" d="M5 12h11l10 12" stroke="#E5352B" />
          <path className="ld-line" d="M5 24h21" stroke="#1F6FD1" />
          <path className="ld-line" d="M5 36h11l10-12" stroke="#12A150" />
        </g>
        <circle className="ld-dot" cx="33" cy="24" r="6.5" fill="#FFD100" stroke="currentColor" strokeWidth="3" />
      </svg>
      <p className="ld-msg" key={step}>{STEPS[step]}…</p>
    </div>
  );
}

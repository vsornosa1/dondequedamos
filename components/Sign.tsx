'use client';
// El cartel amarillo del punto de encuentro. Al cambiar de sitio, el nombre gira letra a letra
// como en los paneles de las estaciones.
import { useRef, useState } from 'react';
import { PlanIcon, ChevronIcon } from './brand';
import { gsap, useGSAP, SplitText, reduceMotion } from '@/lib/gsap';
import { photoSrc, priceText, ratingText } from '@/lib/client';
import type { Option, Plan } from '@/lib/types';

type Props = { option: Option; plan: Plan; photo: Option['photo']; label?: string; onMore?: () => void };

export default function Sign({ option, plan, photo, label = 'Punto de encuentro', onMore }: Props) {
  const root = useRef<HTMLElement>(null);
  const [loaded, setLoaded] = useState<string | null>(null);

  useGSAP(() => {
    if (reduceMotion()) return;
    const name = root.current?.querySelector('.sign-name');
    if (!name) return;
    const split = SplitText.create(name, { type: 'chars', charsClass: 'ch' });
    gsap.from(split.chars, {
      rotationX: -100, opacity: 0, transformOrigin: '50% 50% -12px', transformPerspective: 500,
      duration: 0.42, ease: 'back.out(1.7)', stagger: 0.018, onComplete: () => split.revert(),
    });
  }, { dependencies: [option.id], scope: root, revertOnUpdate: true });

  const facts = [
    option.type,
    priceText(option.price),
    option.rating ? `${ratingText(option.rating)} ★ (${option.ratings})` : '',
    option.openNow === true ? 'Abierto ahora' : option.openNow === false ? 'Cerrado ahora' : '',
  ].filter(Boolean);

  return (
    <article className="sign" ref={root}>
      {photo && (
        <button type="button" className="sign-photo" onClick={onMore} aria-label={`Ver fotos de ${option.name}`}>
          <img
            key={photo.name} src={photoSrc(photo.name, 900)} alt="" decoding="async"
            className={loaded === photo.name ? 'in' : ''} onLoad={() => setLoaded(photo.name)}
          />
          {photo.by && <span className="credit">Foto: {photo.by}</span>}
        </button>
      )}
      <div className="sign-body">
        <p className="sign-label"><PlanIcon plan={plan} />{label}</p>
        <h2 className="sign-name" key={option.id}>{option.name}</h2>
        {facts.length > 0 && <ul className="sign-facts">{facts.map((f) => <li key={f}>{f}</li>)}</ul>}
        <p className="sign-line">
          Nadie tarda más de {Math.round(option.justo.max)} min. Diferencia: {Math.round(option.justo.gap)} min.
        </p>
        {onMore && (
          <button type="button" className="sign-more" onClick={onMore}>
            Ver fotos e información <ChevronIcon />
          </button>
        )}
      </div>
    </article>
  );
}

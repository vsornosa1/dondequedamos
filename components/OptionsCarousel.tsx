'use client';
// Las opciones se pasan con el dedo: la tarjeta que queda en el centro es el sitio elegido.
import { useEffect, useRef, type CSSProperties } from 'react';
import { COLORS } from './brand';
import { priceText, ratingText } from '@/lib/client';
import { reduceMotion } from '@/lib/gsap';
import type { Option, Sort } from '@/lib/types';

type Props = { options: Option[]; selectedId: string; sort: Sort; onSelect: (id: string) => void };

export default function OptionsCarousel({ options, selectedId, sort, onSelect }: Props) {
  const scroller = useRef<HTMLDivElement>(null);
  const fromSwipe = useRef(false);
  const latest = useRef({ selectedId, onSelect });
  latest.current = { selectedId, onSelect };

  // Si la elección viene de fuera (mapa, orden, toque), centramos esa tarjeta.
  useEffect(() => {
    if (fromSwipe.current) { fromSwipe.current = false; return; }
    const s = scroller.current;
    const card = s?.querySelector<HTMLElement>(`[data-id="${CSS.escape(selectedId)}"]`);
    if (s && card) s.scrollTo({ left: card.offsetLeft - (s.clientWidth - card.clientWidth) / 2, behavior: reduceMotion() ? 'auto' : 'smooth' });
  }, [selectedId, sort]);

  // Al soltar el dedo, la tarjeta del centro pasa a ser el sitio elegido.
  useEffect(() => {
    const s = scroller.current;
    if (!s) return;
    let t = 0;
    const settle = () => {
      const mid = s.scrollLeft + s.clientWidth / 2;
      let best: HTMLElement | null = null, dist = Infinity;
      s.querySelectorAll<HTMLElement>('.card').forEach((c) => {
        const d = Math.abs(c.offsetLeft + c.clientWidth / 2 - mid);
        if (d < dist) { dist = d; best = c; }
      });
      const id = (best as HTMLElement | null)?.dataset.id;
      if (id && id !== latest.current.selectedId) {
        fromSwipe.current = true;
        navigator.vibrate?.(8);
        latest.current.onSelect(id);
      }
    };
    const onScroll = () => { clearTimeout(t); t = window.setTimeout(settle, 130); };
    s.addEventListener('scroll', onScroll, { passive: true });
    return () => { s.removeEventListener('scroll', onScroll); clearTimeout(t); };
  }, []);

  const maxT = Math.max(1, ...options.flatMap((o) => o.times.map((t) => t.min)));

  return (
    <div className="carousel" ref={scroller}>
      {options.map((o, k) => (
        <button
          key={o.id} type="button" className="card" data-id={o.id} aria-pressed={o.id === selectedId}
          onClick={() => latest.current.onSelect(o.id)}
        >
          <span className="rank">{k + 1}</span>
          <span className="card-name">{o.name}</span>
          <span className="card-sub">
            {[o.type, priceText(o.price), o.rating ? `${ratingText(o.rating)} ★` : '', o.openNow === false ? 'cerrado ahora' : ''].filter(Boolean).join(', ')}
          </span>
          <span className="card-fig">
            {sort === 'rapido'
              ? <><b>{Math.round(o.rapido.avg)} min</b>de media</>
              : <><b>{Math.round(o.justo.max)} min</b>como mucho</>}
          </span>
          {/* Como en el diagrama: el sitio a la derecha y cada uno más lejos cuanto más tarda. */}
          <span className="strip" aria-hidden="true">
            {o.times.map((t, i) => (
              <i key={i} style={{ '--c': COLORS[i], left: `${(100 - (t.min / maxT) * 100).toFixed(1)}%` } as CSSProperties} />
            ))}
          </span>
        </button>
      ))}
    </div>
  );
}

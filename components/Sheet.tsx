'use client';
// Hoja que sube desde abajo, como en las apps del móvil. Se cierra arrastrando, tocando fuera o con Escape.
import { useCallback, useEffect, useRef, type ReactNode, type PointerEvent } from 'react';
import { createPortal } from 'react-dom';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';

type Props = {
  label: string;
  onClose: () => void;
  full?: boolean;
  children: (close: () => void) => ReactNode;
};

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])';

export default function Sheet({ label, onClose, full, children }: Props) {
  const root = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const closing = useRef(false);
  const drag = useRef<{ y: number; t: number; dy: number } | null>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const close = useCallback(() => {
    if (closing.current) return;
    closing.current = true;
    if (reduceMotion()) return onCloseRef.current();
    gsap.to(backdrop.current, { opacity: 0, duration: 0.25 });
    gsap.to(panel.current, { yPercent: 100, duration: 0.3, ease: 'power2.in', onComplete: () => onCloseRef.current() });
  }, []);

  useGSAP(() => {
    if (reduceMotion()) return;
    gsap.from(backdrop.current, { opacity: 0, duration: 0.3 });
    gsap.from(panel.current, { yPercent: 100, duration: 0.5, ease: 'expo.out' });
  }, { scope: root });

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const html = document.documentElement;
    const overflow = html.style.overflow;
    html.style.overflow = 'hidden';
    const first = panel.current?.querySelector<HTMLElement>('[data-autofocus]');
    (first || panel.current)?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return close();
      if (e.key !== 'Tab' || !panel.current) return;
      const items = [...panel.current.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (!items.length) return;
      const [a, z] = [items[0], items[items.length - 1]];
      if (e.shiftKey && document.activeElement === a) { e.preventDefault(); z.focus(); }
      else if (!e.shiftKey && document.activeElement === z) { e.preventDefault(); a.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      html.style.overflow = overflow;
      opener?.focus?.({ preventScroll: true });
    };
  }, [close]);

  const down = (e: PointerEvent) => {
    drag.current = { y: e.clientY, t: performance.now(), dy: 0 };
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  };
  const move = (e: PointerEvent) => {
    if (!drag.current) return;
    drag.current.dy = Math.max(0, e.clientY - drag.current.y);
    gsap.set(panel.current, { y: drag.current.dy });
  };
  const up = () => {
    const d = drag.current;
    drag.current = null;
    if (!d) return;
    const speed = d.dy / Math.max(1, performance.now() - d.t);
    if (d.dy > 110 || speed > 0.6) {
      closing.current = true;
      gsap.to(backdrop.current, { opacity: 0, duration: 0.2 });
      gsap.to(panel.current, { y: panel.current?.offsetHeight ?? 600, duration: 0.22, ease: 'power2.in', onComplete: () => onCloseRef.current() });
    } else {
      gsap.to(panel.current, { y: 0, duration: 0.35, ease: 'back.out(1.6)' });
    }
  };

  return createPortal(
    <div className="sheet-root" ref={root}>
      <div className="sheet-backdrop" ref={backdrop} onClick={close} />
      <div className={full ? 'sheet full' : 'sheet'} ref={panel} role="dialog" aria-modal="true" aria-label={label} tabIndex={-1}>
        <div className="sheet-grab" onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
          <span />
        </div>
        {children(close)}
      </div>
    </div>,
    document.body,
  );
}

'use client';
// Cada línea mide lo que tarda cada uno hasta el punto de encuentro (amarillo, a la derecha).
// Los círculos discontinuos marcan lo que tardaría quedando en el punto medio del mapa.
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { MODE_SHAPES, MODE_TXT } from './brand';
import { gsap, useGSAP, reduceMotion } from '@/lib/gsap';
import type { Line } from '@/lib/types';

type Props = {
  lines: Line[];
  morphKey?: string; // al cambiar, las líneas se estiran o encogen hasta su nuevo valor
  scaleMax?: number; // escala fija para que cambiar de sitio no mueva los ejes
};

function layout(lines: Line[], W: number, scaleMax = 0) {
  const n = lines.length, rowH = 50, top = 8, axisH = 24;
  const labelW = W < 400 ? 100 : 122;
  const end = W - 24;
  const maxT = Math.max(10, scaleMax, ...lines.map((l) => Math.max(l.min, l.ghost ?? 0)));
  const step = maxT > 60 ? 20 : maxT > 30 ? 10 : 5;
  const axis = Math.ceil(maxT / step) * step;
  const k = (end - labelW - 16) / axis;
  const x = (m: number) => end - m * k;
  return {
    W, H: top + n * rowH + axisH, top, rowH, end, labelW, axis, step, x,
    ys: lines.map((_, i) => top + i * rowH + rowH / 2),
    xs: lines.map((l) => x(l.min)),
    mins: lines.map((l) => l.min),
  };
}
type Geo = ReturnType<typeof layout>;

export default function Diagram({ lines, morphKey = '', scaleMax }: Props) {
  const wrap = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(0);
  const geo = useMemo(() => (W ? layout(lines, W, scaleMax) : null), [lines, W, scaleMax]);
  const prev = useRef<Geo | null>(null);
  const shown = useRef(false);

  useEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useGSAP(() => {
    if (!geo) return;
    const q = gsap.utils.selector(wrap);
    if (!shown.current) {
      shown.current = true;
      if (reduceMotion()) return;
      gsap.timeline()
        .from(q('.dg-line'), { drawSVG: '0%', duration: 0.9, ease: 'power3.out', stagger: 0.09, clearProps: 'all' })
        .from(q('.dg-stop'), { scale: 0, transformOrigin: '50% 50%', duration: 0.35, ease: 'back.out(3)', stagger: 0.09, clearProps: 'transform' }, 0)
        .from(q('.dg-ghost'), { opacity: 0, duration: 0.4 }, 0.5)
        .from(q('.dg-station'), { scaleY: 0, transformOrigin: '50% 50%', duration: 0.45, ease: 'back.out(2)', clearProps: 'transform' }, 0.55);
      return;
    }
    const p = prev.current;
    if (!p || reduceMotion()) return;
    // Morph: cada línea parte de donde estaba y llega a su nuevo largo; los minutos cuentan hasta el valor nuevo.
    const lineEls = q('.dg-line'), stopEls = q('.dg-stop'), minEls = q('.dg-min');
    geo.xs.forEach((x, i) => {
      if (p.xs[i] == null || p.xs[i] === x) return;
      gsap.fromTo(lineEls[i], { attr: { x1: p.xs[i] } }, { attr: { x1: x }, duration: 0.6, ease: 'power3.inOut' });
      gsap.fromTo(stopEls[i], { attr: { cx: p.xs[i] } }, { attr: { cx: x }, duration: 0.6, ease: 'power3.inOut' });
      const text = minEls[i]?.firstChild as Text | null;
      if (!text) return;
      const prefix = text.nodeValue?.startsWith('≈') ? '≈' : '';
      const n = { v: p.mins[i] };
      gsap.to(n, { v: geo.mins[i], duration: 0.6, ease: 'power3.inOut', onUpdate: () => { text.nodeValue = `${prefix}${Math.round(n.v)} min`; } });
    });
  }, { dependencies: [morphKey, !!geo], scope: wrap });

  useLayoutEffect(() => { prev.current = geo; });

  const label = lines.map((l) => `${l.name}: ${l.min} minutos ${MODE_TXT[l.mode]}`).join('; ');
  const chars = geo ? Math.floor(geo.labelW / 9.5) : 10;
  const cut = (s: string) => (s.length > chars ? `${s.slice(0, chars - 1)}…` : s);

  return (
    <div className="diagram-box" ref={wrap}>
      {!geo ? (
        <div style={{ height: lines.length * 50 + 32 }} />
      ) : (
        <svg viewBox={`0 0 ${geo.W} ${geo.H}`} width={geo.W} height={geo.H} role="img" aria-label={label}>
          {Array.from({ length: geo.axis / geo.step }, (_, k) => (k + 1) * geo.step).map((v) => (
            <g key={v}>
              <line className="dg-grid" x1={geo.x(v)} x2={geo.x(v)} y1={geo.top} y2={geo.top + lines.length * geo.rowH} />
              <text className="dg-tick" x={geo.x(v)} y={geo.H - 6} textAnchor="middle">{v === geo.axis ? `${v} min` : v}</text>
            </g>
          ))}
          {lines.map((l, i) => (
            <g key={i} style={{ '--c': l.color } as CSSProperties}>
              <text className="dg-name" x={0} y={geo.ys[i] - 4}>{cut(l.name)}</text>
              <g className="dg-mode" transform={`translate(0 ${geo.ys[i] + 3}) scale(.6)`}>{MODE_SHAPES[l.mode]}</g>
              <text className="dg-min" x={19} y={geo.ys[i] + 15}>{`${l.est ? '≈' : ''}${l.min} min`}</text>
              <line className="dg-line" x1={geo.xs[i]} y1={geo.ys[i]} x2={geo.end + 6} y2={geo.ys[i]} />
              {l.ghost != null && <circle className="dg-ghost" cx={geo.x(l.ghost)} cy={geo.ys[i]} r={6} />}
              <circle className="dg-stop" cx={geo.xs[i]} cy={geo.ys[i]} r={7} />
            </g>
          ))}
          <rect className="dg-station" x={geo.end} y={geo.top + 6} width={20} height={lines.length * geo.rowH - 12} rx={10} />
        </svg>
      )}
    </div>
  );
}

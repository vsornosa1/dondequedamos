import React from 'react';
import { c } from '../look';

// The app's mark (components/brand.tsx), with each part animatable:
// square 0..1 scales the yellow tile, lines 0..1 draws the three lines, dot 0..1 pops the stop.
export const Mark = ({ size, square = 1, lines = [1, 1, 1], dot = 1 }: { size: number; square?: number; lines?: number[]; dot?: number }) => (
  <svg width={size} height={size} viewBox="0 0 48 48" style={{ display: 'block', overflow: 'visible' }}>
    <rect x={24 - 24 * square} y={24 - 24 * square} width={48 * square} height={48 * square} rx={12 * square} fill={c.signal} />
    <g fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
      {['M9 14h8l9 10', 'M9 24h17', 'M9 34h8l9-10'].map((d, i) => (
        <path key={d} d={d} stroke={['#E5352B', '#1F6FD1', '#12A150'][i]} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - lines[i]} opacity={lines[i] > 0.01 ? 1 : 0} />
      ))}
    </g>
    <circle cx="32" cy="24" r={6 * dot} fill={c.ink} />
  </svg>
);

// Letters that flip in one by one, like the panels in a station (the app does this on the venue name).
export const Flip = ({ text, f, at, stagger = 1.2, dur = 12, style }: { text: string; f: number; at: number; stagger?: number; dur?: number; style?: React.CSSProperties }) => (
  <span style={{ display: 'inline-block', perspective: 600, ...style }}>
    {Array.from(text).map((ch, i) => {
      const t = Math.max(0, Math.min(1, (f - at - i * stagger) / dur));
      const back = t === 0 ? 0 : 1 + 2.7 * (t - 1) ** 3 + 1.7 * (t - 1) ** 2;
      return (
        <span key={i} style={{
          display: 'inline-block', whiteSpace: 'pre', transformOrigin: '50% 50% -0.18em',
          transform: `rotateX(${-100 * (1 - back)}deg)`, opacity: Math.min(1, t * 2.2),
        }}>{ch}</span>
      );
    })}
  </span>
);

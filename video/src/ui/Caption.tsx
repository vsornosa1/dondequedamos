import React from 'react';
import { c, font } from '../look';
import { enter, leave } from './motion';

// The headline band at the top of the frame: words rise in one after another and
// the whole line eases out. `step` adds the numbered stop above it, like the app's rings.
type Props = {
  f: number;
  text: string;
  at: number;
  out: number;
  dark?: boolean;
  step?: number;
  size?: number;
  top?: number;
  width?: number;
  highlight?: string[]; // words drawn in a colour
  hlColor?: string;
};

export const Caption = ({ f, text, at, out, dark = false, step, size = 76, top = 92, width = 940, highlight = [], hlColor }: Props) => {
  if (f < at - 2 || f > out + 20) return null;
  const o = leave(f, out, 14);
  const words = text.split(' ');
  const color = dark ? c.paper : c.ink;
  return (
    <div style={{
      position: 'absolute', left: (1080 - width) / 2, top, width, textAlign: 'center', zIndex: 300,
      opacity: 1 - o, transform: `translateY(${-18 * o}px)`,
    }}>
      <div style={{ fontFamily: font, fontWeight: 900, fontSize: size, lineHeight: 1.04, letterSpacing: '-0.025em', color, textWrap: 'balance' } as React.CSSProperties}>
        {step !== undefined && (
          <span style={{
            display: 'inline-grid', placeItems: 'center', width: '0.78em', height: '0.78em', marginRight: '0.24em', verticalAlign: '0.02em',
            borderRadius: '50%', border: `0.09em solid ${color}`, fontSize: '1em', boxSizing: 'border-box',
            transform: `scale(${enter(f, at - 6, 18)})`,
          }}><span style={{ fontSize: '0.48em', lineHeight: 1, paddingTop: '0.12em' }}>{step}</span></span>
        )}
        {words.map((w, i) => {
          const t = enter(f, at + i * 4, 22);
          const hl = highlight.includes(w.replace(/[.,:;¿?¡!]/g, ''));
          return (
            <span key={i} style={{ display: 'inline-block', opacity: t, transform: `translateY(${(1 - t) * 34}px)`, color: hl ? hlColor : undefined, whiteSpace: 'pre' }}>
              {w}{i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </div>
  );
};

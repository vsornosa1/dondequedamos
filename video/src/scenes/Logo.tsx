import React from 'react';
import { AbsoluteFill } from 'remotion';
import { c, font } from '../look';
import { K } from '../timing';
import { Flip, Mark } from '../ui/Mark';
import { CHROME_H, PHONE, SCREEN } from '../ui/Phone';
import { enter, glide, leave, lerp, pop } from '../ui/motion';

// The turn: the midpoint swells into a yellow screen, the paper opens out of the mark's
// own yellow tile, the mark draws itself, and the lockup then flies into the phone's header.

const ORIGIN = { x: 540, y: 850 }; // where the night camera ends: on the midpoint
const L = 3; // lockup scale on its own (the app header is 50 px mark, 39 px title)
const LOCK = { x: (1080 - 264 * L) / 2, y: 470 };
const HEADER = { x: SCREEN.left + 16 * PHONE.scale, y: SCREEN.top + (CHROME_H + 14 + 6) * PHONE.scale };
const TILE = { x: LOCK.x + 25 * L, y: LOCK.y + 36.5 * L }; // centre of the mark's tile

export const Lockup = ({ f, scale, x, y, title = 1, at = K.logo.square }: { f: number; scale: number; x: number; y: number; title?: number; at?: number }) => (
  <div style={{
    position: 'absolute', left: 0, top: 0, width: 358, display: 'grid', gridTemplateColumns: '50px minmax(0, 1fr)', alignItems: 'center', columnGap: 14,
    transform: `translate(${x}px, ${y}px) scale(${scale})`, transformOrigin: '0 0', fontFamily: font,
  }}>
    <Mark
      size={50}
      square={f >= at ? 1 : 0}
      lines={[0, 1, 2].map((k) => glide(f, at + 10 + k * 4, 14))}
      dot={pop(f, at + 28, 12, 3)}
    />
    <h1 style={{ margin: 0, fontWeight: 900, fontSize: 39, lineHeight: 0.94, letterSpacing: '-.025em', color: c.ink, maxWidth: 294, opacity: title }}>
      <Flip text="¿Dónde" f={f} at={at + 14} stagger={1.4} />
      <br />
      <Flip text="quedamos?" f={f} at={at + 20} stagger={1.4} />
    </h1>
  </div>
);

export const LogoScene = ({ f, layer }: { f: number; layer: 'back' | 'front' }) => {
  const yellow = glide(f, K.logo.burst - 2, 16);
  const paper = glide(f, K.logo.square + 2, 24);
  const fly = glide(f, K.logo.fly, 36);
  const sub = enter(f, K.logo.sub, 24) * (1 - leave(f, K.logo.fly - 4, 16));
  const words = ['El', 'sitio', 'donde', 'todos', 'tardáis', 'lo mismo.'];
  if (layer === 'back') {
    return (
      <AbsoluteFill style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', left: ORIGIN.x, top: ORIGIN.y, width: 0, height: 0 }}>
          <div style={{ position: 'absolute', left: -1100 * yellow, top: -1100 * yellow, width: 2200 * yellow, height: 2200 * yellow, borderRadius: '50%', background: c.signal }} />
        </div>
        <div style={{ position: 'absolute', left: TILE.x, top: TILE.y, width: 0, height: 0 }}>
          <div style={{ position: 'absolute', left: -1400 * paper, top: -1400 * paper, width: 2800 * paper, height: 2800 * paper, borderRadius: '50%', background: c.paper }} />
        </div>
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {f < K.logo.fly + 37 && (
        <Lockup f={f} scale={lerp(fly, L, PHONE.scale)} x={lerp(fly, LOCK.x, HEADER.x)} y={lerp(fly, LOCK.y, HEADER.y)} />
      )}
      <div style={{
        position: 'absolute', left: 110, right: 110, top: 770, textAlign: 'center', fontFamily: font, fontWeight: 800, fontSize: 58,
        lineHeight: 1.12, letterSpacing: '-0.015em', color: c.ink, opacity: sub, textWrap: 'balance',
      } as React.CSSProperties}>
        {words.map((w, i) => {
          const t = enter(f, K.logo.sub + i * 4, 22);
          const key = i === words.length - 1;
          return (
            <span key={i} style={{ display: 'inline-block', whiteSpace: 'pre', opacity: t, transform: `translateY(${(1 - t) * 26}px)`, boxShadow: key ? `inset 0 -0.32em 0 ${c.signal}` : undefined }}>
              {w}{i < words.length - 1 ? ' ' : ''}
            </span>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

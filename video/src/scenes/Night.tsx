import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { PEOPLE_COLORS, c, font } from '../look';
import { FROM, K, MODES, NAMES, T } from '../timing';
import { MIDPOINT, ORIGINS, PLATE, ROUTES_MID, S, sideBySide, type Pt } from '../geo';
import { Blob } from '../ui/Blob';
import { Caption } from '../ui/Caption';
import { Flip } from '../ui/Mark';
import { ModeIcon } from '../ui/icons';
import { enter, glide, leave, lerp, lin, pop } from '../ui/motion';

// Act one, on the night ground: the four friends, then the map of València and
// the midpoint that looks fair and is not.

const ROW = { x: [158, 408, 666, 918], ground: 920, size: [246, 224, 234, 218] };
const rowY = (i: number) => ROW.ground - 0.35 * ROW.size[i]; // feet on one line
const MAP_SIZE = 96;
const MID_MIN = S.midpoint.times.map((t) => t.min);

// Camera over the night plate: frame the four origins and the midpoint.
const pts = [...ORIGINS, MIDPOINT];
const bb = {
  minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)),
  minY: Math.min(...pts.map((p) => p.y)), maxY: Math.max(...pts.map((p) => p.y)),
};
const S0 = 860 / (bb.maxX - bb.minX);
const C0 = { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
const FOCUS = { x: 540, y: 850 };

// Each route to the midpoint, with its own lane where two share a street (11 px apart on screen).
const LINES = sideBySide(ORIGINS.map((o, i) => [o, ...ROUTES_MID[i], MIDPOINT]), 11 / S0);

export const camera = (f: number) => {
  const dive = leave(f, K.problem.retract, 26);
  const s = S0 * (1 + 0.04 * glide(f, 150, 240)) * (1 + 1.4 * dive);
  const cx = lerp(dive, C0.x, MIDPOINT.x);
  const cy = lerp(dive, C0.y, MIDPOINT.y);
  return { s, toScreen: (p: Pt) => ({ x: FOCUS.x + (p.x - cx) * s, y: FOCUS.y + (p.y - cy) * s }), cx, cy };
};

const blinkAt = [[40, 132, 230, 350], [56, 160, 262], [80, 196, 300, 372], [30, 118, 214]];
const blinkOf = (i: number, f: number) => Math.max(0, ...blinkAt[i].map((b) => 1 - Math.abs(f - b - 3) / 3));

// Where each minute pill sits around its blob (frame px).
const PILL = [{ dx: 62, dy: -6, align: 'left' }, { dx: -62, dy: -6, align: 'right' }, { dx: 0, dy: 58, align: 'center' }, { dx: 0, dy: 58, align: 'center' }] as const;

export const NightScene = ({ f }: { f: number }) => {
  const cam = camera(f);
  const fly = glide(f, K.hook.exit, 36);
  const out = leave(f, K.problem.retract, 20);
  const mapIn = enter(f, K.hook.exit + 6, 40);
  const mid = cam.toScreen(MIDPOINT);
  const plateLeft = FOCUS.x - cam.cx * cam.s;
  const plateTop = FOCUS.y - cam.cy * cam.s;

  // Lines grow at perMin frames a minute, so the counters run at the same pace for everyone.
  const lineStart = (i: number) => K.problem.lines + i * 3;
  const progress = (i: number) => lin(f, lineStart(i), MID_MIN[i] * K.problem.perMin);
  const yaniaDone = lineStart(3) + MID_MIN[3] * K.problem.perMin;

  return (
    <AbsoluteFill style={{ background: c.ink, overflow: 'hidden' }}>
      {f >= K.hook.exit && (
        <Img src={staticFile('map-night.png')} style={{ position: 'absolute', left: plateLeft, top: plateTop, width: PLATE.w * cam.s, height: PLATE.h * cam.s, opacity: mapIn * 0.95, maxWidth: 'none' }} />
      )}
      {/* Fades that keep the captions on clean ground. */}
      <AbsoluteFill style={{ background: `linear-gradient(${c.ink} 0, ${c.ink} 300px, rgba(14,26,43,0) 470px, rgba(14,26,43,0) 1180px, ${c.ink} 1350px)`, opacity: mapIn }} />

      {/* Routes to the midpoint: all the dark casings first, then the colours, so lines
          that share a street read as two lanes. */}
      <svg width={1080} height={1350} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        {[0, 1].map((layer) => [0, 1, 2, 3].map((i) => {
          const p = progress(i);
          if (p <= 0) return null;
          const d = LINES[i].map((q, k) => {
            const s = cam.toScreen(q);
            return `${k ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
          }).join(' ');
          const tail = out; // the lines pull into the midpoint on the way out
          const dash = tail > 0 ? `0 ${tail} ${Math.max(0, 1 - tail)} 2` : '1 1';
          const off = tail > 0 ? 0 : 1 - p;
          return (
            <path key={`${layer}${i}`} d={d} pathLength={1} strokeDasharray={dash} strokeDashoffset={off} fill="none"
              stroke={layer ? PEOPLE_COLORS[i] : c.ink} strokeWidth={layer ? 9 : 16} strokeLinecap="round" strokeLinejoin="round" />
          );
        }))}
      </svg>

      {/* The midpoint pin, which turns yellow as the film dives into it. */}
      {f >= K.problem.pin && (
        <div style={{ position: 'absolute', left: mid.x, top: mid.y, width: 0, height: 0 }}>
          <div style={{
            position: 'absolute', left: -27, top: -27, width: 54, height: 54, borderRadius: '50%', boxSizing: 'border-box',
            border: `3.5px dashed ${out > 0 ? c.ink : c.paper}`, background: out > 0 ? c.signal : 'rgba(14,26,43,.85)',
            display: 'grid', placeItems: 'center', color: out > 0 ? c.ink : c.paper, fontFamily: font, fontWeight: 900, fontSize: 25,
            transform: `translateY(${(1 - enter(f, K.problem.pin, 14)) * -70}px) scale(${pop(f, K.problem.pin, 16, 2.4) * (1 + 0.7 * out)})`,
          }}>½</div>
          <div style={{
            position: 'absolute', left: 34, width: 300, top: 14, textAlign: 'left', fontFamily: font, fontWeight: 800, fontSize: 27, lineHeight: 1.1, color: c.paper,
            opacity: enter(f, K.problem.pin + 10, 16) * (1 - out), textShadow: `0 2px 10px ${c.ink}`,
          }}>Punto medio<br />del mapa</div>
        </div>
      )}

      {/* The four friends. */}
      {[0, 1, 2, 3].map((i) => {
        const popIn = pop(f, K.hook.pops[i], 16, 2.6);
        if (popIn <= 0) return null;
        const map = cam.toScreen(ORIGINS[i]);
        const size = lerp(fly, ROW.size[i], MAP_SIZE) * (1 - out);
        const x = lerp(fly, ROW.x[i], map.x);
        const y = lerp(fly, rowY(i), map.y - MAP_SIZE * 0.32);
        const hop = f < K.hook.exit ? -Math.abs(Math.sin((Math.PI * (f + i * 4)) / 15)) * 10 * enter(f, K.hook.pops[3] + 12, 10) : 0;
        const tired = f >= K.problem.tired && i === 3;
        const glance = f >= K.hook.glance && f < K.hook.glance + 26 ? (i % 2 === 0 ? 1 : -1) : 0;
        const yania = cam.toScreen(ORIGINS[3]);
        const lookAtY = f >= K.problem.look && i !== 3 ? Math.sign(yania.x - map.x) : 0;
        const look = { x: (glance || lookAtY) * glide(f, f >= K.problem.look ? K.problem.look : K.hook.glance, 6), y: tired ? 0.3 : 0 };
        const sweat = tired ? ((f - K.problem.tired) % 26) / 26 : 0;
        if (size < 1) return null;
        return (
          <div key={i} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2 + hop + (1 - enter(f, K.hook.pops[i], 14)) * -60, width: size, height: size, transform: `scale(${popIn})` }}>
            <Blob who={i} size={size} blink={blinkOf(i, f)} look={look} mood={tired ? 'tired' : 'open'} squash={f < K.hook.exit ? 0.5 * (1 - enter(f, K.hook.pops[i] + 6, 12)) * enter(f, K.hook.pops[i], 6) : 0} sweat={sweat} />
          </div>
        );
      })}

      {/* Hook: names under the row. */}
      {f < K.hook.exit + 20 && [0, 1, 2, 3].map((i) => (
        <div key={i} style={{
          position: 'absolute', left: ROW.x[i] - 120, width: 240, top: ROW.ground + 26, textAlign: 'center',
          fontFamily: font, fontWeight: 900, fontSize: 40, color: c.paper,
          opacity: enter(f, K.hook.pops[i] + 4, 14) * (1 - leave(f, K.hook.exit - 4, 14)),
          transform: `translateY(${(1 - enter(f, K.hook.pops[i] + 4, 14)) * 16}px)`,
        }}>{NAMES[i]}</div>
      ))}

      {/* Map: who leaves from where, and how long each takes to the midpoint. */}
      {f >= K.problem.labels - 4 && [0, 1, 2, 3].map((i) => {
        const s = cam.toScreen(ORIGINS[i]);
        const show = enter(f, K.problem.labels + i * 6, 16) * (1 - out);
        const p = progress(i);
        const pill = PILL[i];
        const late = i === 3 && f >= yaniaDone;
        const pulse = late ? 1 + 0.12 * Math.max(0, Math.sin(((f - yaniaDone) / 8) * Math.PI)) * (f < yaniaDone + 24 ? 1 : 0) : 1;
        return (
          <React.Fragment key={i}>
            <div style={{
              position: 'absolute', left: s.x - 160, width: 320, top: i === 1 ? s.y + 26 : s.y - MAP_SIZE * 0.32 - MAP_SIZE / 2 - 74, textAlign: 'center',
              fontFamily: font, opacity: show, transform: `translateY(${(1 - show) * 12}px)`, textShadow: `0 2px 8px ${c.ink}, 0 0 2px ${c.ink}`,
            }}>
              <div style={{ fontWeight: 900, fontSize: 30, color: c.paper, lineHeight: 1.05 }}>{NAMES[i]}</div>
              <div style={{ fontWeight: 700, fontSize: 23, color: '#9AABC3', lineHeight: 1.2 }}>{FROM[i]}</div>
            </div>
            {p > 0 && (
              <div style={{
                position: 'absolute', left: s.x + pill.dx, top: s.y + pill.dy - 22, height: 0, width: 0, opacity: (1 - out),
              }}>
                <div style={{
                  position: 'absolute', top: 0, whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 8,
                  ...(pill.align === 'left' ? { left: 0 } : pill.align === 'right' ? { right: 0 } : { left: 0, transform: `translateX(-50%) scale(${pulse})` }),
                  padding: '7px 14px 5px 10px', borderRadius: 999, fontFamily: font, fontWeight: 900, fontSize: 30,
                  background: late ? '#E5352B' : '#13223A', color: c.paper, border: `3px solid ${late ? '#E5352B' : PEOPLE_COLORS[i]}`,
                  boxShadow: '0 6px 18px rgba(0,0,0,.35)',
                }}>
                  <ModeIcon mode={MODES[i]} style={{ width: 28, height: 28, fill: 'none', stroke: c.paper, strokeWidth: 1.9, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
                  <span style={{ fontVariantNumeric: 'tabular-nums' }}>{Math.round(MID_MIN[i] * p)} min</span>
                </div>
              </div>
            )}
          </React.Fragment>
        );
      })}

      {/* Hook title. */}
      {f < K.hook.exit + 16 && (
        <div style={{
          position: 'absolute', left: 60, right: 60, top: 232, textAlign: 'center', fontFamily: font, fontWeight: 900, fontSize: 120,
          lineHeight: 1.0, letterSpacing: '-0.03em', color: c.paper, opacity: 1 - leave(f, K.hook.exit - 2, 14),
          transform: `translateY(${-30 * leave(f, K.hook.exit - 2, 14)}px)`,
        }}>
          <Flip text="¿Quién se come" f={f} at={K.hook.title} />
          <br />
          <Flip text="el viaje?" f={f} at={K.hook.title + 12} />
        </div>
      )}

      <Caption f={f} dark text="El punto medio del mapa engaña." at={K.problem.captionA} out={K.problem.captionB - 12} />
      <Caption f={f} dark text={`Yania tardaría ${MID_MIN[3]} min. Jenny, solo ${MID_MIN[1]}.`} at={K.problem.captionB} out={T.problem.to - 16} />
    </AbsoluteFill>
  );
};

import React from 'react';
import { AbsoluteFill, Img, staticFile } from 'remotion';
import { PEOPLE_COLORS, c, font } from '../look';
import { K, MODES, PLAN } from '../timing';
import { ORIGINS, PLATE, ROUTES_VENUE, S, VENUE, pointAt, sideBySide, type Pt } from '../geo';
import { Blob } from '../ui/Blob';
import { Caption } from '../ui/Caption';
import { MeetPin, ModeIcon } from '../ui/icons';
import { enter, glide, lerp, pop } from '../ui/motion';

// The payoff on the day map: everyone takes their own line and they all arrive at
// the yellow pin at the same time. Then a toast: wine for a dinner, cañas for cañas.

const BEST = S.options[0].times;
const pts = [...ORIGINS, VENUE];
const bb = {
  minX: Math.min(...pts.map((p) => p.x)), maxX: Math.max(...pts.map((p) => p.x)),
  minY: Math.min(...pts.map((p) => p.y)), maxY: Math.max(...pts.map((p) => p.y)),
};
const S0 = 900 / (bb.maxX - bb.minX);
const C0 = { x: (bb.minX + bb.maxX) / 2, y: (bb.minY + bb.maxY) / 2 };
const FOCUS = { x: 540, y: 860 };
const ZOOM = 2.7;

export const dayCamera = (f: number) => {
  const z = glide(f, K.payoff.arrive - 22, 40);
  const s = S0 * lerp(z, 1, ZOOM);
  const cx = lerp(z, C0.x, VENUE.x);
  const cy = lerp(z, C0.y, VENUE.y + 30);
  return { s, z, toScreen: (p: Pt) => ({ x: FOCUS.x + (p.x - cx) * s, y: FOCUS.y + (p.y - cy) * s }), cx, cy };
};

// Each one's route, with its own lane where two share a street (12 px apart before the zoom).
const routes = sideBySide(ROUTES_VENUE.map((r, i) => [ORIGINS[i], ...r, VENUE]), 12 / S0);
const DRINK = PLAN === 'canas' ? 'cana' : 'vino';
// Where each one stands around the pin once there (in units of blob size).
const SPOTS = [{ x: -1.5, y: 0.0 }, { x: -0.72, y: 0.36 }, { x: 0.72, y: 0.36 }, { x: 1.5, y: 0.0 }];
const MAP_SIZE = 92;

export const payoffBlob = (f: number, i: number) => {
  const cam = dayCamera(f);
  const t = glide(f, K.payoff.travel + i * 2, K.payoff.arrive - K.payoff.travel - i * 2);
  const onRoute = cam.toScreen(pointAt(routes[i], t));
  const size = MAP_SIZE * lerp(cam.z, 1, ZOOM * 0.62);
  const pin = cam.toScreen(VENUE);
  const settle = glide(f, K.payoff.arrive - 10, 18);
  const spot = { x: pin.x + SPOTS[i].x * size, y: pin.y + SPOTS[i].y * size - size * 0.2 };
  return { x: lerp(settle, onRoute.x, spot.x), y: lerp(settle, onRoute.y - size * 0.3, spot.y), size, t };
};

export const PayoffScene = ({ f }: { f: number }) => {
  const cam = dayCamera(f);
  const mapIn = enter(f, K.payoff.map + 2, 26);
  const pin = cam.toScreen(VENUE);
  const arrived = f >= K.payoff.arrive;
  const pinSize = 64 * lerp(cam.z, 1, 1.9);
  return (
    <AbsoluteFill style={{ background: c.paper, overflow: 'hidden', opacity: mapIn }}>
      <Img src={staticFile('map-day.png')} style={{
        position: 'absolute', left: FOCUS.x - cam.cx * cam.s, top: FOCUS.y - cam.cy * cam.s, width: PLATE.w * cam.s, height: PLATE.h * cam.s, maxWidth: 'none',
      }} />
      <AbsoluteFill style={{ background: `linear-gradient(${c.paper} 0, ${c.paper} 290px, rgba(240,240,234,0) 460px)` }} />

      <svg width={1080} height={1350} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <g opacity={1 - glide(f, K.payoff.arrive + 4, 16) * 0.75}>
          {[0, 1].map((layer) => routes.map((r, i) => {
            const b = payoffBlob(f, i);
            if (b.t <= 0) return null;
            const d = r.map((q, k) => {
              const s = cam.toScreen(q);
              return `${k ? 'L' : 'M'}${s.x.toFixed(1)} ${s.y.toFixed(1)}`;
            }).join(' ');
            return (
              <path key={`${layer}${i}`} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - b.t} fill="none"
                stroke={layer ? PEOPLE_COLORS[i] : '#FFFFFF'} strokeWidth={(layer ? 11 : 18) * lerp(cam.z, 1, 1.5)} strokeLinecap="round" strokeLinejoin="round" />
            );
          }))}
        </g>
      </svg>

      <div style={{
        position: 'absolute', left: pin.x - pinSize / 2, top: pin.y - pinSize * 54 / 44, width: pinSize,
        transform: `translateY(${(1 - enter(f, K.payoff.map + 10, 16)) * -90}px) scale(${pop(f, K.payoff.map + 10, 16, 2)})`, transformOrigin: '50% 100%',
        filter: 'drop-shadow(0 4px 6px rgba(0,0,0,.3))',
      }}>
        <MeetPin size={pinSize} plan={PLAN} />
      </div>

      {[0, 1, 2, 3].map((i) => {
        const b = payoffBlob(f, i);
        const appear = pop(f, K.payoff.travel - 10 + i * 3, 14, 2.4);
        if (appear <= 0 || f >= K.end.wipe) return null; // the end card carries them from here
        const hop = arrived ? -Math.abs(Math.sin((Math.PI * (f - K.payoff.arrive)) / 15)) * b.size * 0.22 * (f < K.payoff.arrive + 45 ? 1 : 0.5) : -Math.abs(Math.sin((Math.PI * (f + i * 5)) / 7.5)) * 5;
        const cheers = enter(f, K.payoff.cheers, 12);
        const min = Math.round(BEST[i] * b.t);
        return (
          <React.Fragment key={i}>
            <div style={{ position: 'absolute', left: b.x - b.size / 2, top: b.y - b.size / 2 + hop, width: b.size, height: b.size, transform: `scale(${appear})` }}>
              <Blob who={i} size={b.size} mood={arrived ? 'happy' : 'open'} look={{ x: arrived ? 0 : (pin.x > b.x ? 0.6 : -0.6), y: 0 }} glass={cheers} drink={DRINK} squash={arrived ? 0.35 * (1 - enter(f, K.payoff.arrive, 10)) : 0} />
            </div>
            {!arrived && b.t > 0 && (
              <div style={{
                position: 'absolute', left: b.x, top: b.y - b.size * 0.95, transform: 'translateX(-50%)', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: 6,
                padding: '6px 14px 4px 10px', borderRadius: 999, background: '#FFFFFF', border: `4px solid ${PEOPLE_COLORS[i]}`, fontFamily: font, fontWeight: 900, fontSize: 31, color: c.ink,
                boxShadow: '0 4px 12px rgba(14,26,43,.18)', opacity: enter(f, K.payoff.travel, 10) * (1 - glide(f, K.payoff.arrive - 34, 12)), // gone before they bunch up at the pin
              }}>
                <ModeIcon mode={MODES[i]} style={{ width: 28, height: 28, fill: 'none', stroke: c.ink, strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round' }} />
                <span style={{ fontVariantNumeric: 'tabular-nums' }}>{min} min</span>
              </div>
            )}
          </React.Fragment>
        );
      })}

      <Caption f={f} text="Nadie se come el viaje." at={K.payoff.caption} out={K.end.wipe + 6} size={88} />
    </AbsoluteFill>
  );
};

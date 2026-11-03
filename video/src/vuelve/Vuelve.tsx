import React from 'react';
import { AbsoluteFill, Audio, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { c, font, mono } from '../look';
import { Fonts, Grain } from '../ui/Base';
import { Blob, type Mood } from '../ui/Blob';
import { Caption } from '../ui/Caption';
import { Flip, Mark } from '../ui/Mark';
import { HeartIcon } from '../ui/icons';
import { QR } from '../ui/QR';
import { enter, glide, leave, lerp, lin, pop } from '../ui/motion';
import { SKYLINE } from '../scenes/End';
import { FREE_ROUTES, IMPRESSIONS, ROUTES, V_TOTAL, VK, VT } from './timing';

// The relaunch clip: it went viral, Google's free quota ran out in hours, it was paused,
// and it is back, built so it can't cost money. Night for the problem, the light comes
// out of the sign when it flips to "HA VUELTO", and the night closes on the end card.
// Carriers: the quota bar, the hanging sign (its letters flip like a station board and
// the light grows out of it) and the four friends, who jump onto the end card's skyline.

const W = 1080;
const H = 1350;

// "23.000", with the dot on every thousand (es-ES leaves 4-digit numbers ungrouped).
const thousands = (n: number) => String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');

// A count that rushes up and lands softly on its exact value.
const count = (f: number, [a, b]: [number, number], target: number) => target * enter(f, a, b - a);

// The routes rush straight through the free 10.000 on a beat, then creep past it.
const OVERFLOW = VK.viral.overflow;
const routesAt = (f: number) => {
  const [a, b] = VK.viral.routesCount;
  return f < OVERFLOW ? FREE_ROUTES * lin(f, a, OVERFLOW - a) : FREE_ROUTES + (ROUTES - FREE_ROUTES) * enter(f, OVERFLOW, b - OVERFLOW);
};

/* ---------- The four friends ---------- */

const BLOB_X = [270, 450, 630, 810];
const BLOB_Y = 1150;
const BLOB_SIZE = 150;
const END_X = [366, 488, 610, 732];
const END_Y = 1092;
const END_SIZE = 112;

const Friends = ({ f }: { f: number }) => {
  const { pops } = VK.viral;
  const carry = glide(f, VK.end.night, 36);
  const mood: Mood = f >= VK.back.flip ? 'happy' : f >= VK.build.lookUp ? 'open' : f >= VT.pause.from ? 'tired' : f >= OVERFLOW ? 'wide' : 'happy';
  return (
    <>
      {[0, 1, 2, 3].map((i) => {
        const p = pop(f, pops[i], 16, 2.4);
        // Bouncing on the beat while it is a party; still and sagging during the pause.
        const party = (f < VT.pause.from && f >= pops[i] + 10) || (f >= VK.back.flip + 10 && f < VK.end.night);
        const hop = party ? -Math.abs(Math.sin((Math.PI * (f + i * 4)) / 15)) * 16 : 0;
        const sag = f >= VT.pause.from && f < VK.back.flip ? 0.35 * enter(f, VT.pause.from, 20) * (1 - enter(f, VK.build.lookUp, 20)) : 0;
        const size = lerp(carry, BLOB_SIZE, END_SIZE);
        const x = lerp(carry, BLOB_X[i], END_X[i]);
        const y = lerp(carry, BLOB_Y, END_Y) + Math.sin(Math.PI * carry) * -150;
        const endBob = carry >= 1 ? -Math.abs(Math.sin((Math.PI * (f + i * 4)) / 15)) * 9 : 0;
        const look = f >= VK.build.lookUp && f < VK.back.flip ? { x: (540 - BLOB_X[i]) / 400, y: -1 } : f >= VK.viral.routes && f < VT.pause.from ? { x: 0, y: -0.8 } : { x: 0, y: 0 };
        const sweat = f >= VK.pause.sweat && f < VK.build.lookUp ? Math.min(1, (f - VK.pause.sweat) / 50) : 0;
        return (
          <div key={i} style={{
            position: 'absolute', left: x - size / 2, top: y - size / 2 + hop + endBob, width: size, height: size,
            transform: `scale(${p})`, transformOrigin: '50% 92%',
          }}>
            <Blob who={i} size={size} mood={mood} look={look} squash={sag} sweat={sweat} blink={(f + i * 37) % 90 < 4 ? 1 : 0} />
          </div>
        );
      })}
    </>
  );
};

/* ---------- Viral: two counters and the free quota bar ---------- */

const Stat = ({ f, at, value, label, top, out }: { f: number; at: number; value: number; label: string; top: number; out: number }) => {
  const t = enter(f, at, 20);
  const o = leave(f, out, 14);
  if (t <= 0 || o >= 1) return null;
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, top, textAlign: 'center', opacity: t * (1 - o), transform: `translateY(${(1 - t) * 30 - o * 40}px)` }}>
      <div style={{ fontFamily: font, fontWeight: 900, fontSize: 168, lineHeight: 1, letterSpacing: '-0.035em', color: c.paper, fontVariantNumeric: 'tabular-nums' }}>
        {thousands(value)}
      </div>
      <div style={{ fontFamily: font, fontWeight: 800, fontSize: 48, lineHeight: 1.1, color: c.nightText, marginTop: 6 }}>{label}</div>
    </div>
  );
};

const BAR = { left: 150, width: 700, top: 842, height: 44 };

const QuotaBar = ({ f }: { f: number }) => {
  const t = enter(f, VK.viral.routes + 6, 20);
  const out = leave(f, VK.pause.barOut, 30);
  if (t <= 0 || out >= 1) return null;
  const v = routesAt(f);
  const over = f >= OVERFLOW;
  const shake = over && f < OVERFLOW + 14 ? Math.sin((f - OVERFLOW) * 2.4) * 10 * (1 - (f - OVERFLOW) / 14) : 0;
  const fill = (v / FREE_ROUTES) * BAR.width;
  return (
    <div style={{ position: 'absolute', left: BAR.left + shake, top: BAR.top, width: BAR.width, opacity: t * (1 - out), transform: `translateY(${out * 60}px)` }}>
      <div style={{ position: 'absolute', left: 0, top: -58, fontFamily: font, fontWeight: 800, fontSize: 34, color: c.nightText }}>Gratis al mes: 10.000</div>
      <div style={{ position: 'absolute', left: 0, top: 0, width: BAR.width, height: BAR.height, borderRadius: BAR.height / 2, background: c.night2 }} />
      <div style={{
        position: 'absolute', left: 0, top: 0, width: Math.max(BAR.height, fill), height: BAR.height, borderRadius: BAR.height / 2,
        background: over ? '#E5352B' : c.paper, boxShadow: over ? '0 0 0 6px rgba(229,53,43,.25)' : 'none',
      }} />
      {/* Where the free part ends: the overflow sticks out past it. */}
      <div style={{ position: 'absolute', left: BAR.width - 3, top: -12, width: 6, height: BAR.height + 24, borderRadius: 3, background: c.nightText }} />
      <div style={{
        position: 'absolute', right: 0, top: BAR.height + 18, fontFamily: font, fontWeight: 900, fontSize: 40, color: '#FF6A5C', letterSpacing: '0.04em',
        transform: `scale(${pop(f, OVERFLOW + 2, 14, 2.6)})`, transformOrigin: '100% 0',
      }}>AGOTADO</div>
    </div>
  );
};

/* ---------- The hanging sign ---------- */

const SIGN = { w: 780, h: 230 };
const SIGN_TOP = 170;

const HangingSign = ({ f }: { f: number }) => {
  const { sign } = VK.pause;
  if (f < sign) return null;
  const drop = Math.min(1.08, pop(f, sign, 22, 1.6));
  const up = glide(f, VK.back.up, 24);
  // The top edge, where the cords hold it: high up while it hangs (the text goes under it), then the header.
  const top = lerp(up, lerp(drop, -300, SIGN_TOP), 97);
  const scale = lerp(up, 1, 0.68);
  // It swings after the drop, shivers before the flip and settles once it is back.
  const t = f - sign;
  const swing = 7 * Math.exp(-0.05 * t) * Math.sin(0.22 * t);
  const shiver = f >= VK.build.shake && f < VK.back.flip ? Math.sin(f * 1.9) * 1.6 * ((f - VK.build.shake) / 30) : 0;
  const rot = (swing + shiver) * (1 - up);
  const flipped = f >= VK.back.flip;
  return (
    <>
      {/* The two cords from the top edge. */}
      <svg width={W} height={H} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
        {[-1, 1].map((s) => {
          const ax = 540 + s * 250 * scale;
          const rad = (rot * Math.PI) / 180;
          const bx = 540 + Math.cos(rad) * s * 250 * scale;
          const by = top + Math.sin(rad) * s * 250 * scale;
          return <line key={s} x1={ax} y1={-10} x2={bx} y2={by + 6} stroke={flipped ? c.ink2 : '#3A5175'} strokeWidth={5} strokeLinecap="round" />;
        })}
      </svg>
      <div style={{
        position: 'absolute', left: 540 - SIGN.w / 2, top, width: SIGN.w, height: SIGN.h,
        transform: `scale(${scale}) rotate(${rot}deg)`, transformOrigin: '50% 0%',
        background: c.signal, borderRadius: 26, boxShadow: '0 18px 0 rgba(0,0,0,.18), inset 0 0 0 8px #0E1A2B',
        display: 'grid', placeItems: 'center',
      }}>
        <div style={{ fontFamily: font, fontWeight: 900, fontSize: 124, lineHeight: 1, letterSpacing: '-0.02em', color: c.ink, paddingTop: 14, whiteSpace: 'nowrap' }}>
          {flipped
            ? <Flip text="HA VUELTO" f={f} at={VK.back.flip} stagger={1.6} dur={12} />
            : <Flip text="EN PAUSA" f={f} at={sign + 4} stagger={1.6} dur={12} />}
        </div>
      </div>
    </>
  );
};

/* ---------- Back: three promises ---------- */

const ICONS = [
  // A shield with a tick: a free quota every day.
  <><path d="M12 3l7 3v5c0 4.6-3 8.4-7 10-4-1.6-7-5.4-7-10V6z" /><path d="M9 12l2 2 4-4" /></>,
  // A bell: a notice, not a bill.
  <><path d="M6 16v-5a6 6 0 0 1 12 0v5l1.5 2h-15z" /><path d="M10 20.5a2 2 0 0 0 4 0" /></>,
  // Power: at 1 € it switches itself off.
  <><path d="M12 3v8" /><path d="M7.1 6.6a7 7 0 1 0 9.8 0" /></>,
];
const PROMISES = ['Cupo diario gratis', 'Aviso, no factura', 'A 1 €, se apaga solo'];

const Promise = ({ f, i }: { f: number; i: number }) => {
  const at = VK.back.cards[i];
  const t = enter(f, at, 22);
  const o = leave(f, VK.back.out, 12);
  if (t <= 0 || o >= 1) return null;
  return (
    <div style={{
      position: 'absolute', left: 90, width: 900, top: 470 + i * 142, height: 118, borderRadius: 30, background: c.panel,
      boxShadow: '0 2px 0 rgba(14,26,43,.06), 0 10px 30px rgba(14,26,43,.10)', display: 'flex', alignItems: 'center', gap: 30, paddingLeft: 26,
      opacity: t * (1 - o), transform: `translateX(${(1 - t) * 120}px)`, boxSizing: 'border-box',
    }}>
      <div style={{ width: 74, height: 74, borderRadius: '50%', background: c.ink, display: 'grid', placeItems: 'center', transform: `scale(${pop(f, at + 4, 14, 2.4)})`, flex: 'none' }}>
        <svg width={44} height={44} viewBox="0 0 24 24" fill="none" stroke={c.paper} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">{ICONS[i]}</svg>
      </div>
      <div style={{ fontFamily: font, fontWeight: 900, fontSize: 56, letterSpacing: '-0.02em', color: c.ink, paddingTop: 8 }}>{PROMISES[i]}</div>
    </div>
  );
};

/* ---------- The end card ---------- */

const rise = (f: number, at: number): React.CSSProperties => {
  const t = enter(f, at, 22);
  return { opacity: t, transform: `translateY(${(1 - t) * 22}px)` };
};

const EndCard = ({ f }: { f: number }) => {
  const e = VK.end;
  if (f < e.night) return null;
  const sky = glide(f, e.lockup, 60);
  return (
    <>
      <svg width={W} height={300} viewBox="0 0 1080 300" style={{ position: 'absolute', left: 0, top: END_Y + END_SIZE * 0.35 - 280, opacity: enter(f, e.lockup, 20) }}>
        {SKYLINE.map((d, k) => (
          <path key={k} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0, Math.min(1, sky * 1.6 - k * 0.02))} fill="none" stroke="#3A5175" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>
      <div style={{
        position: 'absolute', left: (W - 264 * 2.5) / 2, top: 118, width: 358, display: 'grid', gridTemplateColumns: '50px minmax(0, 1fr)', alignItems: 'center',
        columnGap: 14, transform: 'scale(2.5)', transformOrigin: '0 0', fontFamily: font,
      }}>
        <Mark size={50} square={pop(f, e.lockup, 16, 2)} lines={[0, 1, 2].map((k) => glide(f, e.lockup + 8 + k * 4, 14))} dot={pop(f, e.lockup + 24, 12, 3)} />
        <h1 style={{ margin: 0, fontWeight: 900, fontSize: 39, lineHeight: 0.94, letterSpacing: '-.025em', color: c.paper, maxWidth: 294 }}>
          <Flip text="¿Dónde" f={f} at={e.lockup + 10} stagger={1.4} />
          <br />
          <Flip text="quedamos?" f={f} at={e.lockup + 16} stagger={1.4} />
        </h1>
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center', fontFamily: mono, fontWeight: 700, fontSize: 54, color: c.paper, letterSpacing: '-0.01em', ...rise(f, e.url) }}>
        dondequedamos.app
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 440, textAlign: 'center', fontFamily: font, fontWeight: 800, fontSize: 40, color: '#A9B8CC', ...rise(f, e.tag) }}>
        Toda España<Dot />Gratis<Dot />Sin registro
      </div>
      <div style={{
        position: 'absolute', left: 540 - 130, top: 528, width: 260, height: 260, borderRadius: 26, background: c.paper, display: 'grid', placeItems: 'center',
        transform: `scale(${pop(f, e.qr, 16, 1.8)})`,
      }}>
        <QR text="https://dondequedamos.app" size={228} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1194, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, fontFamily: font, fontWeight: 900, fontSize: 40, color: c.paper, ...rise(f, e.terreta) }}>
        Fet a la terreta
        <HeartIcon style={{ width: 40, height: 40, fill: '#E5352B', stroke: '#E5352B', strokeWidth: 1.8 }} />
      </div>
    </>
  );
};

const Dot = () => <span style={{ display: 'inline-block', width: '0.2em', height: '0.2em', margin: '0 0.42em', borderRadius: '50%', background: '#A9B8CC', verticalAlign: '0.2em' }} />;

/* ---------- The film ---------- */

export const Vuelve = ({ music = true }: { music?: boolean }) => {
  const f = useCurrentFrame();
  const light = enter(f, VK.back.light, 34); // the paper grows out of the sign
  const night = enter(f, VK.end.night, 32); // and the night closes in from the friends
  return (
    <AbsoluteFill style={{ background: c.ink, overflow: 'hidden' }}>
      <Fonts />
      {f >= VK.back.light && (
        <div style={{ position: 'absolute', left: 540 - 1700 * light, top: SIGN_TOP + SIGN.h / 2 - 1700 * light, width: 3400 * light, height: 3400 * light, borderRadius: '50%', background: c.paper }} />
      )}
      {/* Viral */}
      <Caption f={f} text="Se hizo viral." at={VK.viral.title} out={VK.viral.titleOut} dark size={88} top={92} />
      <Stat f={f} at={VK.viral.imp} value={count(f, VK.viral.impCount, IMPRESSIONS)} label="impresiones" top={250} out={VK.viral.out} />
      <Stat f={f} at={VK.viral.routes} value={routesAt(f)} label="rutas en un día" top={520} out={VK.viral.out} />
      <QuotaBar f={f} />

      {/* Pause */}
      <Caption f={f} text="Se acabó el cupo gratis de Google." at={VK.pause.caption} out={VK.pause.captionOut} dark size={76} top={560} highlight={['gratis']} hlColor="#FF6A5C" />
      <Caption f={f} text="Unos días después…" at={VK.build.caption} out={VK.build.captionOut} dark size={64} top={600} />

      {/* Back */}
      <Caption f={f} text="Y ya no puede costarme dinero:" at={VK.back.caption} out={VK.back.out} size={64} top={318} />
      {[0, 1, 2].map((i) => <Promise key={i} f={f} i={i} />)}

      <HangingSign f={f < VK.end.night + 34 ? f : -1} />
      {f >= VK.end.night && (
        <div style={{ position: 'absolute', left: 540 - 1900 * night, top: BLOB_Y - 1900 * night, width: 3800 * night, height: 3800 * night, borderRadius: '50%', background: c.ink }} />
      )}
      <Friends f={f} />
      <EndCard f={f} />
      <Grain />
      {music && (
        <Audio
          src={staticFile('music-vuelve.wav')}
          volume={(fr) => interpolate(fr, [V_TOTAL - 36, V_TOTAL - 1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })}
        />
      )}
    </AbsoluteFill>
  );
};


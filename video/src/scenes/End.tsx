import React from 'react';
import { AbsoluteFill } from 'remotion';
import { c, font, mono } from '../look';
import { K, PLAN } from '../timing';
import { Blob } from '../ui/Blob';
import { Mark, Flip } from '../ui/Mark';
import { HeartIcon } from '../ui/icons';
import { QR } from '../ui/QR';
import { enter, glide, leave, lerp, pop } from '../ui/motion';
import { dayCamera, payoffBlob } from './Payoff';
import { VENUE } from '../geo';

// The end card, like Aparcat's: logo, address, QR, free, made here. The night comes
// back from the meeting pin and the four friends carry the cut, landing on the skyline.

const ROW_X = [366, 488, 610, 732];
const ROW_Y = 1092;
const ROW_SIZE = 112;

// València in one line: a palm, the Torres de Serranos, the Micalet and the cathedral
// dome, l'Hemisfèric, another palm. Drawn on a 1080 x 300 box, ground at y = 280.
const crenel = (x0: number, x1: number, y: number) => {
  let d = `M${x0} 280V${y}`;
  for (let x = x0; x < x1; x += 20) d += `h10v-10h10v10`;
  return `${d}V280`;
};
const SKYLINE = [
  'M0 280H1080',
  'M78 280C80 236 86 196 100 160', 'M100 160C88 150 70 152 56 164', 'M100 160C92 142 78 134 62 136', 'M100 160C104 140 116 130 134 130', 'M100 160C114 152 130 156 142 170',
  crenel(166, 236, 150), crenel(296, 366, 150), 'M236 280V186H296V280', 'M252 280V236Q266 214 280 236V280', 'M190 200V216M212 200V216M320 200V216M342 200V216',
  'M470 280V96H522V280', 'M464 96H528', 'M480 96V76H512V96', 'M486 76L496 58L506 76', 'M484 130V150M508 130V150M484 190V210M508 190V210',
  'M548 280V206H648V280', 'M552 206Q598 136 644 206', 'M592 160V146H604V160',
  'M708 262Q822 168 936 262', 'M708 262Q822 300 936 262', 'M822 254m-26 0a26 26 0 1 0 52 0a26 26 0 1 0-52 0', 'M700 280H944',
  'M1004 280C1002 236 996 196 982 160', 'M982 160C994 150 1012 152 1026 164', 'M982 160C990 142 1004 134 1020 136', 'M982 160C978 140 966 130 948 130', 'M982 160C968 152 952 156 940 170',
];

export const EndScene = ({ f }: { f: number }) => {
  const from = dayCamera(K.end.wipe).toScreen(VENUE);
  const night = enter(f, K.end.wipe, 30);
  const carry = glide(f, K.end.wipe, 36);
  const sky = glide(f, K.end.lockup, 70);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: from.x, top: from.y, width: 0, height: 0 }}>
        <div style={{ position: 'absolute', left: -1900 * night, top: -1900 * night, width: 3800 * night, height: 3800 * night, borderRadius: '50%', background: c.ink }} />
      </div>

      <svg width={1080} height={300} viewBox="0 0 1080 300" style={{ position: 'absolute', left: 0, top: ROW_Y + ROW_SIZE * 0.35 - 280, opacity: enter(f, K.end.lockup, 20) }}>
        {SKYLINE.map((d, k) => (
          <path key={k} d={d} pathLength={1} strokeDasharray="1 1" strokeDashoffset={1 - Math.max(0, Math.min(1, sky * 1.6 - k * 0.02))} fill="none" stroke="#3A5175" strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        ))}
      </svg>

      {/* Logo lockup, on the night ground. */}
      <div style={{
        position: 'absolute', left: (1080 - 264 * 2.5) / 2, top: 118, width: 358, display: 'grid', gridTemplateColumns: '50px minmax(0, 1fr)', alignItems: 'center',
        columnGap: 14, transform: 'scale(2.5)', transformOrigin: '0 0', fontFamily: font,
      }}>
        <Mark size={50} square={pop(f, K.end.lockup, 16, 2)} lines={[0, 1, 2].map((k) => glide(f, K.end.lockup + 8 + k * 4, 14))} dot={pop(f, K.end.lockup + 24, 12, 3)} />
        <h1 style={{ margin: 0, fontWeight: 900, fontSize: 39, lineHeight: 0.94, letterSpacing: '-.025em', color: c.paper, maxWidth: 294 }}>
          <Flip text="¿Dónde" f={f} at={K.end.lockup + 10} stagger={1.4} />
          <br />
          <Flip text="quedamos?" f={f} at={K.end.lockup + 16} stagger={1.4} />
        </h1>
      </div>

      <div style={{ position: 'absolute', left: 0, right: 0, top: 360, textAlign: 'center', fontFamily: mono, fontWeight: 700, fontSize: 54, color: c.paper, letterSpacing: '-0.01em', ...riseStyle(f, K.end.url) }}>
        dondequedamos.app
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 440, textAlign: 'center', fontFamily: font, fontWeight: 700, fontSize: 38, color: '#A9B8CC', ...riseStyle(f, K.end.tag) }}>
        El sitio más justo para quedar.
      </div>

      <div style={{
        position: 'absolute', left: 540 - 130, top: 520, width: 260, height: 260, borderRadius: 26, background: c.paper, display: 'grid', placeItems: 'center',
        transform: `scale(${pop(f, K.end.qr, 16, 1.8)})`,
      }}>
        <QR text="https://dondequedamos.app" size={228} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 806, textAlign: 'center', fontFamily: font, fontWeight: 900, fontSize: 40, color: c.paper, ...riseStyle(f, K.end.free) }}>
        Gratis<span style={{ display: 'inline-block', width: '0.2em', height: '0.2em', margin: '0 0.38em', borderRadius: '50%', background: c.paper, verticalAlign: '0.22em' }} />sin registro
      </div>

      {[0, 1, 2, 3].map((i) => {
        const p = payoffBlob(K.end.wipe, i);
        const size = lerp(carry, p.size, ROW_SIZE);
        const x = lerp(carry, p.x, ROW_X[i]);
        const y = lerp(carry, p.y, ROW_Y);
        const arc = Math.sin(Math.PI * carry) * -120;
        const bob = carry >= 1 ? -Math.abs(Math.sin((Math.PI * (f + i * 4)) / 15)) * 9 : 0;
        return (
          <div key={i} style={{ position: 'absolute', left: x - size / 2, top: y - size / 2 + arc + bob, width: size, height: size }}>
            <Blob who={i} size={size} mood="happy" glass={1 - enter(f, K.end.wipe, 14)} drink={PLAN === 'canas' ? 'cana' : 'vino'} />
          </div>
        );
      })}

      <div style={{ position: 'absolute', left: 0, right: 0, top: 1194, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12, fontFamily: font, fontWeight: 900, fontSize: 40, color: c.paper, ...riseStyle(f, K.end.terreta) }}>
        Fet a la terreta
        <HeartIcon style={{ width: 40, height: 40, fill: '#E5352B', stroke: '#E5352B', strokeWidth: 1.8 }} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 1290, textAlign: 'center', fontFamily: font, fontWeight: 600, fontSize: 19, color: '#6F819B', ...riseStyle(f, K.end.credits) }}>
        Mapas: OpenFreeMap · © colaboradores de OpenStreetMap · Datos de la demo simulados
      </div>
    </AbsoluteFill>
  );
};

const riseStyle = (f: number, at: number): React.CSSProperties => {
  const t = enter(f, at, 22);
  return { opacity: t * (1 - leave(f, 1800, 10)), transform: `translateY(${(1 - t) * 22}px)` };
};

import React from 'react';
import { AbsoluteFill, staticFile } from 'remotion';

// Offline fonts, copied from @fontsource into public/fonts/.
const faces = [
  ['Overpass', 400, 'overpass-latin-400-normal.woff2'],
  ['Overpass', 600, 'overpass-latin-600-normal.woff2'],
  ['Overpass', 700, 'overpass-latin-700-normal.woff2'],
  ['Overpass', 800, 'overpass-latin-800-normal.woff2'],
  ['Overpass', 900, 'overpass-latin-900-normal.woff2'],
  ['Overpass Mono', 600, 'overpass-mono-latin-600-normal.woff2'],
  ['Overpass Mono', 700, 'overpass-mono-latin-700-normal.woff2'],
] as const;

// The app's own stylesheet drives the phone screens; its CSS animations run on
// the wall clock, so inside the phone every movement comes from the frame instead.
export const Fonts = () => (
  <style>
    {faces
      .map(([family, weight, file]) => `@font-face{font-family:"${family}";font-weight:${weight};font-style:normal;src:url(${staticFile(`fonts/${file}`)}) format("woff2");}`)
      .join('\n')}
    {'.dq-phone{--font-overpass:"Overpass";}.dq-phone *{animation:none!important;transition:none!important;}'}
  </style>
);

// Fine static grain over everything, so flat colour reads as print.
export const Grain = ({ opacity = 0.04 }: { opacity?: number }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'multiply', opacity }}>
    <svg width="100%" height="100%">
      <filter id="grain">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed="7" />
        <feColorMatrix type="saturate" values="0" />
      </filter>
      <rect width="100%" height="100%" filter="url(#grain)" />
    </svg>
  </AbsoluteFill>
);

// A finger tap: a soft disc that presses in and a ring that ripples out.
export const Tap = ({ f, at, x, y, scale = 1 }: { f: number; at: number; x: number; y: number; scale?: number }) => {
  const t = f - at;
  if (t < -8 || t > 22) return null;
  const press = t < 0 ? (t + 8) / 8 : Math.max(0, 1 - t / 14);
  const ring = Math.max(0, Math.min(1, t / 18));
  return (
    <div style={{ position: 'absolute', left: x, top: y, width: 0, height: 0, pointerEvents: 'none', zIndex: 500 }}>
      <div style={{
        position: 'absolute', left: -30 * scale, top: -30 * scale, width: 60 * scale, height: 60 * scale, borderRadius: '50%',
        background: 'rgba(255,255,255,.55)', boxShadow: `0 0 0 ${3 * scale}px rgba(14,26,43,.38), 0 4px 14px rgba(14,26,43,.25)`,
        transform: `scale(${0.7 + 0.3 * press})`, opacity: press,
      }} />
      {t >= 0 && (
        <div style={{
          position: 'absolute', left: -30 * scale, top: -30 * scale, width: 60 * scale, height: 60 * scale, borderRadius: '50%',
          border: `${3 * scale}px solid rgba(255,255,255,.85)`, boxShadow: `0 0 0 ${2 * scale}px rgba(14,26,43,.3)`,
          transform: `scale(${1 + ring * 0.9})`, opacity: 1 - ring,
        }} />
      )}
    </div>
  );
};

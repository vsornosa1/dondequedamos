import React from 'react';
import { PEOPLE_COLORS, c, font } from '../look';
import { MODES, NAMES, PLAN } from '../timing';
import { S } from '../geo';
import { MODE_TXT, planTxt } from '../ui/icons';
import { Mark } from '../ui/Mark';
import { STATUS_H } from '../ui/Phone';

// A neutral group chat (no real messenger's branding), with the exact message the app
// writes in Planner.shareData() and its link preview from app/p/[data]/opengraph-image.tsx.
const best = S.options[0];

const Preview = () => {
  const max = Math.max(10, ...best.times);
  return (
    <div style={{ width: 1200, height: 630, display: 'flex', background: c.paper, fontFamily: font, color: c.ink, transform: 'scale(0.2133)', transformOrigin: '0 0' }}>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 560, padding: '56px 52px', background: c.signal, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, fontWeight: 800 }}><Mark size={58} />¿Quedamos aquí?</div>
        <div style={{ fontSize: 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -2 }}>{best.name}</div>
        <div style={{ fontSize: 28, fontWeight: 800 }}>El sitio más justo para todos</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '40px 60px 40px 44px' }}>
        <div style={{ fontSize: 28, fontWeight: 600, marginBottom: 18, color: c.ink2 }}>Lo que tarda cada uno</div>
        <div style={{ display: 'flex', flexDirection: 'column', width: 540, position: 'relative' }}>
          {best.times.map((min, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', height: 64 }}>
              <div style={{ width: 190, fontSize: 30, fontWeight: 800 }}>{NAMES[i]}</div>
              <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
                <div style={{ whiteSpace: 'nowrap', fontSize: 26, fontWeight: 800, marginRight: 14 }}>{min} min</div>
                <div style={{ width: 22, height: 22, borderRadius: 11, border: `6px solid ${PEOPLE_COLORS[i]}`, background: '#fff', boxSizing: 'border-box' }} />
                <div style={{ width: Math.max(30, Math.round((min / max) * 220)), height: 10, background: PEOPLE_COLORS[i], borderRadius: 5, marginLeft: -4 }} />
              </div>
            </div>
          ))}
          <div style={{ position: 'absolute', right: -16, top: 6, bottom: 6, width: 26, borderRadius: 13, background: c.signal, border: `5px solid ${c.ink}`, boxSizing: 'border-box' }} />
        </div>
      </div>
    </div>
  );
};

const Bubble = ({ who, text, t }: { who: number; text: string; t: number }) => (
  <div style={{ display: 'flex', marginTop: 8, opacity: Math.min(1, t * 2), transform: `translateY(${(1 - t) * 18}px) scale(${0.92 + 0.08 * t})`, transformOrigin: '0 100%' }}>
    <div style={{ maxWidth: 290, padding: '7px 12px 8px', borderRadius: '4px 16px 16px 16px', background: '#FFFFFF', boxShadow: '0 1px 1px rgba(14,26,43,.12)' }}>
      <div style={{ fontSize: 14, fontWeight: 800, color: PEOPLE_COLORS[who] }}>{NAMES[who]}</div>
      <div style={{ fontSize: 17, lineHeight: 1.35, fontWeight: 400 }}>{text}</div>
    </div>
  </div>
);

export const REPLIES = [
  { who: 1, text: '¡Hecho! 🙌' },
  { who: 2, text: 'Me pilla perfecto 👌' },
  { who: 3, text: 'Por fin no me como yo el viaje 😂' },
];

export const ChatScreen = ({ sent, replies, scroll }: { sent: number; replies: number[]; scroll: number }) => (
  <div style={{ position: 'absolute', inset: 0, background: '#E9E5DC', fontFamily: font, color: c.ink }}>
    <div style={{ position: 'absolute', left: 0, right: 0, top: STATUS_H, height: 62, display: 'flex', alignItems: 'center', gap: 10, padding: '0 14px 0 8px', background: '#F7F6F1', borderBottom: `1px solid ${c.rule}`, zIndex: 2 }}>
      <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke={c.ink} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M15 5l-7 7 7 7" /></svg>
      <div style={{ width: 40, height: 40, borderRadius: '50%', background: c.tint, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3, padding: 9, boxSizing: 'border-box' }}>
        {PEOPLE_COLORS.map((col) => <span key={col} style={{ borderRadius: '50%', background: col }} />)}
      </div>
      <div>
        <div style={{ fontSize: 18, fontWeight: 800, lineHeight: 1.2 }}>Los de siempre</div>
        <div style={{ fontSize: 13, color: c.ink2 }}>Vicent, Jenny, Ángel, Yania</div>
      </div>
    </div>
    <div style={{ position: 'absolute', left: 0, right: 0, top: STATUS_H + 62, bottom: 0, overflow: 'hidden' }}>
      <div style={{ padding: '14px 12px', transform: `translateY(${-scroll}px)` }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}>
          <span style={{ padding: '3px 10px', borderRadius: 8, background: '#F7F6F1', fontSize: 12, fontWeight: 700, color: c.ink2 }}>HOY</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', opacity: Math.min(1, sent * 2), transform: `translateY(${(1 - sent) * 40}px) scale(${0.9 + 0.1 * sent})`, transformOrigin: '100% 100%' }}>
          <div style={{ width: 290, padding: 5, borderRadius: '16px 4px 16px 16px', background: '#DDF3D2', boxShadow: '0 1px 1px rgba(14,26,43,.12)' }}>
            <div style={{ width: 280, height: 147, borderRadius: 11, overflow: 'hidden' }}><Preview /></div>
            <div style={{ padding: '6px 6px 2px', fontSize: 15, lineHeight: 1.38 }}>
              <div style={{ fontWeight: 800 }}>📍 ¿Quedamos en {best.name} para {planTxt(PLAN)}?</div>
              <div style={{ marginTop: 6 }}>⏱️ Lo que tarda cada uno:</div>
              {best.times.map((min, i) => <div key={i}>• {NAMES[i]}: {min} min {MODE_TXT[MODES[i]]}</div>)}
              <div style={{ marginTop: 6 }}>Es el sitio más justo para todos: <span style={{ color: '#1F6FD1', textDecoration: 'underline' }}>dondequedamos.app/p/k3Rw9Tq</span></div>
              <div style={{ textAlign: 'right', fontSize: 11, color: c.ink2, marginTop: 2 }}>19:44 ✓✓</div>
            </div>
          </div>
        </div>
        {REPLIES.map((r, k) => replies[k] > 0 && <Bubble key={k} who={r.who} text={r.text} t={replies[k]} />)}
      </div>
    </div>
  </div>
);

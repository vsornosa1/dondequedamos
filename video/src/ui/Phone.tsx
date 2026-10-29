import React from 'react';
import { c, font } from '../look';

// A phone rising from the bottom edge of the frame, cropped by it. The screen is the
// app's real width (390 CSS px) and the visible height is whatever the frame leaves.
export const PHONE = { w: 390, bezel: 12, scale: 1.6, top: 296 };
export const SCREEN = {
  left: 540 - (PHONE.w / 2) * PHONE.scale,
  top: PHONE.top + PHONE.bezel * PHONE.scale,
  h: Math.round((1350 - PHONE.top - PHONE.bezel * PHONE.scale) / PHONE.scale), // visible CSS height
};
export const STATUS_H = 40;
export const URL_H = 44;
export const CHROME_H = STATUS_H + URL_H;

// Screen CSS px -> frame px, for anything drawn over the phone (taps, callouts, flights).
export const toFrame = (x: number, y: number) => ({ x: SCREEN.left + x * PHONE.scale, y: SCREEN.top + y * PHONE.scale });

type Cam = { s?: number; x?: number; y?: number }; // extra zoom around a frame point, plus a pan

export const Phone = ({ children, cam = {}, y = 0, url = 'dondequedamos.app', time = '19:42', chrome = true }: {
  children: React.ReactNode; cam?: Cam; y?: number; url?: string; time?: string; chrome?: boolean;
}) => {
  const s = cam.s ?? 1;
  const ox = cam.x ?? 540;
  const oy = cam.y ?? 700;
  const outerW = (PHONE.w + PHONE.bezel * 2) * PHONE.scale;
  const height = 1600; // taller than the frame: the bottom edge always crops it
  return (
    <div style={{ position: 'absolute', inset: 0, transform: `translate(${ox}px, ${oy}px) scale(${s}) translate(${-ox}px, ${-oy}px) translateY(${y}px)`, transformOrigin: '0 0' }}>
      <div style={{
        position: 'absolute', left: 540 - outerW / 2, top: PHONE.top, width: outerW, height,
        borderRadius: 58 * PHONE.scale, background: '#11151B',
        boxShadow: '0 40px 80px rgba(14,26,43,.28), 0 8px 24px rgba(14,26,43,.18), inset 0 0 0 3px #2A3038',
      }} />
      <div className="dq-phone" style={{
        position: 'absolute', left: SCREEN.left, top: SCREEN.top, width: PHONE.w, height: SCREEN.h + 1,
        transform: `scale(${PHONE.scale})`, transformOrigin: '0 0', borderRadius: '46px 46px 0 0', overflow: 'hidden',
        background: c.paper, fontFamily: font, color: c.ink,
      }}>
        <div style={{ position: 'absolute', inset: 0, transform: 'translateZ(0)', overflow: 'hidden' }}>
          {children}
          {chrome && <Chrome url={url} time={time} />}
        </div>
      </div>
    </div>
  );
};

// Status bar and the browser's address bar: it is a web app, so the URL is part of the story.
const Chrome = ({ url, time }: { url: string; time: string }) => (
  <div style={{ position: 'absolute', left: 0, top: 0, width: PHONE.w, height: url ? CHROME_H : STATUS_H, background: url ? c.paper : '#F7F6F1', zIndex: 400 }}>
    <div style={{ height: STATUS_H, display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '6px 30px 0 34px', fontWeight: 800, fontSize: 16 }}>
      <span>{time}</span>
      <span style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <svg width="18" height="12" viewBox="0 0 18 12"><g fill={c.ink}><rect x="0" y="8" width="3" height="4" rx="1" /><rect x="5" y="5.5" width="3" height="6.5" rx="1" /><rect x="10" y="3" width="3" height="9" rx="1" /><rect x="15" y="0" width="3" height="12" rx="1" /></g></svg>
        <svg width="16" height="12" viewBox="0 0 16 12"><path d="M8 11.5l2.4-2.9a3.6 3.6 0 0 0-4.8 0zM3.4 6.3a7 7 0 0 1 9.2 0l1.6-1.9a9.6 9.6 0 0 0-12.4 0zM.2 2.4l1.5 1.9a11.6 11.6 0 0 1 12.6 0l1.5-1.9a14 14 0 0 0-15.6 0z" fill={c.ink} /></svg>
        <svg width="26" height="12" viewBox="0 0 26 12"><rect x=".5" y=".5" width="22" height="11" rx="3" fill="none" stroke={c.ink} opacity=".45" /><rect x="2" y="2" width="16" height="8" rx="2" fill={c.ink} /><rect x="23.5" y="4" width="2" height="4" rx="1" fill={c.ink} opacity=".45" /></svg>
      </span>
    </div>
    {url && (
      <div style={{ margin: '2px 14px 0', height: 36, borderRadius: 12, background: c.tint, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, fontSize: 15, fontWeight: 600, color: c.ink }}>
        <svg width="11" height="13" viewBox="0 0 11 13"><rect x="1" y="5.5" width="9" height="7" rx="1.6" fill={c.ink2} /><path d="M3 6V4a2.5 2.5 0 0 1 5 0v2" fill="none" stroke={c.ink2} strokeWidth="1.6" /></svg>
        {url}
      </div>
    )}
  </div>
);

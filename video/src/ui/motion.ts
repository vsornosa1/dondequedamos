import { Easing, interpolate } from 'remotion';

const outExpo = Easing.bezier(0.16, 1, 0.3, 1);
const inOut = Easing.bezier(0.65, 0, 0.35, 1);
const inCubic = Easing.bezier(0.55, 0, 1, 0.45);

const clamp = {
  extrapolateLeft: 'clamp',
  extrapolateRight: 'clamp',
} as const;

// 0 -> 1 over [start, start + dur], fast in, soft landing (entrances).
export const enter = (frame: number, start: number, dur = 24) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: outExpo });

// 0 -> 1, eased both ends (camera moves, carried objects).
export const glide = (frame: number, start: number, dur = 30) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: inOut });

// 0 -> 1, accelerating (exits).
export const leave = (frame: number, start: number, dur = 18) =>
  interpolate(frame, [start, start + dur], [0, 1], { ...clamp, easing: inCubic });

// 0 -> 1, linear and clamped (counters, mechanical motion).
export const lin = (frame: number, start: number, dur: number) =>
  interpolate(frame, [start, start + dur], [0, 1], clamp);

export const lerp = (t: number, a: number, b: number) => a + (b - a) * t;

// 0 -> 1 with an overshoot, for things that pop into place (back-out).
export const pop = (frame: number, start: number, dur = 16, over = 2.2) => {
  const t = Math.max(0, Math.min(1, (frame - start) / dur));
  const s = over;
  const u = t - 1;
  return t === 0 ? 0 : 1 + (s + 1) * u * u * u + s * u * u;
};

// A damped spring settling from 0 to 1: for landings and squash.
export const spring = (frame: number, start: number, freq = 0.32, damp = 0.12) => {
  const t = frame - start;
  if (t <= 0) return 0;
  return 1 - Math.exp(-damp * t) * Math.cos(freq * t);
};

// An element that rises in and, optionally, eases out.
export const rise = (frame: number, start: number, out?: number, distance = 24) => {
  const i = enter(frame, start, 26);
  const o = out === undefined ? 0 : leave(frame, out, 16);
  return {
    opacity: i * (1 - o),
    transform: `translateY(${(1 - i) * distance - o * distance * 0.5}px)`,
  };
};

// Characters typed in at a steady rate (chars per frame), starting at `start`.
export const typed = (text: string, frame: number, start: number, perChar = 3) => {
  const n = Math.max(0, Math.floor((frame - start) / perChar) + 1);
  return frame < start ? '' : text.slice(0, n);
};

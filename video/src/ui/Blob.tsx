import React from 'react';
import { PEOPLE_COLORS, c } from '../look';

// The four friends as blobs with eyes (after the reference Vicent sent). Each wears
// the colour of their line in the app. Drawn in a 200x200 box, feet at y = 184.
export type Mood = 'open' | 'happy' | 'tired' | 'wide';

const BODIES: React.ReactNode[] = [
  // Vicent: a round bean.
  <path key="v" d="M100 22C148 22 182 58 182 106C182 154 146 186 100 186C54 186 18 154 18 106C18 58 52 22 100 22Z" />,
  // Jenny: a soft triangle.
  <path key="j" d="M86 38Q100 12 114 38L176 150Q190 182 154 182L46 182Q10 182 24 150Z" />,
  // Ángel: a squircle.
  <path key="a" d="M64 30L136 30Q178 30 178 72L178 142Q178 184 136 184L64 184Q22 184 22 142L22 72Q22 30 64 30Z" />,
  // Yania: a cloud.
  <g key="y"><circle cx="66" cy="118" r="46" /><circle cx="106" cy="84" r="54" /><circle cx="144" cy="116" r="42" /><rect x="22" y="110" width="160" height="74" rx="37" /></g>,
];

const EYES: [number, number][][] = [
  [[78, 100], [122, 100]],
  [[84, 128], [116, 128]],
  [[80, 102], [120, 102]],
  [[88, 120], [124, 120]],
];

type Props = {
  who: number;
  size: number;
  look?: { x: number; y: number };
  blink?: number;
  mood?: Mood;
  squash?: number;
  sweat?: number; // 0..1, a drop running down
  glass?: number; // 0..1, a drink in hand
  drink?: 'cana' | 'vino';
  style?: React.CSSProperties;
};

// What they raise for the toast, drawn around the hand at (0, 0).
const DRINKS = {
  cana: (
    <>
      <path d="M-17 -30h34l-4 44a6 6 0 0 1-6 5h-14a6 6 0 0 1-6-5z" fill="#F4B63A" stroke={c.ink} strokeWidth="5" strokeLinejoin="round" />
      <path d="M-21 -30c-3-10 6-18 15-14 5-8 16-8 21 0 9-3 16 5 12 14z" fill="#FFFFFF" stroke={c.ink} strokeWidth="5" strokeLinejoin="round" />
    </>
  ),
  vino: (
    <g transform="scale(1.2)">
      <path d="M-17 -40H17C18 -22 11 -9 0 -7C-11 -9 -18 -22 -17 -40Z" fill="#FFFFFF" />
      <path d="M-16 -27H16C14.5 -16 8.6 -9.6 0 -8.6C-8.6 -9.6 -14.5 -16 -16 -27Z" fill="#A3263A" />
      <path d="M-17 -40H17C18 -22 11 -9 0 -7C-11 -9 -18 -22 -17 -40Z" fill="none" stroke={c.ink} strokeWidth="5" strokeLinejoin="round" />
      <path d="M0 -7V14M-12 15H12" fill="none" stroke={c.ink} strokeWidth="5" strokeLinecap="round" />
      <path d="M-10 -35C-11 -30 -10.5 -25 -8 -21" fill="none" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity={0.8} />
    </g>
  ),
};

export const Blob = ({ who, size, look = { x: 0, y: 0 }, blink = 0, mood = 'open', squash = 0, sweat = 0, glass = 0, drink = 'vino', style }: Props) => {
  const color = PEOPLE_COLORS[who];
  const sx = 1 + 0.16 * squash;
  const sy = 1 - 0.16 * squash;
  const lx = look.x * 9;
  const ly = look.y * 7;
  const side = who === 0 || who === 2 ? 1 : -1; // Vicent and Ángel hold the glass on the right
  return (
    <svg width={size} height={size} viewBox="-20 -20 240 240" style={{ overflow: 'visible', display: 'block', ...style }}>
      <g transform={`translate(100 184) scale(${sx} ${sy}) translate(-100 -184)`}>
        {glass > 0 && (
          <g transform={`translate(${100 + side * 92} ${150 - 26 * glass}) rotate(${side * (18 - 18 * glass)}) scale(${glass})`}>
            {DRINKS[drink]}
          </g>
        )}
        <g fill={color}>{BODIES[who]}</g>
        {EYES[who].map(([x, y], i) => {
          const ex = x + lx;
          const ey = y + ly;
          if (mood === 'happy') {
            return <path key={i} d={`M${ex - 12} ${ey + 5}Q${ex} ${ey - 13} ${ex + 12} ${ey + 5}`} fill="none" stroke={c.ink} strokeWidth="8" strokeLinecap="round" />;
          }
          if (mood === 'tired') {
            const brow = i === 0 ? `M${ex - 15} ${ey - 13}L${ex + 9} ${ey - 21}` : `M${ex - 9} ${ey - 21}L${ex + 15} ${ey - 13}`;
            return (
              <g key={i}>
                <rect x={ex - 10} y={ey - 2} width={20} height={14} rx={7} fill={c.ink} />
                <path d={brow} stroke={c.ink} strokeWidth="6" strokeLinecap="round" />
              </g>
            );
          }
          const ry = (mood === 'wide' ? 14 : 19) * (1 - 0.9 * blink);
          const rx = mood === 'wide' ? 14 : 10;
          return (
            <g key={i}>
              <ellipse cx={ex} cy={ey} rx={rx} ry={ry} fill={c.ink} />
              {blink < 0.5 && <circle cx={ex - 3} cy={ey - ry * 0.45} r={3.4} fill="#FFFFFF" opacity={0.9} />}
            </g>
          );
        })}
        {sweat > 0 && (
          <path
            d="M0 -14C5 -6 9 -1 9 4A9 9 0 0 1-9 4C-9 -1-5 -6 0 -14Z"
            transform={`translate(${who === 3 ? 172 : 168} ${70 + 40 * sweat})`}
            fill="#9FD3FF" stroke={c.ink} strokeWidth="3" opacity={sweat < 0.85 ? 1 : (1 - sweat) / 0.15}
          />
        )}
      </g>
    </svg>
  );
};

// A soft ground shadow that shrinks as the blob leaves the floor.
export const Shadow = ({ size, lift = 0, dark = false }: { size: number; lift?: number; dark?: boolean }) => (
  <div style={{
    width: size * 0.7 * (1 - 0.35 * lift), height: size * 0.09, borderRadius: '50%', margin: '0 auto',
    background: dark ? 'rgba(0,0,0,.45)' : 'rgba(14,26,43,.16)', filter: 'blur(2px)',
  }} />
);

// The cut list, in global frames at 30 fps. The score runs at 120 BPM, so a
// beat is 15 frames and a bar 60: every cut and every hit sits on a beat, and
// music/score.py reads this same file (through scripts/cues.ts) for its hits
// and sound effects.
export const FPS = 30;
export const BEAT = 15;
export const BAR = 60;

export const T = {
  hook: { from: 0, to: 120 },
  problem: { from: 120, to: 420 },
  logo: { from: 420, to: 570 },
  people: { from: 570, to: 780 },
  plan: { from: 780, to: 930 },
  loader: { from: 930, to: 990 },
  result: { from: 990, to: 1290 },
  share: { from: 1290, to: 1470 },
  payoff: { from: 1470, to: 1590 },
  end: { from: 1590, to: 1800 },
};

export const TOTAL = T.end.to;

// Key moments inside the scenes.
export const K = {
  hook: { pops: [0, 15, 30, 45], title: 18, glance: 66, exit: 104 },
  problem: {
    labels: 140, pin: 172, captionA: 192, lines: 204, perMin: 2, tired: 286, look: 296,
    captionB: 318, retract: 398,
  },
  logo: { burst: 420, square: 434, word: 452, sub: 470, fly: 546 },
  people: {
    captionA: 584, rows: [600, 618, 636, 652], tap: 668, sheet: 672, captionB: 686,
    name: 692, mode: 716, type: 728, suggest: 746, pick: 754, close: 760, done: 758,
  },
  plan: { scroll: 780, caption: 786, canas: 798, cenar: 818, later: 836, day: 860, timeScroll: 868, time: 886, search: 910 },
  loader: { start: 922 },
  result: {
    sign: 990, ding: 996, caption: 1002, push: 1004, scroll: 1108, lines: 1132, captionB: 1140,
    callout: 1176, out: 1280,
  },
  share: { tap: 1300, chat: 1308, caption: 1306, sent: 1335, replies: [1376, 1398, 1421], zoom: 1421 },
  payoff: { map: 1452, travel: 1478, arrive: 1545, caption: 1500, cheers: 1556 },
  end: { wipe: 1578, lockup: 1600, url: 1622, tag: 1636, qr: 1646, free: 1656, terreta: 1666, credits: 1676 },
};

// Who is who, in the app's order.
export const NAMES = ['Vicent', 'Jenny', 'Ángel', 'Yania'];
export const FROM = ['Benimaclet', 'Russafa', 'Patraix', 'El Cabanyal'];
export const MODES = ['TRANSIT', 'BICYCLE', 'DRIVE', 'WALK'] as const;
export type Mode = (typeof MODES)[number];

// Lo que puede usar cada uno (la app elige el más rápido: el de MODES). Yania solo va andando.
export const CAN: Mode[][] = [['WALK', 'TRANSIT'], ['WALK', 'TRANSIT', 'BICYCLE'], ['WALK', 'TRANSIT', 'DRIVE'], ['WALK']];
export const DEFAULT_CAN: Mode[] = ['WALK', 'TRANSIT'];

// The plan they settle on, after a first tap on Cañas.
export const PLAN = 'cenar' as 'canas' | 'cafe' | 'cenar' | 'copas' | 'parque';

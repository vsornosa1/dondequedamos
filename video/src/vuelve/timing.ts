// The cut list of the relaunch clip ("ha vuelto"), in frames at 30 fps. Same grid as
// the demo: 120 BPM, a beat is 15 frames and a bar 60, and every cut sits on a bar.
// music/score_vuelve.py reads it through scripts/cues-vuelve.ts.
export const VT = {
  viral: { from: 0, to: 120 },
  pause: { from: 120, to: 240 },
  build: { from: 240, to: 300 },
  back: { from: 300, to: 480 },
  end: { from: 480, to: 600 },
};

export const V_TOTAL = VT.end.to;

// Key moments inside the scenes.
export const VK = {
  viral: {
    pops: [0, 8, 15, 23], title: 6, titleOut: 112,
    imp: 20, impCount: [22, 52] as [number, number],
    // The routes rush up to the free 10.000 by `overflow` (a beat), then creep past it.
    routes: 46, routesCount: [48, 98] as [number, number], overflow: 75,
    out: 120,
  },
  pause: { caption: 128, captionOut: 228, barOut: 150, sign: 176, sweat: 150 },
  build: { lookUp: 250, shake: 270, caption: 244, captionOut: 290 },
  back: { flip: 300, light: 302, up: 330, caption: 350, cards: [375, 405, 435], out: 472 },
  end: { night: 480, lockup: 498, url: 514, tag: 524, qr: 534, terreta: 546 },
};

// The numbers on screen, all real (design/VUELVE.md).
export const IMPRESSIONS = 23000;
export const ROUTES = 11000;
export const FREE_ROUTES = 10000;

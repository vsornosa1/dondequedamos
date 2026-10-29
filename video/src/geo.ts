// The map plates are rendered once (MapPlate composition) at this centre and
// zoom; every overlay projects lat/lng onto the same pixels with Web Mercator.
import scenario from './data/scenario.json';
import routes from './data/routes.json';

export type LatLng = { lat: number; lng: number };

export const PLATE = { center: { lat: 39.4745, lng: -0.362 }, zoom: 14.3, w: 2700, h: 3375 };

const world = 512 * 2 ** PLATE.zoom;
const mx = (lng: number) => ((lng + 180) / 360) * world;
const my = (lat: number) => {
  const s = Math.sin((lat * Math.PI) / 180);
  return (0.5 - Math.log((1 + s) / (1 - s)) / (4 * Math.PI)) * world;
};

export const project = (p: LatLng) => ({
  x: mx(p.lng) - mx(PLATE.center.lng) + PLATE.w / 2,
  y: my(p.lat) - my(PLATE.center.lat) + PLATE.h / 2,
});

export type Pt = { x: number; y: number };

export const S = scenario;
export const ORIGINS: Pt[] = scenario.people.map((p) => project(p.loc));
export const MIDPOINT: Pt = project(scenario.midpoint.loc);
export const VENUE: Pt = project(scenario.options[0].loc);

const toPts = (r: number[][]) => r.map(([lat, lng]) => project({ lat, lng }));
export const ROUTES_MID: Pt[][] = routes.midpoint.map(toPts);
export const ROUTES_VENUE: Pt[][] = routes.venue.map(toPts);

export const pathD = (pts: Pt[]) => pts.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');

export const pathLength = (pts: Pt[]) => {
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
  return len;
};

// Where routes run down the same street, one would hide the other (Ángel's line
// covered Jenny's). There each one moves to its own lane, like metro lines on a map;
// elsewhere they stay on the street. `gap` is the lane width in plate px.
const unit = (x: number, y: number) => {
  const l = Math.hypot(x, y) || 1;
  return { x: x / l, y: y / l };
};
const tangents = (r: Pt[]) => r.map((_, k) => {
  const a = r[Math.max(0, k - 1)];
  const b = r[Math.min(r.length - 1, k + 1)];
  return unit(b.x - a.x, b.y - a.y);
});
const nearest = (p: Pt, r: Pt[]) => {
  let best = { d: Infinity, dir: { x: 1, y: 0 } };
  for (let k = 1; k < r.length; k++) {
    const a = r[k - 1];
    const dx = r[k].x - a.x;
    const dy = r[k].y - a.y;
    const t = Math.max(0, Math.min(1, ((p.x - a.x) * dx + (p.y - a.y) * dy) / (dx * dx + dy * dy || 1)));
    const d = Math.hypot(p.x - a.x - t * dx, p.y - a.y - t * dy);
    if (d < best.d) best = { d, dir: unit(dx, dy) };
  }
  return best;
};

export const sideBySide = (routes: Pt[][], gap: number, near = gap * 0.6, smooth = gap * 2.5) =>
  routes.map((r, i) => {
    const tan = tangents(r);
    const lane = r.map((p, k) => {
      // The routes running along this one here: close by and roughly parallel.
      const along = routes.flatMap((q, j) => {
        if (j === i) return [{ j, dir: tan[k] }];
        const n = nearest(p, q);
        return n.d < near && Math.abs(n.dir.x * tan[k].x + n.dir.y * tan[k].y) > 0.7 ? [{ j, dir: n.dir }] : [];
      });
      if (along.length < 2) return 0;
      const ref = along[0].dir; // lanes are counted from the lowest route's side
      const same = tan[k].x * ref.x + tan[k].y * ref.y >= 0 ? 1 : -1;
      const rank = along.findIndex((a) => a.j === i);
      return (rank - (along.length - 1) / 2) * gap * same;
    });
    // Ease in and out of the lanes along the route, so the lines merge smoothly.
    const at = [0];
    for (let k = 1; k < r.length; k++) at.push(at[k - 1] + Math.hypot(r[k].x - r[k - 1].x, r[k].y - r[k - 1].y));
    const off = r.map((_, k) => {
      let sum = 0;
      let w = 0;
      for (let m = 0; m < r.length; m++) {
        const u = 1 - Math.abs(at[m] - at[k]) / smooth;
        if (u > 0) { sum += lane[m] * u; w += u; }
      }
      return sum / w;
    });
    return r.map((p, k) => ({ x: p.x - tan[k].y * off[k], y: p.y + tan[k].x * off[k] }));
  });

// The point a fraction t along a polyline, for blobs that travel their route.
export const pointAt = (pts: Pt[], t: number): Pt => {
  const total = pathLength(pts);
  let want = Math.max(0, Math.min(1, t)) * total;
  for (let i = 1; i < pts.length; i++) {
    const seg = Math.hypot(pts[i].x - pts[i - 1].x, pts[i].y - pts[i - 1].y);
    if (want <= seg || i === pts.length - 1) {
      const k = seg ? Math.min(1, want / seg) : 0;
      return { x: pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k, y: pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k };
    }
    want -= seg;
  }
  return pts[pts.length - 1];
};

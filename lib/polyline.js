// Trazados de ruta como polilíneas de Google (precisión 1e-5), en puntos [lng, lat] como los quiere el mapa.

export function decodePolyline(s) {
  const out = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => {
    let r = 0, sh = 0, b;
    do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20 && i < s.length);
    return r & 1 ? ~(r >> 1) : r >> 1;
  };
  while (i < s.length) { lat += next(); lng += next(); out.push([lng / 1e5, lat / 1e5]); }
  return out;
}

export function encodePolyline(pts) {
  let out = '', plat = 0, plng = 0;
  const enc = (v) => {
    v = v < 0 ? ~(v << 1) : v << 1;
    let s = '';
    while (v >= 0x20) { s += String.fromCharCode((0x20 | (v & 0x1f)) + 63); v >>= 5; }
    return s + String.fromCharCode(v + 63);
  };
  for (const [lng, lat] of pts) {
    const la = Math.round(lat * 1e5), lo = Math.round(lng * 1e5);
    out += enc(la - plat) + enc(lo - plng);
    plat = la;
    plng = lo;
  }
  return out;
}

const M = (Math.PI / 180) * 6371000; // metros por grado de latitud
const meters = (a, b) => Math.hypot((b[0] - a[0]) * Math.cos((((a[1] + b[1]) / 2) * Math.PI) / 180), b[1] - a[1]) * M;

// Quita los primeros `m` metros del trazado: así el enlace no dice desde qué portal sale nadie.
export function trimStart(pts, m) {
  let left = m;
  for (let i = 1; i < pts.length; i++) {
    const d = meters(pts[i - 1], pts[i]);
    if (d > left) {
      const t = left / d, [a, b] = [pts[i - 1], pts[i]];
      return [[a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t], ...pts.slice(i)];
    }
    left -= d;
  }
  return [];
}

// Douglas-Peucker en metros: menos puntos sin salirse de la calle más de `tol` metros.
export function simplify(pts, tol) {
  if (pts.length < 3) return pts;
  const k = Math.cos((pts[0][1] * Math.PI) / 180) * M;
  const xy = pts.map(([lng, lat]) => [lng * k, lat * M]);
  const off = (p, a, b) => {
    const dx = b[0] - a[0], dy = b[1] - a[1];
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
    return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
  };
  const keep = new Uint8Array(pts.length);
  keep[0] = keep[pts.length - 1] = 1;
  const stack = [[0, pts.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop();
    let far = 0, at = -1;
    for (let i = a + 1; i < b; i++) {
      const d = off(xy[i], xy[a], xy[b]);
      if (d > far) { far = d; at = i; }
    }
    if (far > tol) { keep[at] = 1; stack.push([a, at], [at, b]); }
  }
  return pts.filter((_, i) => keep[i]);
}

// La ruta tal como viaja en un enlace: sin los primeros 300 m y con los puntos justos.
export const PRIVATE_M = 300;
export const routeForLink = (pts) => {
  const cut = simplify(trimStart(pts, PRIVATE_M), 6);
  return cut.length >= 2 ? encodePolyline(cut) : '';
};

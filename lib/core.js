// Lógica pura (sin red): estimaciones, candidatos y puntuación de justicia.

export const MODES = ['TRANSIT', 'DRIVE', 'BICYCLE', 'WALK'];

// Velocidades medias efectivas en ciudad española (km/h) y tiempo fijo (min)
// solo para la estimación inicial; los tiempos finales vienen de Google.
const SPEED = { WALK: 4.8, BICYCLE: 14, DRIVE: 26, TRANSIT: 17 };
const OVERHEAD = { WALK: 0, BICYCLE: 2, DRIVE: 6, TRANSIT: 7 };
const DETOUR = 1.3;

export const PLANS = {
  canas: { label: 'Cañas', types: ['bar', 'pub'] },
  cafe: { label: 'Café', types: ['cafe', 'coffee_shop'] },
  cenar: { label: 'Cenar', types: ['restaurant'] },
  copas: { label: 'Copas', types: ['bar', 'night_club'] },
  parque: { label: 'Parque', types: ['park'] },
};

const R = 6371000;
const rad = (d) => (d * Math.PI) / 180;

export function haversine(a, b) {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function offset(p, distM, bearingDeg) {
  const br = rad(bearingDeg);
  const dLat = (distM * Math.cos(br)) / R;
  const dLng = (distM * Math.sin(br)) / (R * Math.cos(rad(p.lat)));
  return { lat: p.lat + (dLat * 180) / Math.PI, lng: p.lng + (dLng * 180) / Math.PI };
}

export function estimateMinutes(origin, mode, p) {
  const km = (haversine(origin, p) * DETOUR) / 1000;
  return OVERHEAD[mode] + (km / SPEED[mode]) * 60;
}

export function centroid(points) {
  const n = points.length;
  return {
    lat: points.reduce((s, p) => s + p.lat, 0) / n,
    lng: points.reduce((s, p) => s + p.lng, 0) / n,
  };
}

export function spreadMeters(points) {
  let max = 0;
  for (let i = 0; i < points.length; i++)
    for (let j = i + 1; j < points.length; j++) max = Math.max(max, haversine(points[i], points[j]));
  return max;
}

// Punto que minimiza el peor tiempo estimado (búsqueda en rejilla refinada).
export function estimateFairPoint(friends) {
  const pts = friends.map((f) => f.loc);
  let best = centroid(pts);
  let span = Math.max(spreadMeters(pts), 500);
  const cost = (p) => {
    const t = friends.map((f) => estimateMinutes(f.loc, f.mode, p));
    return Math.max(...t) + 0.05 * (Math.max(...t) - Math.min(...t));
  };
  let bestCost = cost(best);
  for (let round = 0; round < 6; round++) {
    const center = best;
    for (let i = -6; i <= 6; i++)
      for (let j = -6; j <= 6; j++) {
        const p = offset(offset(center, (i / 6) * span, 0), (j / 6) * span, 90);
        const c = cost(p);
        if (c < bestCost) { bestCost = c; best = p; }
      }
    span /= 3;
  }
  return best;
}

// Candidatos de la fase A: punto justo estimado + anillo + centro geográfico.
export function stageACandidates(friends) {
  const pts = friends.map((f) => f.loc);
  const fair = estimateFairPoint(friends);
  const spread = spreadMeters(pts);
  const r = clamp(spread * 0.15, 400, 3000);
  const cands = [{ ...fair, kind: 'estimado' }];
  for (let k = 0; k < 6; k++) cands.push({ ...offset(fair, r, k * 60), kind: 'anillo' });
  cands.push({ ...centroid(pts), kind: 'centro' });
  return { cands, ringRadius: r };
}

export function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

// times: array de minutos (null = sin ruta)
export function scoreTimes(times, criterion = 'justo') {
  const t = times.map((x) => (x == null ? 999 : x));
  const max = Math.max(...t), min = Math.min(...t);
  const avg = t.reduce((s, x) => s + x, 0) / t.length;
  const gap = max - min;
  const score = criterion === 'rapido' ? avg + 0.25 * gap : max + 0.35 * gap;
  return { max, min, avg, gap, score };
}

// Selecciona sitios a evaluar: buena valoración y variedad, máx n.
export function pickVenues(places, center, n = 12) {
  const scored = places
    .filter((p) => p.location)
    .map((p) => {
      const rating = p.rating ?? 3.5;
      const count = p.userRatingCount ?? 0;
      const dist = haversine(center, { lat: p.location.latitude, lng: p.location.longitude });
      const q = rating * Math.log10(10 + count) - dist / 1500;
      return { p, q, ok: rating >= 3.8 && count >= 15 };
    });
  const good = scored.filter((s) => s.ok);
  const pool = good.length >= 5 ? good : scored;
  return pool.sort((a, b) => b.q - a.q).slice(0, n).map((s) => s.p);
}

// Fallback cuando Google no devuelve ruta para un modo (p.ej. bici).
export function fallbackMinutes(origin, mode, dest) {
  return Math.round(estimateMinutes(origin, mode, dest));
}

export function validateFriends(friends) {
  if (!Array.isArray(friends) || friends.length < 2 || friends.length > 8) return 'Hacen falta entre 2 y 8 personas.';
  for (const f of friends) {
    if (!f || !f.loc || !isFinite(f.loc.lat) || !isFinite(f.loc.lng)) return 'Falta la ubicación de alguien.';
    if (!MODES.includes(f.mode)) return 'Modo de transporte no válido.';
    if (Math.abs(f.loc.lat) > 90 || Math.abs(f.loc.lng) > 180) return 'Coordenadas no válidas.';
  }
  if (spreadMeters(friends.map((f) => f.loc)) > 150000) return 'Estáis a más de 150 km. ¡Eso ya es un viaje!';
  return null;
}

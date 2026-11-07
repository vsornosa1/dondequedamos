// Lógica pura (sin red): estimaciones, candidatos y puntuación de justicia.

export const MODES = ['TRANSIT', 'DRIVE', 'BICYCLE', 'WALK'];
// Lo que puede usar alguien si no dice nada: andar y el bus o el metro, que vale para casi todos.
export const DEFAULT_MODES = ['WALK', 'TRANSIT'];
// Planes con alcohol: ahí no se cuenta el coche (Copas ya no se ofrece, pero aún llega en enlaces viejos).
const NO_CAR = ['canas', 'copas'];

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
  biblioteca: { label: 'Biblioteca', types: ['library'] },
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

// Los transportes que se tienen en cuenta para alguien: los que marcó (los clientes y pruebas de antes
// mandan uno solo, en `mode`), sin el coche si el plan es de beber. Nunca se queda sin ninguno.
export function usableModes(friend, plan) {
  const asked = Array.isArray(friend?.modes) ? friend.modes : friend?.mode ? [friend.mode] : DEFAULT_MODES;
  const modes = MODES.filter((m) => asked.includes(m) && !(m === 'DRIVE' && NO_CAR.includes(plan)));
  return modes.length ? modes : DEFAULT_MODES;
}

// Lo que tardaría alguien (estimado) con el más rápido de sus transportes.
export const bestEstimate = (friend, p) => Math.min(...friend.modes.map((m) => estimateMinutes(friend.loc, m, p)));

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

// Punto con la mejor puntuación «Más justo» según los tiempos estimados (búsqueda en rejilla refinada).
export function estimateFairPoint(friends) {
  const pts = friends.map((f) => f.loc);
  let best = centroid(pts);
  let span = Math.max(spreadMeters(pts), 500);
  const cost = (p) => scoreTimes(friends.map((f) => bestEstimate(f, p))).score;
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
// Puntos del anillo alrededor del punto justo estimado: cubren el error de la estimación en cada dirección.
export const RING = 6;

export function stageACandidates(friends, ring = RING) {
  const pts = friends.map((f) => f.loc);
  const fair = estimateFairPoint(friends);
  const spread = spreadMeters(pts);
  const r = clamp(spread * 0.15, 400, 3000);
  const cands = [{ ...fair, kind: 'estimado' }];
  for (let k = 0; k < ring; k++) cands.push({ ...offset(fair, r, (k * 360) / ring), kind: 'anillo' });
  cands.push({ ...centroid(pts), kind: 'centro' });
  return { cands, ringRadius: r };
}

export function clamp(x, a, b) { return Math.min(b, Math.max(a, x)); }

// times: array de minutos (null = sin ruta)
// «Más justo» = quien más tarda + ½ media: un minuto más para quien más tarda solo compensa si la media baja
// más de dos. Sin la diferencia máx − mín, que premiaba hacer andar más a quien ya llegaba antes.
export function scoreTimes(times, criterion = 'justo') {
  const t = times.map((x) => (x == null ? 999 : x));
  const max = Math.max(...t), min = Math.min(...t);
  const avg = t.reduce((s, x) => s + x, 0) / t.length;
  const gap = max - min;
  const score = criterion === 'rapido' ? avg + 0.25 * gap : max + 0.5 * avg;
  return { max, min, avg, gap, score };
}

// Selecciona sitios a evaluar: buena valoración y variedad, máx n. Sin valoraciones (Nearby Search Pro),
// Google ya los da ordenados por popularidad: ese orden hace de valoración.
export function pickVenues(places, center, n = 12) {
  if (!places.some((p) => p.rating != null)) {
    return places
      .filter((p) => p.location)
      .map((p, i) => ({ p, q: -0.25 * i - haversine(center, { lat: p.location.latitude, lng: p.location.longitude }) / 1500 }))
      .sort((a, b) => b.q - a.q).slice(0, n).map((s) => s.p);
  }
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
    const modes = Array.isArray(f.modes) ? f.modes : [f.mode];
    if (!modes.length || !modes.every((m) => MODES.includes(m))) return 'Modo de transporte no válido.';
    if (Math.abs(f.loc.lat) > 90 || Math.abs(f.loc.lng) > 180) return 'Coordenadas no válidas.';
  }
  if (spreadMeters(friends.map((f) => f.loc)) > 150000) return 'Estáis a más de 150 km. ¡Eso ya es un viaje!';
  return null;
}

/* ---------- Ya tenemos destino: quedar antes en un punto y seguir juntos ---------- */

// Dónde se espera según cómo seguís juntos: en coche, donde se puede parar a recoger a alguien; en bus,
// metro o tren, en la estación; andando o en bici, en una cafetería.
export const MEET_TYPES = {
  DRIVE: ['gas_station', 'parking'],
  TRANSIT: ['train_station', 'subway_station', 'light_rail_station', 'bus_station', 'transit_station'],
  WALK: ['cafe', 'bar'],
  BICYCLE: ['cafe', 'bar'],
};

// Quién va hasta el punto de encuentro y cómo. En coche o en bici, quien lo tiene lo lleva hasta el
// punto (si no, no habría coche para seguir); el resto llega como pueda.
export function tripModes(friend, together) {
  const modes = usableModes(friend, null);
  return (together === 'DRIVE' || together === 'BICYCLE') && modes.includes(together) ? [together] : modes;
}

// legs: lo que tarda cada uno hasta el punto; shared: lo que tardáis juntos desde ahí hasta el destino;
// direct: lo que tardaría cada uno yendo por su cuenta.
// «Más justo» = la puntuación de siempre con los tramos de cada uno + el tramo juntos + el rodeo de quien más
// se desvía. Así gana el punto que os deja antes en el destino (quien más tarda en llegar al punto más el
// trayecto juntos), repartiendo lo que cada uno hace solo y sin que nadie vuelva hacia atrás para nada:
// si alguien vive en el destino, se le espera allí. «Menos tiempo» = el de siempre más el tramo juntos.
export function scoreTrip(legs, shared, direct, criterion = 'justo') {
  const s = scoreTimes(legs, criterion);
  const g = shared == null ? 999 : shared;
  if (criterion === 'rapido') return { ...s, score: s.score + g };
  const detour = Math.max(0, ...legs.map((t, i) => (t == null ? 999 : t) + g - (direct?.[i] ?? Infinity)));
  return { ...s, score: s.score + g + detour };
}

// El tramo juntos estimado: en el propio destino no hay tramo.
export const sharedEstimate = (p, to, mode) => (haversine(p, to) < 60 ? 0 : estimateMinutes(p, mode, to));

// Punto de encuentro con la mejor puntuación según los tiempos estimados (rejilla refinada, como el sitio justo).
export function estimateTripPoint(friends, to, together) {
  const pts = friends.map((f) => f.loc);
  const direct = friends.map((f) => bestEstimate(f, to));
  const cost = (p) => scoreTrip(friends.map((f) => bestEstimate(f, p)), sharedEstimate(p, to, together), direct).score;
  let best = centroid(pts);
  let bestCost = cost(best);
  if (cost(to) < bestCost) { best = to; bestCost = cost(to); }
  let span = Math.max(spreadMeters([...pts, to]), 500);
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

// Candidatos de la fase A: el punto estimado, un anillo alrededor, el centro de los que salen y el propio
// destino (que además da lo que tardaría cada uno yendo por su cuenta).
export function tripCandidates(friends, to, together, ring = RING) {
  const pts = friends.map((f) => f.loc);
  const fair = estimateTripPoint(friends, to, together);
  const r = clamp(spreadMeters([...pts, to]) * 0.12, 400, 3000);
  const cands = [{ ...fair, kind: 'estimado' }];
  for (let k = 0; k < ring; k++) cands.push({ ...offset(fair, r, (k * 360) / ring), kind: 'anillo' });
  cands.push({ ...centroid(pts), kind: 'centro' });
  cands.push({ lat: to.lat, lng: to.lng, kind: 'destino' });
  return { cands, ringRadius: r };
}

export function validateTrip(friends, to, together) {
  const err = validateFriends(friends);
  if (err) return err;
  if (!to || !isFinite(to.lat) || !isFinite(to.lng) || Math.abs(to.lat) > 90 || Math.abs(to.lng) > 180) return 'Falta adónde vais.';
  if (!MODES.includes(together)) return 'Modo de transporte no válido.';
  if (spreadMeters([...friends.map((f) => f.loc), to]) > 150000) return 'El destino está a más de 150 km. ¡Eso ya es un viaje!';
  if (together === 'DRIVE' && !friends.some((f) => usableModes(f, null).includes('DRIVE')))
    return 'Para ir juntos en coche, alguien tiene que llevarlo: marca «Coche» a quien lo tenga.';
  return null;
}

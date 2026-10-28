import {
  PLANS, stageACandidates, scoreTimes, pickVenues, fallbackMinutes, haversine, clamp, validateFriends,
} from './core.js';

// Calcula tiempos de todos los amigos a una lista de destinos (agrupando por modo).
export async function timesTo(google, friends, dests, departureTime) {
  const byMode = {};
  friends.forEach((f, i) => (byMode[f.mode] ||= []).push(i));
  const result = friends.map(() => dests.map(() => null));
  await Promise.all(Object.entries(byMode).map(async ([mode, idxs]) => {
    let m;
    try { m = await google.matrix(idxs.map((i) => friends[i].loc), dests, mode, departureTime); }
    catch (e) { if (e.status === 403 || e.status === 401) throw e; m = null; }
    idxs.forEach((fi, k) => dests.forEach((d, j) => {
      const v = m?.[k]?.[j];
      result[fi][j] = v != null ? { min: v, est: false } : { min: fallbackMinutes(friends[fi].loc, mode, d), est: true };
    }));
  }));
  return result; // [amigo][destino] = {min, est}
}

const column = (t, j) => t.map((row) => row[j].min);

export async function findMeetingPlace(google, { friends, plan = 'canas', when }) {
  const err = validateFriends(friends);
  if (err) { const e = new Error(err); e.status = 400; throw e; }
  const types = (PLANS[plan] || PLANS.canas).types;
  const now = Date.now() + 60_000;
  const dep = new Date(Math.max(now, when ? Date.parse(when) || now : now)).toISOString();

  // Fase A: localizar la zona más justa con pocos puntos de prueba.
  const { cands, ringRadius } = stageACandidates(friends);
  const tA = await timesTo(google, friends, cands, dep);
  const scoredA = cands.map((c, j) => ({ c, j, s: scoreTimes(column(tA, j)) }));
  const bestA = scoredA.reduce((a, b) => (b.s.score < a.s.score ? b : a));
  const centerIdx = cands.findIndex((c) => c.kind === 'centro');

  // Fase B: sitios reales alrededor de la zona ganadora.
  const radius = Math.round(clamp(ringRadius * 1.2, 500, 2500));
  let places = await google.nearby(bestA.c, radius, types);
  if (places.length < 5) places = places.concat(await google.nearby(bestA.c, radius * 2, types));
  const seen = new Set();
  places = places.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
  const venues = pickVenues(places, bestA.c, 12);
  if (!venues.length) { const e = new Error('No hemos encontrado sitios abiertos por esa zona. Prueba con otro plan.'); e.status = 404; throw e; }

  const vLocs = venues.map((v) => ({ lat: v.location.latitude, lng: v.location.longitude }));
  const tB = await timesTo(google, friends, vLocs, dep);

  const options = venues.map((v, j) => ({
    id: v.id,
    name: v.displayName?.text || 'Sitio',
    address: v.shortFormattedAddress || v.formattedAddress || '',
    type: v.primaryTypeDisplayName?.text || '',
    rating: v.rating ?? null,
    ratings: v.userRatingCount ?? 0,
    price: v.priceLevel || null,
    openNow: v.currentOpeningHours?.openNow ?? null,
    url: v.googleMapsUri,
    photo: v.photos?.[0] ? { name: v.photos[0].name, by: v.photos[0].authorAttributions?.[0]?.displayName || '' } : null,
    loc: vLocs[j],
    times: tB.map((row) => row[j]),
    justo: scoreTimes(column(tB, j), 'justo'),
    rapido: scoreTimes(column(tB, j), 'rapido'),
  }));

  return {
    departureTime: dep,
    zone: { lat: bestA.c.lat, lng: bestA.c.lng, radius },
    midpoint: {
      loc: { lat: cands[centerIdx].lat, lng: cands[centerIdx].lng },
      times: tA.map((row) => row[centerIdx]),
      stats: scoreTimes(column(tA, centerIdx)),
    },
    options,
    calls: { elements: friends.length * (cands.length + vLocs.length) },
  };
}

export { haversine };

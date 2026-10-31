import {
  MODES, PLANS, stageACandidates, scoreTimes, pickVenues, fallbackMinutes, haversine, clamp, validateFriends,
  estimateMinutes, usableModes, bestEstimate,
} from './core.js';

// Caché de búsquedas: la misma quedada (mismas casas a ~100 m, transportes, plan y franja de 15 min)
// no vuelve a preguntar a Google. Repetir, volver atrás o cambiar de plan y deshacer sale gratis.
export const CACHE_MIN = 15;

export function searchKey(friends, plan, when, now = Date.now()) {
  if (validateFriends(friends)) return null;
  const p = PLANS[plan] ? plan : 'canas';
  const at = Math.max(now, when ? Date.parse(when) || now : now);
  const who = friends.map((f) => `${f.loc.lat.toFixed(3)},${f.loc.lng.toFixed(3)}:${usableModes(f, p).sort().join('+')}`);
  return `s:${p}:${Math.floor(at / (CACHE_MIN * 60_000))}:${who.join('|')}`;
}

// Andando solo se le pregunta a Google donde puede ganar: a quien tiene otro transporte, para destinos a
// menos de 25 min a pie (estimados). Más lejos gana el bus, el metro o la bici, y no se paga por nada.
const WALK_NEAR_MIN = 25;
// A igual tiempo, mejor lo más sencillo: andar antes que la bici, el transporte público o el coche.
const SIMPLE = { WALK: 0, BICYCLE: 1, TRANSIT: 2, DRIVE: 3 };

// El tiempo de cada amigo a cada destino con el transporte más rápido de los que puede usar.
// Una matriz por transporte con quien lo usa; andando, solo con los destinos que le pillan cerca.
export async function timesTo(google, friends, dests, departureTime) {
  const all = dests.map((_, j) => j);
  const jobs = [];
  for (const mode of MODES) {
    const who = friends.map((_, i) => i).filter((i) => friends[i].modes.includes(mode));
    if (!who.length) continue;
    if (mode !== 'WALK') { jobs.push({ mode, who, to: all }); continue; }
    for (const i of who) {
      const near = friends[i].modes.length === 1 ? all : all.filter((j) => estimateMinutes(friends[i].loc, 'WALK', dests[j]) <= WALK_NEAR_MIN);
      if (near.length) jobs.push({ mode, who: [i], to: near });
    }
  }

  // Lo real gana a lo estimado; entre iguales, lo más rápido y, si empatan, lo más sencillo.
  const best = friends.map(() => dests.map(() => null));
  const offer = (i, j, t) => {
    const b = best[i][j];
    if (!b || (b.est && !t.est) || (b.est === t.est && (t.min < b.min || (t.min === b.min && SIMPLE[t.mode] < SIMPLE[b.mode])))) best[i][j] = t;
  };
  await Promise.all(jobs.map(async ({ mode, who, to }) => {
    let m;
    try { m = await google.matrix(who.map((i) => friends[i].loc), to.map((j) => dests[j]), mode, departureTime); }
    catch (e) { if (e.status === 403 || e.status === 401) throw e; m = null; }
    who.forEach((i, a) => to.forEach((j, b) => {
      const v = m?.[a]?.[b];
      offer(i, j, v != null ? { min: v, est: false, mode } : { min: fallbackMinutes(friends[i].loc, mode, dests[j]), est: true, mode });
    }));
  }));
  return { times: best, elements: jobs.reduce((n, job) => n + job.who.length * job.to.length, 0) }; // times[amigo][destino] = {min, est, mode}
}

const column = (t, j) => t.map((row) => row[j].min);

// Cuánto se equivoca la estimación con cada persona en esa zona (tiempo real ÷ estimado en la fase A).
// Con eso se ordenan los sitios antes de preguntar a Google y solo se miden los que tienen opciones.
function calibration(people, cands, tA) {
  return people.map((f, i) => {
    const r = cands.map((c, j) => (tA[i][j].est ? null : tA[i][j].min / Math.max(1, bestEstimate(f, c)))).filter((x) => x != null).sort((a, b) => a - b);
    return r.length ? r[Math.floor(r.length / 2)] : 1;
  });
}

// Fase B: de los POOL sitios mejor valorados de la zona, solo se le pregunta a Google por los VENUES más
// prometedores según la estimación calibrada con la fase A (en pantalla se enseñan los 5 mejores).
// En simulación, 8 de 20 elige tan bien como medir 12 a ciegas y pide un 19 % menos de elementos de matriz.
export const VENUES = 8;
export const POOL = 20;

export async function findMeetingPlace(google, { friends, plan = 'canas', when }, { ring, venues = VENUES, pool = POOL } = {}) {
  const err = validateFriends(friends);
  if (err) { const e = new Error(err); e.status = 400; throw e; }
  const people = friends.map((f) => ({ loc: f.loc, modes: usableModes(f, plan) }));
  const types = (PLANS[plan] || PLANS.canas).types;
  const now = Date.now() + 60_000;
  const dep = new Date(Math.max(now, when ? Date.parse(when) || now : now)).toISOString();

  // Fase A: localizar la zona más justa con pocos puntos de prueba.
  const { cands, ringRadius } = stageACandidates(people, ring);
  const a = await timesTo(google, people, cands, dep);
  const tA = a.times;
  const scoredA = cands.map((c, j) => ({ c, j, s: scoreTimes(column(tA, j)) }));
  const bestA = scoredA.reduce((x, y) => (y.s.score < x.s.score ? y : x));
  const centerIdx = cands.findIndex((c) => c.kind === 'centro');

  // Fase B: sitios reales alrededor de la zona ganadora.
  const radius = Math.round(clamp(ringRadius * 1.2, 500, 2500));
  let places = await google.nearby(bestA.c, radius, types);
  if (places.length < 5) places = places.concat(await google.nearby(bestA.c, radius * 2, types));
  const seen = new Set();
  places = places.filter((p) => (seen.has(p.id) ? false : seen.add(p.id)));
  let picked = pickVenues(places, bestA.c, pool || venues);
  if (pool) {
    const k = calibration(people, cands, tA);
    const guess = (v) => scoreTimes(people.map((f, i) => k[i] * bestEstimate(f, { lat: v.location.latitude, lng: v.location.longitude }))).score;
    picked = picked.map((v) => ({ v, g: guess(v) })).sort((a, b) => a.g - b.g).slice(0, venues).map((x) => x.v);
  }
  if (!picked.length) { const e = new Error('No hemos encontrado sitios abiertos por esa zona. Prueba con otro plan.'); e.status = 404; throw e; }

  const vLocs = picked.map((v) => ({ lat: v.location.latitude, lng: v.location.longitude }));
  const b = await timesTo(google, people, vLocs, dep);
  const tB = b.times;

  const options = picked.map((v, j) => ({
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
    calls: { elements: a.elements + b.elements },
  };
}

export { haversine };

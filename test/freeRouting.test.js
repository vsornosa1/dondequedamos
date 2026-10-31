// Rutas en servidores propios (OSRM y OpenTripPlanner), con respuestas en el formato de sus APIs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeFreeRouting, freeRoutingFromEnv, withFreeRouting } from '../lib/freeRouting.js';
import { encodePolyline, decodePolyline } from '../lib/polyline.js';
import { findMeetingPlace } from '../lib/search.js';
import { makeGoogle } from '../lib/google.js';
import { mockFetch } from '../lib/mockGoogle.js';
import { estimateMinutes } from '../lib/core.js';

const RUSSAFA = { lat: 39.4616, lng: -0.3749 }, CAMPANAR = { lat: 39.4840, lng: -0.3990 }, CABANYAL = { lat: 39.4699, lng: -0.3283 };
const AT = '2026-11-06T19:00:00.000Z';
const ok = (d) => ({ ok: true, status: 200, json: async () => d });

// Un OSRM simulado: /table y /route como osrm-routed (duraciones en segundos, coordenadas lng,lat).
function osrmServer(seen = []) {
  return async (url) => {
    seen.push(String(url));
    const u = new URL(url);
    const [, service, , profile, coords] = u.pathname.split('/'); // /table/v1/foot/lng,lat;lng,lat
    const pts = coords.split(';').map((c) => { const [lng, lat] = c.split(',').map(Number); return { lat, lng }; });
    const mode = { foot: 'WALK', bike: 'BICYCLE', car: 'DRIVE' }[profile];
    if (service === 'table') {
      const src = u.searchParams.get('sources').split(';').map(Number);
      const dst = u.searchParams.get('destinations').split(';').map(Number);
      assert.equal(u.searchParams.get('annotations'), 'duration');
      return ok({ code: 'Ok', durations: src.map((i) => dst.map((j) => (pts[j].lat === 0 ? null : estimateMinutes(pts[i], mode, pts[j]) * 60))) });
    }
    assert.equal(u.searchParams.get('geometries'), 'polyline');
    return ok({ code: 'Ok', routes: [{ duration: 754.3, distance: 3100, geometry: encodePolyline([[pts[0].lng, pts[0].lat], [pts[1].lng, pts[1].lat]]) }] });
  };
}

test('OSRM: la matriz pide origen × destino con lng,lat y devuelve minutos', async () => {
  const seen = [];
  const free = makeFreeRouting({ osrm: { WALK: 'http://osrm-foot:5000/' }, fetchFn: osrmServer(seen) });
  const m = await free.matrix([RUSSAFA, CAMPANAR], [CABANYAL, { lat: 0, lng: 0 }], 'WALK', AT);
  assert.equal(seen.length, 1);
  assert.match(seen[0], /^http:\/\/osrm-foot:5000\/table\/v1\/foot\/-0\.374900,39\.461600;-0\.399000,39\.484000;-0\.328300,39\.469900;0\.000000,0\.000000\?sources=0;1&destinations=2;3/);
  assert.equal(m.length, 2);
  assert.equal(m[0][0], Math.round(estimateMinutes(RUSSAFA, 'WALK', CABANYAL)));
  assert.equal(m[1][1], null); // sin ruta
});

test('OSRM: la ruta llega como polilínea, igual que la de Google', async () => {
  const free = makeFreeRouting({ osrm: { BICYCLE: 'http://osrm-bike:5001' }, fetchFn: osrmServer() });
  const r = await free.route(RUSSAFA, CAMPANAR, 'BICYCLE', AT);
  assert.equal(r.min, 13);
  assert.deepEqual(decodePolyline(r.polyline), [[RUSSAFA.lng, RUSSAFA.lat], [CAMPANAR.lng, CAMPANAR.lat]]);
});

// Un OTP simulado: planConnection de la API GTFS GraphQL.
function otpServer(seen = [], fail = () => false) {
  return async (url, init) => {
    const body = JSON.parse(init.body);
    seen.push(body);
    if (fail(body)) return { ok: false, status: 500, json: async () => ({}) };
    const { from, to } = body.variables;
    const a = from.location.coordinate, b = to.location.coordinate;
    const walk = encodePolyline([[a.longitude, a.latitude], [a.longitude, b.latitude]]);
    const bus = encodePolyline([[a.longitude, b.latitude], [b.longitude, b.latitude]]);
    return ok({ data: { planConnection: { edges: [
      // Sale en 2 min y tarda 25.
      { node: { start: '2026-11-06T20:02:00+01:00', end: '2026-11-06T20:27:00+01:00', duration: 1500, legs: [{ legGeometry: { points: walk } }, { legGeometry: { points: bus } }] } },
      // Tarda 15, pero el bus sale dentro de 50 min: cuentan los 30 de espera de más.
      { node: { start: '2026-11-06T20:50:00+01:00', end: '2026-11-06T21:05:00+01:00', duration: 900, legs: [{ legGeometry: { points: bus } }] } },
    ] } } });
  };
}

test('OTP: planConnection con coordenadas y hora de salida; gana el itinerario de verdad más rápido', async () => {
  const seen = [];
  const free = makeFreeRouting({ otp: 'http://otp:8080/otp/gtfs/v1', fetchFn: otpServer(seen) });
  const r = await free.route(RUSSAFA, CAMPANAR, 'TRANSIT', AT);
  assert.match(seen[0].query, /planConnection\(origin: \$from, destination: \$to, dateTime: \{ earliestDeparture: \$at \}/);
  assert.deepEqual(seen[0].variables.from, { location: { coordinate: { latitude: RUSSAFA.lat, longitude: RUSSAFA.lng } } });
  assert.equal(seen[0].variables.at, AT);
  assert.equal(r.min, 25); // 15 + 30 de espera de más pierde contra 25
  // Los tramos (andar + bus) se unen en un solo trazado.
  assert.deepEqual(decodePolyline(r.polyline), [[RUSSAFA.lng, RUSSAFA.lat], [RUSSAFA.lng, CAMPANAR.lat], [RUSSAFA.lng, CAMPANAR.lat], [CAMPANAR.lng, CAMPANAR.lat]]);
});

test('OTP: la matriz es un plan por pareja; las que fallan quedan sin ruta, y si fallan todas, error', async () => {
  const seen = [];
  const free = makeFreeRouting({ otp: 'http://otp', fetchFn: otpServer(seen, (b) => b.variables.to.location.coordinate.latitude === CABANYAL.lat) });
  const m = await free.matrix([RUSSAFA, CAMPANAR], [CABANYAL, CAMPANAR], 'TRANSIT', AT);
  assert.equal(seen.length, 4);
  assert.deepEqual(m.map((row) => row.map((x) => x != null)), [[false, true], [false, true]]);
  const down = makeFreeRouting({ otp: 'http://otp', fetchFn: async () => { throw new Error('ECONNREFUSED'); } });
  await assert.rejects(down.matrix([RUSSAFA], [CAMPANAR], 'TRANSIT', AT), /OTP no responde/);
});

test('sin variables de entorno no hay rutas propias', () => {
  assert.equal(freeRoutingFromEnv({}), null);
  const f = freeRoutingFromEnv({ OSRM_WALK_URL: 'http://a', OTP_URL: 'http://b' });
  assert.equal(f.supports('WALK'), true);
  assert.equal(f.supports('TRANSIT'), true);
  assert.equal(f.supports('DRIVE'), false);
});

test('con servidores propios, Google no recibe ni una matriz de esos transportes', async () => {
  const google = { asked: [] };
  const g = makeGoogle('mock', async (url, init) => {
    if (String(url).includes('computeRouteMatrix')) google.asked.push(JSON.parse(init.body).travelMode);
    return mockFetch(url, init);
  });
  const free = makeFreeRouting({
    osrm: { WALK: 'http://osrm-foot' }, otp: 'http://otp',
    fetchFn: (url, init) => (String(url).startsWith('http://otp') ? otpServer()(url, init) : osrmServer()(url, init)),
  });
  const friends = [{ loc: RUSSAFA, modes: ['WALK', 'TRANSIT'] }, { loc: CAMPANAR, modes: ['WALK', 'TRANSIT'] }, { loc: CABANYAL, modes: ['DRIVE'] }];
  const r = await findMeetingPlace(withFreeRouting(g, free), { friends, plan: 'cenar' });
  assert.ok(r.options.length >= 5);
  assert.deepEqual([...new Set(google.asked)], ['DRIVE']); // solo el coche, que no tiene servidor propio
  assert.ok(r.options.every((o) => o.times.every((t) => !t.est)));
});

test('si el servidor propio se cae, se vuelve a Google', async () => {
  const errors = [];
  const free = makeFreeRouting({ osrm: { WALK: 'http://caido' }, fetchFn: async () => { throw new Error('ECONNREFUSED'); } });
  const g = withFreeRouting(makeGoogle('mock', mockFetch), free, (e) => errors.push(e));
  const m = await g.matrix([RUSSAFA], [CAMPANAR], 'WALK', AT);
  const r = await g.route(RUSSAFA, CAMPANAR, 'WALK', AT);
  assert.ok(m[0][0] > 0 && r.polyline);
  assert.equal(errors.length, 2);
});

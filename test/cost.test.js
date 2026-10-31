// Lo que mantiene a raya la factura de Google: caché, menos elementos de matriz y coche sin tráfico en la matriz.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findMeetingPlace, searchKey, VENUES, CACHE_MIN } from '../lib/search.js';
import { makeGoogle } from '../lib/google.js';
import { mockFetch } from '../lib/mockGoogle.js';

const RUSSAFA = { lat: 39.4616, lng: -0.3749 }, CAMPANAR = { lat: 39.4840, lng: -0.3990 };
const NOW = Date.parse('2026-10-31T19:02:00Z');
const two = (extra = {}) => [{ loc: RUSSAFA, modes: ['WALK', 'TRANSIT'], ...extra }, { loc: CAMPANAR, modes: ['DRIVE', 'WALK'] }];

test('la misma quedada da la misma clave: casas a pocos metros, misma franja y transportes en otro orden', () => {
  const a = searchKey(two(), 'cenar', null, NOW);
  const near = [{ loc: { lat: RUSSAFA.lat + 0.0002, lng: RUSSAFA.lng - 0.0002 }, modes: ['TRANSIT', 'WALK'] }, two()[1]];
  assert.ok(a);
  assert.equal(searchKey(near, 'cenar', null, NOW), a);
  assert.equal(searchKey(two(), 'cenar', null, NOW + 5 * 60_000), a);
});

test('cambia la clave si cambia algo que cambia el resultado', () => {
  const a = searchKey(two(), 'cenar', null, NOW);
  assert.notEqual(searchKey(two(), 'cafe', null, NOW), a);
  assert.notEqual(searchKey(two(), 'cenar', null, NOW + CACHE_MIN * 60_000), a);
  assert.notEqual(searchKey(two(), 'cenar', '2026-11-01T12:00:00Z', NOW), a);
  assert.notEqual(searchKey(two({ modes: ['BICYCLE'] }), 'cenar', null, NOW), a);
  assert.notEqual(searchKey([two()[1], two()[0]], 'cenar', null, NOW), a); // el orden es el de las personas
});

test('con cañas el coche no cuenta, así que da igual que lo marque', () => {
  const car = [{ loc: RUSSAFA, modes: ['WALK', 'DRIVE'] }, { loc: CAMPANAR, modes: ['WALK'] }];
  const walk = [{ loc: RUSSAFA, modes: ['WALK'] }, { loc: CAMPANAR, modes: ['WALK'] }];
  assert.equal(searchKey(car, 'canas', null, NOW), searchKey(walk, 'canas', null, NOW));
});

test('sin datos válidos no hay clave (la búsqueda dará el error de siempre)', () => {
  assert.equal(searchKey(null, 'cenar', null, NOW), null);
  assert.equal(searchKey([{ loc: RUSSAFA, modes: ['WALK'] }], 'cenar', null, NOW), null);
});

test('la matriz en coche va sin tráfico (Essentials); la ruta dibujada sí lo usa', async () => {
  const bodies = [];
  const google = makeGoogle('mock', async (url, init) => { bodies.push({ url: String(url), b: JSON.parse(init.body) }); return mockFetch(url, init); });
  const at = new Date(NOW + 3600e3).toISOString();
  await google.matrix([RUSSAFA], [CAMPANAR], 'DRIVE', at);
  await google.matrix([RUSSAFA], [CAMPANAR], 'TRANSIT', at);
  await google.route(RUSSAFA, CAMPANAR, 'DRIVE', at);
  const [drive, transit, route] = bodies.map((x) => x.b);
  assert.equal(drive.routingPreference, undefined);
  assert.equal(drive.departureTime, undefined);
  assert.equal(transit.departureTime, at);
  assert.equal(route.routingPreference, 'TRAFFIC_AWARE');
});

test(`solo se mide en la fase B los ${VENUES} sitios más prometedores`, async () => {
  let destsB = 0, phaseB = false;
  const google = makeGoogle('mock', async (url, init) => {
    if (String(url).includes('searchNearby')) phaseB = true;
    if (phaseB && String(url).includes('computeRouteMatrix')) destsB = Math.max(destsB, JSON.parse(init.body).destinations.length);
    return mockFetch(url, init);
  });
  const r = await findMeetingPlace(google, { friends: [{ loc: RUSSAFA, modes: ['TRANSIT'] }, { loc: CAMPANAR, modes: ['TRANSIT'] }], plan: 'cenar' });
  assert.ok(r.options.length <= VENUES && r.options.length >= 5);
  assert.ok(destsB > 0 && destsB <= VENUES);
});

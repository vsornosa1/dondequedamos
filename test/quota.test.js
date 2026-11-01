// El guardián del tramo gratuito: Google nunca debe recibir una llamada que no quepa en lo gratis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeQuota, memoryStore, guardGoogle, closedGoogle, nextReset, pacificDay, capsFromEnv, QuotaError, FREE_CAPS } from '../lib/quota.js';
import { findMeetingPlace } from '../lib/search.js';
import { makeGoogle } from '../lib/google.js';
import { mockFetch } from '../lib/mockGoogle.js';

// 1 de noviembre de 2026 a las 12:00 en el Pacífico (UTC−8): noviembre tiene 30 días.
const NOV1 = Date.parse('2026-11-01T20:00:00Z');
const DAY = 86400e3;
const quiet = () => {};
const quota = (caps, now = () => NOV1, store = memoryStore()) => makeQuota({ store, caps, safety: 1, now, log: quiet });

const isQuota = (e) => e instanceof QuotaError && e.code === 'quota' && e.status === 429;

test('el mes y el día son los de Google: hora del Pacífico', () => {
  assert.deepEqual(pacificDay(Date.parse('2026-11-01T06:59:00Z')), { y: 2026, m: 10, d: 31, daysInMonth: 31 }); // 23:59 del 31 en California
  assert.deepEqual(pacificDay(Date.parse('2026-11-01T07:00:00Z')), { y: 2026, m: 11, d: 1, daysInMonth: 30 });
  // El cupo diario se renueva a medianoche del Pacífico: las 9:00 en España en invierno.
  assert.equal(new Date(nextReset(NOV1)).toISOString(), '2026-11-02T08:00:00.000Z');
  assert.equal(new Date(nextReset(Date.parse('2026-07-15T12:00:00Z'))).toISOString(), '2026-07-16T07:00:00.000Z');
});

test('cada día se puede gastar lo que queda del mes entre los días que faltan', async () => {
  const q = quota({ nearbyPro: 90 }); // 90 / 30 días = 3 al día
  for (let i = 0; i < 3; i++) await q.take('nearbyPro');
  await assert.rejects(q.take('nearbyPro'), isQuota);
  const u = (await q.usage()).nearbyPro;
  assert.equal(u.today, 3); // lo rechazado no cuenta
});

test('lo que no se gasta un día pasa al siguiente, y el último día queda todo lo que sobra', async () => {
  const store = memoryStore();
  let now = NOV1;
  const q = quota({ x: 90 }, () => now, store);
  await q.take('x'); // el día 1 solo se gasta 1 de 3
  now += DAY; // día 2: (90 − 1) / 29 = 3
  for (let i = 0; i < 3; i++) await q.take('x');
  await assert.rejects(q.take('x'), isQuota);
  now = Date.parse('2026-11-30T20:00:00Z'); // último día: todo lo que queda (90 − 4 = 86)
  await q.take('x', 86);
  await assert.rejects(q.take('x'), isQuota);
  now = Date.parse('2026-12-01T20:00:00Z'); // mes nuevo, cupo nuevo
  await q.take('x');
});

test('nunca se pasa del mes, ni con muchas llamadas a la vez', async () => {
  const q = quota({ x: 30 }); // 1 al día
  const r = await Promise.allSettled(Array.from({ length: 10 }, () => q.take('x')));
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 1);
  await assert.rejects(q.take('x', 31), isQuota); // más de lo que hay en todo el mes
});

test('mirar si cabe no gasta', async () => {
  const q = quota({ x: 30 });
  assert.equal(await q.canSpend('x'), true);
  assert.equal(await q.canSpend('x'), true);
  await q.take('x');
  assert.equal(await q.canSpend('x'), false);
});

test('si no se puede contar, no se llama (y se dice por qué)', async () => {
  const broken = { add: async () => { throw new Error('Redis caído'); }, get: async () => { throw new Error('Redis caído'); } };
  const q = quota({ x: 1000 }, () => NOV1, broken);
  await assert.rejects(q.take('x'), (e) => e instanceof QuotaError && e.reason === 'store');
  assert.equal(await q.canSpend('x'), false);
});

test('los topes se pueden cambiar por entorno, sin aceptar basura', () => {
  assert.equal(capsFromEnv({}).nearbyPro, FREE_CAPS.nearbyPro);
  assert.equal(capsFromEnv({ GOOGLE_FREE_CAPS: '{"nearbyPro":200,"inventado":5,"photos":-1}' }).nearbyPro, 200);
  assert.equal(capsFromEnv({ GOOGLE_FREE_CAPS: '{"nearbyPro":200,"inventado":5,"photos":-1}' }).photos, FREE_CAPS.photos);
  assert.equal(capsFromEnv({ GOOGLE_FREE_CAPS: 'no es json' }).nearbyPro, FREE_CAPS.nearbyPro);
});

/* ---------- Con el cliente de Google ---------- */

// Google simulado que apunta cada llamada que llega de verdad (lo que Google contaría).
function counted(opts) {
  const calls = { matrix: 0, elements: 0, nearby: 0, other: 0 };
  const fetchFn = async (url, init) => {
    const u = String(url);
    if (u.includes('computeRouteMatrix')) { const b = JSON.parse(init.body); calls.matrix++; calls.elements += b.origins.length * b.destinations.length; }
    else if (u.includes('searchNearby')) calls.nearby++;
    else calls.other++;
    return mockFetch(url, init);
  };
  return { google: makeGoogle('mock', fetchFn, opts), calls };
}

const RUSSAFA = { lat: 39.4616, lng: -0.3749 }, CAMPANAR = { lat: 39.4840, lng: -0.3990 };
const friends = [{ loc: RUSSAFA, modes: ['TRANSIT'] }, { loc: CAMPANAR, modes: ['TRANSIT'] }];

test('la matriz gasta un uso por elemento (origen × destino)', async () => {
  const { google, calls } = counted();
  const q = quota({ matrixEssentials: 30000 });
  const g = guardGoogle(google, q);
  await g.matrix([RUSSAFA, CAMPANAR], [RUSSAFA, CAMPANAR, RUSSAFA], 'TRANSIT', new Date(NOV1).toISOString());
  assert.equal(calls.elements, 6);
  assert.equal((await q.usage()).matrixEssentials.today, 6);
});

test('sin cupo de matriz, la búsqueda sigue con tiempos estimados y Google no recibe ninguna matriz', async () => {
  const { google, calls } = counted();
  const g = guardGoogle(google, quota({ ...FREE_CAPS, matrixEssentials: 0 }));
  const r = await findMeetingPlace(g, { friends, plan: 'cenar' });
  assert.ok(r.options.length >= 5);
  assert.ok(r.options.every((o) => o.times.every((t) => t.est)));
  assert.equal(calls.matrix, 0);
});

test('sin cupo de búsqueda de sitios, no se empieza (ni se gasta matriz)', async () => {
  const { google, calls } = counted();
  const g = guardGoogle(google, quota({ ...FREE_CAPS, nearbyPro: 0 }));
  await assert.rejects(findMeetingPlace(g, { friends, plan: 'cenar' }), isQuota);
  assert.equal(calls.matrix + calls.nearby, 0);
});

test('sin cupo de fotos, los sitios llegan sin foto (no con una foto rota)', async () => {
  const { google } = counted();
  const r = await findMeetingPlace(guardGoogle(google, quota({ ...FREE_CAPS, photos: 0 })), { friends, plan: 'cenar' });
  assert.ok(r.options.every((o) => o.photo === null));
  const r2 = await findMeetingPlace(guardGoogle(counted().google, quota(FREE_CAPS)), { friends, plan: 'cenar' });
  assert.ok(r2.options.some((o) => o.photo));
});

test('Nearby en Pro (5.000 gratis) por defecto; en Enterprise (1.000) solo si se pide', async () => {
  assert.equal(counted().google.sku.nearby, 'nearbyPro');
  assert.equal(counted({ nearbyTier: 'enterprise' }).google.sku.nearby, 'nearbyEnterprise');
  // En Pro no llegan valoraciones: se eligen por el orden de popularidad de Google, y salen igual.
  const r = await findMeetingPlace(counted().google, { friends, plan: 'cenar' });
  assert.ok(r.options.length >= 5 && r.options.every((o) => o.rating === null));
  const e = await findMeetingPlace(counted({ nearbyTier: 'enterprise' }).google, { friends, plan: 'cenar' });
  assert.ok(e.options.every((o) => o.rating > 0));
});

test('cada llamada gasta su SKU, y en coche la ruta con tráfico es Pro', async () => {
  const q = quota(FREE_CAPS);
  const g = guardGoogle(counted().google, q);
  const at = new Date(NOV1 + 3600e3).toISOString();
  await g.autocomplete('Russ', 'sesion', null);
  await g.place('mockplace_b', 'sesion');
  await g.route(RUSSAFA, CAMPANAR, 'DRIVE', at);
  await g.route(RUSSAFA, CAMPANAR, 'WALK', at);
  await g.details('v1');
  await g.photo('places/v1/photos/p0', 400);
  const u = await q.usage();
  for (const sku of ['autocomplete', 'autocompleteSessions', 'placeEssentials', 'routesPro', 'routesEssentials', 'detailsEnterpriseAtmosphere', 'photos']) {
    assert.equal(u[sku].today, 1, sku);
  }
});

test('sin dónde contar (producción sin Redis), no se llama a Google para nada', async () => {
  const { google, calls } = counted();
  const g = closedGoogle(google);
  await assert.rejects(g.nearby(RUSSAFA, 500, ['bar']), (e) => e.reason === 'store');
  await assert.rejects(g.matrix([RUSSAFA], [CAMPANAR], 'WALK', ''), (e) => e.reason === 'store');
  await assert.rejects(g.autocomplete('Russafa'), (e) => e.reason === 'store');
  assert.equal(calls.matrix + calls.nearby + calls.other, 0);
});

// El guardián del tramo gratuito: Google nunca debe recibir una llamada que no quepa en lo gratis.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { makeQuota, memoryStore, guardGoogle, closedGoogle, nextReset, pacificDay, capsFromEnv, creditFromEnv, QuotaError, FREE_CAPS } from '../lib/quota.js';
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

/* ---------- El crédito de Google ---------- */

// Un crédito de 30 € (en milésimas) cuyo último día de uso es el 10 de noviembre: 10 días desde el 1.
const credit = (eur = 30) => ({ budget: eur * 1000, lastDay: Date.UTC(2026, 10, 10) / 86400e3, id: `t${eur}` });

test('el crédito se lee de la facturación tal cual: importe con coma, fecha de fin y 2 días de margen', () => {
  const c = creditFromEnv({ GOOGLE_CREDIT_EUR: '244,94', GOOGLE_CREDIT_UNTIL: '2027-01-27' });
  assert.equal(c.budget, Math.floor(244.94 * 0.8 * 1000)); // se gasta como mucho el 80 %
  assert.equal(new Date(c.lastDay * 86400e3).toISOString().slice(0, 10), '2027-01-25');
  assert.equal(creditFromEnv({ GOOGLE_CREDIT_EUR: '100', GOOGLE_CREDIT_UNTIL: '2027-01-27', GOOGLE_CREDIT_SAFETY: '0.5' }).budget, 50000);
  assert.equal(creditFromEnv({}), null);
  assert.equal(creditFromEnv({ GOOGLE_CREDIT_EUR: '244', GOOGLE_CREDIT_UNTIL: '27/01/2027' }), null);
  assert.equal(creditFromEnv({ GOOGLE_CREDIT_EUR: 'mucho', GOOGLE_CREDIT_UNTIL: '2027-01-27' }), null);
});

test('cuando se acaba lo gratis de hoy, paga el crédito, repartido por días', async () => {
  const q = makeQuota({ store: memoryStore(), caps: { matrixEssentials: 30 }, safety: 1, credit: credit(1), now: () => NOV1, log: quiet });
  await q.take('matrixEssentials'); // 1 gratis al día (30 / 30 días)
  // 1 € entre 10 días = 100 milésimas hoy; cada elemento cuesta 5: caben 20 elementos con crédito.
  await q.take('matrixEssentials', 10);
  await q.take('matrixEssentials', 10);
  await assert.rejects(q.take('matrixEssentials'), isQuota);
  const u = await q.usage();
  assert.equal(u.matrixEssentials.today, 1); // lo pagado con crédito no gasta tramo gratis
  assert.equal(u.credit.spent, 0.1);
});

test('el crédito nunca pasa de su presupuesto, ni con muchas llamadas a la vez', async () => {
  let now = Date.parse('2026-11-10T20:00:00Z'); // último día: todo lo que queda del crédito
  const q = makeQuota({ store: memoryStore(), caps: { nearbyPro: 0 }, safety: 1, credit: credit(1), now: () => now, log: quiet });
  const r = await Promise.allSettled(Array.from({ length: 50 }, () => q.take('nearbyPro'))); // 32 milésimas cada una
  assert.equal(r.filter((x) => x.status === 'fulfilled').length, 31); // 31 × 32 = 992 ≤ 1.000
  assert.ok((await q.usage()).credit.spent <= 1);
  now = Date.parse('2026-11-11T20:00:00Z'); // pasado su último día, nada de crédito
  const q2 = makeQuota({ store: memoryStore(), caps: { nearbyPro: 0 }, safety: 1, credit: credit(1), now: () => now, log: quiet });
  await assert.rejects(q2.take('nearbyPro'), isQuota);
});

test('un SKU sin precio conocido nunca usa crédito', async () => {
  const q = makeQuota({ store: memoryStore(), caps: { autocompleteSessions: 0 }, safety: 1, credit: credit(), now: () => NOV1, log: quiet });
  await assert.rejects(q.take('autocompleteSessions'), isQuota);
  assert.equal(await q.canSpend('autocompleteSessions'), false);
});

test('mirar si cabe también cuenta el crédito', async () => {
  const q = makeQuota({ store: memoryStore(), caps: { photos: 0 }, safety: 1, credit: credit(), now: () => NOV1, log: quiet });
  assert.equal(await q.canSpend('photos'), true);
  const sinCredito = makeQuota({ store: memoryStore(), caps: { photos: 0 }, safety: 1, now: () => NOV1, log: quiet });
  assert.equal(await sinCredito.canSpend('photos'), false);
});

test('con crédito, la búsqueda tiene tiempos reales aunque se haya acabado la matriz gratis', async () => {
  const { google, calls } = counted();
  const q = makeQuota({ store: memoryStore(), caps: { ...FREE_CAPS, matrixEssentials: 0 }, safety: 1, credit: credit(), now: () => NOV1, log: quiet });
  const r = await findMeetingPlace(guardGoogle(google, q), { friends, plan: 'cenar' });
  assert.ok(r.options.every((o) => o.times.every((t) => !t.est)));
  assert.equal((await q.usage()).credit.spent, (calls.elements * 5) / 1000); // 5 milésimas por elemento
});

/* ---------- El corte automático por presupuesto ---------- */

// Lo que contesta Google cuando la API está desactivada (el corte por presupuesto la apaga).
const disabled = (service) => ({
  ok: false, status: 403,
  text: async () => JSON.stringify({ error: {
    code: 403, status: 'PERMISSION_DENIED',
    message: `${service} has not been used in project 123 before or it is disabled.`,
    details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason: 'SERVICE_DISABLED', domain: 'googleapis.com' }],
  } }),
});

test('con la API de sitios apagada, la búsqueda dice «no disponible» (no «no ha respondido bien»)', async () => {
  const g = makeGoogle('k', async (url, init) => (String(url).includes('places.googleapis.com') ? disabled('Places API (New)') : mockFetch(url, init)));
  await assert.rejects(findMeetingPlace(g, { friends, plan: 'cenar' }), (e) => e.code === 'quota' && e.reason === 'off' && e.status === 503);
});

test('con la matriz apagada, la búsqueda sigue con tiempos estimados', async () => {
  const g = makeGoogle('k', async (url, init) => (String(url).includes('computeRouteMatrix') ? disabled('Routes API') : mockFetch(url, init)));
  const r = await findMeetingPlace(g, { friends, plan: 'cenar' });
  assert.ok(r.options.length >= 5 && r.options.every((o) => o.times.every((t) => t.est)));
});

test('una clave mala sigue siendo un error de verdad (403), no un «no disponible»', async () => {
  const g = makeGoogle('k', async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: { code: 403, message: 'API key not valid.', status: 'PERMISSION_DENIED', details: [{ reason: 'API_KEY_INVALID' }] } }) }));
  await assert.rejects(g.nearby({ lat: 39.46, lng: -0.37 }, 500, ['bar']), (e) => e.status === 403 && e.code === undefined);
});

test('una clave restringida a sitios web o a otra API es «no disponible», con el motivo de Google', async () => {
  for (const reason of ['API_KEY_HTTP_REFERRER_BLOCKED', 'API_KEY_SERVICE_BLOCKED']) {
    const g = makeGoogle('k', async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ error: {
      code: 403, status: 'PERMISSION_DENIED', message: `Bloqueado: ${reason}`, details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }],
    } }) }));
    await assert.rejects(g.autocomplete('calle col'), (e) => e.code === 'quota' && e.reason === 'off' && e.status === 503 && e.message === `Bloqueado: ${reason}`);
  }
});

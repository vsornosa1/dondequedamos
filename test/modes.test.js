// Cada uno marca los transportes que puede usar y la búsqueda elige, para cada sitio, el más rápido.
// Siempre con el Google simulado.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MODES, usableModes } from '../lib/core.js';
import { findMeetingPlace } from '../lib/search.js';
import { makeGoogle } from '../lib/google.js';
import { mockFetch } from '../lib/mockGoogle.js';

const RUSSAFA = { lat: 39.4616, lng: -0.3749 }, GRANVIA = { lat: 39.4660, lng: -0.3700 };
const CAMPANAR = { lat: 39.4840, lng: -0.3990 }, CABANYAL = { lat: 39.4699, lng: -0.3283 }, TORRENT = { lat: 39.4371, lng: -0.4655 };

// Un Google simulado que además apunta cuántos elementos de matriz se piden en cada transporte.
function counted() {
  const asked = {};
  const fetchFn = async (url, init) => {
    if (String(url).includes('computeRouteMatrix')) {
      const b = JSON.parse(init.body);
      asked[b.travelMode] = (asked[b.travelMode] || 0) + b.origins.length * b.destinations.length;
    }
    return mockFetch(url, init);
  };
  return { google: makeGoogle('mock', fetchFn), asked };
}
const best = (r) => [...r.options].sort((a, b) => a.justo.score - b.justo.score)[0];
const same = (a, b) => assert.deepEqual([...a].sort(), [...b].sort());

test('los transportes de cada uno: lo que marca, sin coche con cañas y nunca ninguno', () => {
  same(usableModes({}, 'cafe'), DEFAULT_MODES);
  assert.deepEqual(usableModes({ mode: 'BICYCLE' }, 'cafe'), ['BICYCLE']); // clientes de antes, uno solo
  assert.deepEqual(usableModes({ modes: ['WALK', 'DRIVE'] }, 'cenar'), ['DRIVE', 'WALK']);
  assert.deepEqual(usableModes({ modes: ['WALK', 'DRIVE'] }, 'canas'), ['WALK']);
  same(usableModes({ modes: ['DRIVE'] }, 'canas'), DEFAULT_MODES); // solo coche y cañas: a pie o en bus
  same(usableModes({ modes: ['DRIVE'] }, 'copas'), DEFAULT_MODES); // los enlaces viejos con Copas
  assert.deepEqual(usableModes({ modes: ['TELEPORT', 'WALK'] }, 'cafe'), ['WALK']);
});

test('cada uno llega con su transporte más rápido de los que puede usar', async () => {
  const { google } = counted();
  const friends = [
    { loc: RUSSAFA, modes: ['WALK', 'TRANSIT'] },
    { loc: GRANVIA, modes: ['WALK', 'TRANSIT'] },
    { loc: TORRENT, modes: ['WALK', 'TRANSIT', 'DRIVE'] },
  ];
  const r = await findMeetingPlace(google, { friends, plan: 'cafe' });
  for (const o of r.options) {
    o.times.forEach((t, i) => assert.ok(friends[i].modes.includes(t.mode), `${t.mode} no es de la persona ${i}`));
  }
  assert.equal(best(r).times[2].mode, 'DRIVE'); // desde Torrent, en coche
});

test('dos que viven cerca van andando al sitio que les pilla al lado', async () => {
  const { google } = counted();
  const near = { lat: 39.4650, lng: -0.3749 }; // a 400 m de Russafa
  const r = await findMeetingPlace(google, { friends: [{ loc: RUSSAFA, modes: ['WALK', 'TRANSIT'] }, { loc: near, modes: ['WALK', 'TRANSIT'] }], plan: 'cafe' });
  assert.deepEqual(best(r).times.map((t) => t.mode), ['WALK', 'WALK']);
});

test('con cañas nadie va en coche, aunque lo tenga', async () => {
  const { google, asked } = counted();
  const friends = [{ loc: RUSSAFA, modes: ['WALK', 'TRANSIT'] }, { loc: TORRENT, modes: ['DRIVE', 'WALK', 'TRANSIT'] }];
  const r = await findMeetingPlace(google, { friends, plan: 'canas' });
  assert.ok(r.options.every((o) => o.times.every((t) => t.mode !== 'DRIVE')));
  assert.equal(asked.DRIVE, undefined); // ni se le pregunta a Google
});

test('andando solo se pregunta por los sitios que pillan cerca', async () => {
  const { google, asked } = counted();
  // Los dos lejos de todo (Cabanyal y Torrent): a pie no gana nunca, así que casi no se pregunta.
  const r = await findMeetingPlace(google, { friends: [{ loc: CABANYAL, modes: ['WALK', 'TRANSIT'] }, { loc: TORRENT, modes: ['WALK', 'TRANSIT'] }], plan: 'cafe' });
  assert.ok((asked.WALK || 0) < (asked.TRANSIT || 0) / 2, `a pie ${asked.WALK}, en transporte ${asked.TRANSIT}`);
  assert.equal(r.calls.elements, (asked.WALK || 0) + (asked.TRANSIT || 0));
  // Quien solo puede ir andando se pregunta entero.
  const solo = counted();
  await findMeetingPlace(solo.google, { friends: [{ loc: RUSSAFA, modes: ['WALK'] }, { loc: GRANVIA, modes: ['WALK', 'TRANSIT'] }], plan: 'cafe' });
  assert.ok(solo.asked.WALK >= 8 + 5, `a pie ${solo.asked.WALK}`); // sus 8 zonas de prueba y los sitios, al menos
});

test('la clave de la matriz y la de la ruta: computeRoutes no acepta { waypoint }', async () => {
  const google = makeGoogle('mock', mockFetch);
  const r = await google.route(RUSSAFA, GRANVIA, 'WALK', new Date(Date.now() + 3600e3).toISOString());
  assert.ok(r.polyline.length > 4 && r.min > 0);
  const m = await google.matrix([RUSSAFA], [GRANVIA, CAMPANAR], 'TRANSIT', new Date(Date.now() + 3600e3).toISOString());
  assert.equal(m[0].length, 2);
});

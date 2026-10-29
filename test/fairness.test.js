// Puntuación «Más justo» y búsqueda completa con Google simulado (nunca con la clave real).
// Los números de los grupos salen de dev/effort-by-mode.mjs.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreTimes } from '../lib/core.js';
import { findMeetingPlace } from '../lib/search.js';
import { makeGoogle } from '../lib/google.js';
import { mockFetch } from '../lib/mockGoogle.js';

const better = (a, b) => scoreTimes(a).score < scoreTimes(b).score;

test('nunca prefiere un sitio donde alguien tarda más y nadie tarda menos', () => {
  let seed = 7;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 2000; k++) {
    const t = Array.from({ length: 2 + Math.floor(rand() * 7) }, () => 1 + Math.floor(rand() * 60));
    const worse = [...t];
    worse[Math.floor(rand() * t.length)] += 1 + Math.floor(rand() * 10);
    assert.ok(better(t, worse), `${t} debería ganar a ${worse}`);
  }
});

test('un minuto más para quien más tarda solo compensa si la media baja más de dos', () => {
  assert.ok(better([11, 4, 4], [10, 10, 10]), 'la media baja 3,7');
  assert.ok(better([10, 10, 10], [11, 7, 7]), 'la media baja 1,7');
});

test('con el mismo transporte se sigue igualando, sin dejar tirado a quien vive lejos', () => {
  assert.ok(better([10, 10, 10], [4, 4, 20]));
  assert.ok(better([20, 24, 20, 22, 33, 34], [12, 15, 13, 16, 24, 41]));
});

const google = makeGoogle('mock', mockFetch);
const at = ([lat, lng], mode) => ({ mode, loc: { lat, lng } });
const first = (r) => [...r.options].sort((a, b) => a.justo.score - b.justo.score)[0];

test('dos a pie (Russafa, Gran Vía) y uno en coche (Campanar): el coche se acerca', async () => {
  const friends = [at([39.4616, -0.3749], 'WALK'), at([39.4660, -0.3700], 'WALK'), at([39.4840, -0.3990], 'DRIVE')];
  const r = await findMeetingPlace(google, { friends, plan: 'cenar' });
  const [a, b, car] = first(r).times.map((t) => t.min);
  // Con la regla anterior salía 14, 12 y 14: los de a pie andaban 8 min más cada uno para ahorrarle 1 al coche.
  assert.ok(a <= 10 && b <= 10, `a pie: ${a} y ${b} min`);
  assert.ok(car <= 16, `en coche: ${car} min`);
  // Lo que se enseña son minutos reales, sin ningún peso por transporte.
  for (const o of r.options) {
    const t = o.times.map((x) => x.min);
    assert.equal(o.justo.max, Math.max(...t));
    assert.equal(o.justo.gap, Math.max(...t) - Math.min(...t));
  }
});

test('cinco en el centro y uno en Torrent, todos en transporte público: Torrent no paga el ahorro del resto', async () => {
  const spots = [[39.4616, -0.3749], [39.4660, -0.3700], [39.4742, -0.3766], [39.4790, -0.3800], [39.4740, -0.3530], [39.4371, -0.4655]];
  const r = await findMeetingPlace(google, { friends: spots.map((p) => at(p, 'TRANSIT')), plan: 'cenar' });
  // Con la regla anterior, 33 min; con «máx + media» (sin el ½) subía a 41.
  assert.ok(first(r).times[5].min <= 35, `Torrent: ${first(r).times[5].min} min`);
});

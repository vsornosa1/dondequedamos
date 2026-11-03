// El plan «Biblioteca»: busca bibliotecas, el coche cuenta y los enlaces lo conservan.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { PLANS, usableModes } from '../lib/core.js';
import { findMeetingPlace, searchKey } from '../lib/search.js';
import { encodeProposal, decodeProposal } from '../lib/share.js';
import { makeGoogle } from '../lib/google.js';
import { mockFetch } from '../lib/mockGoogle.js';

const RUSSAFA = { lat: 39.4616, lng: -0.3749 }, CAMPANAR = { lat: 39.4840, lng: -0.3990 };

test('busca bibliotecas en Google (tipo library)', async () => {
  const asked = [];
  const google = makeGoogle('mock', async (url, init) => {
    if (String(url).includes('searchNearby')) asked.push(JSON.parse(init.body).includedTypes);
    return mockFetch(url, init);
  });
  const r = await findMeetingPlace(google, { friends: [{ loc: RUSSAFA, modes: ['WALK', 'TRANSIT'] }, { loc: CAMPANAR, modes: ['DRIVE'] }], plan: 'biblioteca' });
  assert.deepEqual(PLANS.biblioteca.types, ['library']);
  assert.ok(asked.length >= 1 && asked.every((t) => t.length === 1 && t[0] === 'library'));
  assert.ok(r.options.length >= 5);
});

test('a la biblioteca se puede ir en coche (no es un plan de beber)', () => {
  assert.deepEqual(usableModes({ modes: ['WALK', 'DRIVE'] }, 'biblioteca'), ['DRIVE', 'WALK']);
});

test('el enlace compartido conserva el plan, y los enlaces de antes no cambian de plan', () => {
  const base = { n: 'Biblioteca Pública', l: [39.47, -0.37], w: '2026-11-03T17:00:00Z', p: [['Laura', 'TRANSIT', 14], ['Pablo', 'WALK', 12]], r: [] };
  assert.equal(decodeProposal(encodeProposal({ ...base, pl: 'biblioteca' })).plan, 'biblioteca');
  for (const pl of ['canas', 'cafe', 'cenar', 'copas', 'parque']) assert.equal(decodeProposal(encodeProposal({ ...base, pl })).plan, pl);
});

test('la caché no mezcla una biblioteca con un café', () => {
  const friends = [{ loc: RUSSAFA, modes: ['WALK'] }, { loc: CAMPANAR, modes: ['WALK'] }];
  const now = Date.parse('2026-11-03T16:00:00Z');
  assert.notEqual(searchKey(friends, 'biblioteca', null, now), searchKey(friends, 'cafe', null, now));
  assert.match(searchKey(friends, 'biblioteca', null, now), /^s:biblioteca:/);
});

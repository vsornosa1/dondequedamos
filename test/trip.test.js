// «Ya tenemos destino»: quedar antes en un punto y seguir juntos. Con Google simulado (nunca con la clave real).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { haversine, scoreTrip, tripModes, MEET_TYPES } from '../lib/core.js';
import { findMeetingPoint, searchKey } from '../lib/search.js';
import { encodeProposal, decodeProposal } from '../lib/share.js';
import { makeGoogle } from '../lib/google.js';
import { mockFetch } from '../lib/mockGoogle.js';

const VALENCIA = { lat: 39.4699, lng: -0.3763 }, ALDAIA = { lat: 39.4600, lng: -0.4600 };
const CATARROJA = { lat: 39.4030, lng: -0.4030 }, ALMUSSAFES = { lat: 39.2917, lng: -0.4128 };
const google = makeGoogle('mock', mockFetch);
const first = (r) => [...r.options].sort((a, b) => a.justo.score - b.justo.score)[0];
const km = (a, b) => haversine(a, b) / 1000;

test('nunca prefiere un punto donde alguien tarda más y nadie tarda menos', () => {
  let seed = 11;
  const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let k = 0; k < 2000; k++) {
    const legs = Array.from({ length: 2 + Math.floor(rand() * 5) }, () => 1 + Math.floor(rand() * 40));
    const direct = legs.map((x) => x + Math.floor(rand() * 40));
    const g = Math.floor(rand() * 30);
    const worse = [...legs];
    worse[Math.floor(rand() * legs.length)] += 1 + Math.floor(rand() * 10);
    assert.ok(scoreTrip(legs, g, direct).score < scoreTrip(worse, g, direct).score);
    assert.ok(scoreTrip(legs, g, direct).score < scoreTrip(legs, g + 1, direct).score, 'más tramo juntos, peor');
  }
});

test('quien vive en el destino no sale a buscar a nadie para volver', () => {
  // En el destino: 25 y 0 min. A medio camino: 12 y 12, y luego 12 juntos (24 para quien ya estaba allí).
  assert.ok(scoreTrip([25, 0], 0, [25, 0]).score < scoreTrip([12, 12], 12, [25, 0]).score);
});

test('quien tiene coche lo lleva hasta el punto; el resto llega como pueda', () => {
  assert.deepEqual(tripModes({ modes: ['WALK', 'TRANSIT', 'DRIVE'] }, 'DRIVE'), ['DRIVE']);
  assert.deepEqual(tripModes({ modes: ['WALK', 'TRANSIT'] }, 'DRIVE'), ['TRANSIT', 'WALK']);
  assert.deepEqual(tripModes({ modes: ['WALK', 'DRIVE'] }, 'TRANSIT'), ['DRIVE', 'WALK']);
});

test('Valencia y Aldaia van a Almussafes en un coche: quedan entre los dos, camino de Almussafes', async () => {
  const friends = [{ loc: VALENCIA, modes: ['WALK', 'DRIVE'] }, { loc: ALDAIA, modes: ['WALK', 'TRANSIT'] }];
  const r = await findMeetingPoint(google, { friends, to: ALMUSSAFES, together: 'DRIVE' });
  const o = first(r);
  // Más cerca de Almussafes que cualquiera de los dos, pero sin quedar en Almussafes.
  assert.ok(km(r.zone, ALMUSSAFES) < km(VALENCIA, ALMUSSAFES) && km(r.zone, ALMUSSAFES) < km(ALDAIA, ALMUSSAFES), `zona a ${km(r.zone, ALMUSSAFES)} km`);
  assert.ok(o.shared.min > 0 && o.shared.mode === 'DRIVE');
  assert.equal(o.times[0].mode, 'DRIVE', 'el coche llega al punto');
  assert.notEqual(o.times[1].mode, 'DRIVE');
  // Quien no tiene coche llega antes que yendo solo en bus.
  assert.ok(o.times[1].min + o.shared.min < r.trip.direct[1].min);
  assert.equal(r.trip.mode, 'DRIVE');
  assert.equal(r.trip.direct.length, 2);
});

test('si a alguien le pilla de camino, se le recoge allí', async () => {
  const friends = [{ loc: VALENCIA, modes: ['DRIVE'] }, { loc: CATARROJA, modes: ['WALK', 'TRANSIT'] }];
  const r = await findMeetingPoint(google, { friends, to: ALMUSSAFES, together: 'DRIVE' });
  assert.ok(km(r.zone, CATARROJA) < 2, `a ${km(r.zone, CATARROJA)} km de Catarroja`);
});

test('si alguien vive en el destino, se queda allí', async () => {
  const friends = [{ loc: VALENCIA, modes: ['DRIVE'] }, { loc: ALMUSSAFES, modes: ['DRIVE'] }];
  const r = await findMeetingPoint(google, { friends, to: ALMUSSAFES, together: 'DRIVE' });
  assert.ok(km(r.zone, ALMUSSAFES) < 0.1);
  assert.equal(first(r).shared.min, 0);
});

test('busca dónde esperarse según cómo seguís: gasolinera en coche, estación en bus o tren', async () => {
  for (const together of ['DRIVE', 'TRANSIT']) {
    const asked = [];
    const g = makeGoogle('mock', async (url, init) => {
      if (String(url).includes('searchNearby')) asked.push(JSON.parse(init.body).includedTypes);
      return mockFetch(url, init);
    });
    const friends = [{ loc: VALENCIA, modes: ['WALK', 'TRANSIT', 'DRIVE'] }, { loc: ALDAIA, modes: ['WALK', 'TRANSIT'] }];
    const r = await findMeetingPoint(g, { friends, to: ALMUSSAFES, together });
    assert.ok(asked.length >= 1 && asked.every((t) => t.join() === MEET_TYPES[together].join()));
    assert.ok(r.options.length >= 5 && r.options.every((o) => o.shared.mode === together));
    // Unos 60 elementos de matriz: los de siempre más el tramo juntos de cada punto.
    assert.ok(r.calls.elements <= 80, `${r.calls.elements} elementos`);
  }
});

test('para ir en coche alguien tiene que llevarlo, y el destino no puede estar a otro mundo', async () => {
  const walkers = [{ loc: VALENCIA, modes: ['WALK', 'TRANSIT'] }, { loc: ALDAIA, modes: ['WALK'] }];
  await assert.rejects(findMeetingPoint(google, { friends: walkers, to: ALMUSSAFES, together: 'DRIVE' }), { status: 400, message: /coche/ });
  await assert.rejects(findMeetingPoint(google, { friends: walkers, to: { lat: 40.4168, lng: -3.7038 }, together: 'TRANSIT' }), { status: 400, message: /150 km/ });
  await assert.rejects(findMeetingPoint(google, { friends: walkers, to: null, together: 'TRANSIT' }), { status: 400 });
});

test('la caché no mezcla destinos, ni un destino con un plan', () => {
  const friends = [{ loc: VALENCIA, modes: ['DRIVE'] }, { loc: ALDAIA, modes: ['WALK'] }];
  const now = Date.parse('2026-11-07T16:00:00Z');
  const a = searchKey(friends, 'canas', null, now, { to: ALMUSSAFES, together: 'DRIVE' });
  assert.ok(a);
  assert.notEqual(a, searchKey(friends, 'canas', null, now));
  assert.notEqual(a, searchKey(friends, 'canas', null, now, { to: ALMUSSAFES, together: 'TRANSIT' }));
  assert.notEqual(a, searchKey(friends, 'canas', null, now, { to: CATARROJA, together: 'DRIVE' }));
});

test('el enlace lleva el destino y el tramo juntos; los de antes siguen igual', () => {
  const base = { n: 'Gasolinera', l: [39.42, -0.418], w: '2026-11-07T17:00:00Z', p: [['Laura', 'DRIVE', 14], ['Pablo', 'TRANSIT', 22]], r: [] };
  const poly = '_p~iF~ps|U_ulLnnqC_mqNvxq`@'; // lleva «~», como cualquier polilínea
  const p = decodeProposal(encodeProposal({ ...base, pl: null, d: ['Almussafes', 39.2917, -0.4128, 'DRIVE', 22, poly] }));
  assert.equal(p.trip.name, 'Almussafes');
  assert.deepEqual(p.trip.loc, { lat: 39.2917, lng: -0.4128 });
  assert.equal(p.trip.mode, 'DRIVE');
  assert.equal(p.trip.min, 22);
  assert.equal(p.trip.route.length, 3);
  assert.deepEqual(p.people.map((x) => x.min), [14, 22]);
  assert.equal(decodeProposal(encodeProposal({ ...base, pl: 'cafe' })).trip, null);
  assert.equal(decodeProposal(encodeProposal({ ...base, pl: 'cafe', r: ['', '_p~iF~ps|U_ulLnnqC'] })).trip, null);
});

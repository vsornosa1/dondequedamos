// Las rutas en el enlace compartido (formato, validación, recorte de privacidad) y los enlaces a Google Maps.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { decodeProposal, encodeProposal } from '../lib/share.js';
import { PRIVATE_M, decodePolyline, encodePolyline, routeForLink, simplify, trimStart } from '../lib/polyline.js';
import { mapsDirections } from '../lib/routes.ts';

// Un paseo en línea recta hacia el este por València: 1 km en 101 puntos (cada 10 m).
const walk = Array.from({ length: 101 }, (_, k) => [-0.3700 + k * 0.0001163, 39.4700]);
const meters = (a, b) => Math.hypot((b[0] - a[0]) * Math.cos((39.47 * Math.PI) / 180), b[1] - a[1]) * 111195;

const proposal = (r) => ({
  n: 'La Clotxa', l: [39.4735, -0.3404], pl: 'cenar', w: '2026-10-30T19:00:00.000Z',
  p: [['Vicent', 'TRANSIT', 17], ['Jenny', 'BICYCLE', 20], ['Yania', 'WALK', 18]], r,
});

test('la polilínea va y vuelve con ~1 m de precisión', () => {
  const back = decodePolyline(encodePolyline(walk));
  assert.equal(back.length, walk.length);
  back.forEach((p, i) => assert.ok(meters(p, walk[i]) < 1.5));
});

test('el enlace no lleva los primeros 300 m de nadie', () => {
  const cut = trimStart(walk, PRIVATE_M);
  assert.ok(Math.abs(meters(walk[0], cut[0]) - PRIVATE_M) < 2);
  assert.deepEqual(cut.at(-1), walk.at(-1)); // el final, el sitio, se queda
  assert.deepEqual(trimStart(walk.slice(0, 20), PRIVATE_M), []); // quien sale casi al lado no deja ruta
  const link = decodePolyline(routeForLink(walk));
  assert.ok(meters(walk[0], link[0]) > PRIVATE_M - 2);
});

test('simplificar quita puntos sin salirse de la calle', () => {
  const zig = walk.map(([x, y], k) => [x, y + (k % 2 ? 0.00001 : 0)]); // ±1 m de ruido
  const s = simplify(zig, 6);
  assert.ok(s.length < 5);
  assert.deepEqual(s[0], zig[0]);
  assert.deepEqual(s.at(-1), zig.at(-1));
});

test('las rutas viajan en el enlace y vuelven como puntos [lng, lat]', () => {
  const r = [routeForLink(walk), '', routeForLink(walk.map(([x, y]) => [x, y + 0.002]))];
  const d = decodeProposal(encodeProposal(proposal(r)));
  assert.equal(d.name, 'La Clotxa');
  assert.equal(d.people.length, 3);
  assert.equal(d.people[2].mode, 'WALK');
  assert.equal(d.routes.length, 3);
  assert.ok(d.routes[0].length >= 2 && d.routes[2].length >= 2);
  assert.equal(d.routes[1], null);
  assert.ok(meters(d.routes[0].at(-1), walk.at(-1)) < 1.5);
});

test('los enlaces de antes (sin rutas) se siguen abriendo', () => {
  const d = decodeProposal(encodeProposal(proposal(undefined)));
  assert.equal(d.people[0].name, 'Vicent');
  assert.deepEqual(d.routes, [null, null, null]);
});

test('una ruta rota o inventada no se dibuja', () => {
  for (const bad of ['abc', '~'.repeat(5000), 'hola mundo', '{}']) {
    const d = decodeProposal(encodeProposal(proposal([bad, '', ''])));
    assert.ok(d, bad.slice(0, 10));
    assert.equal(d.routes[0], null, bad.slice(0, 10));
  }
});

test('un nombre con salto de línea no rompe el enlace', () => {
  const p = proposal([routeForLink(walk), '', '']);
  p.p[0][0] = 'Vi\ncent';
  const d = decodeProposal(encodeProposal(p));
  assert.equal(d.people[0].name, 'Vi cent');
  assert.ok(d.routes[0]);
});

test('Google Maps abre la ruta en el transporte de cada uno', () => {
  const to = { lat: 39.4735, lng: -0.3404 };
  const u = new URL(mapsDirections(to, 'WALK', 'ChIJabc', { lat: 39.47, lng: -0.37 }));
  assert.equal(u.searchParams.get('travelmode'), 'walking');
  assert.equal(u.searchParams.get('origin'), '39.47,-0.37');
  assert.equal(u.searchParams.get('destination_place_id'), 'ChIJabc');
  const here = new URL(mapsDirections(to, 'TRANSIT', 'v8'));
  assert.equal(here.searchParams.get('travelmode'), 'transit');
  assert.equal(here.searchParams.get('origin'), null); // desde donde esté quien lo abre
  assert.equal(here.searchParams.get('destination_place_id'), null); // los ids del simulador no son de Google
  assert.equal(new URL(mapsDirections(to, 'DRIVE')).searchParams.get('travelmode'), 'driving');
  assert.equal(new URL(mapsDirections(to, 'BICYCLE')).searchParams.get('travelmode'), 'bicycling');
});

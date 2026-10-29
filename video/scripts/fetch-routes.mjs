// Street routes for the map scenes, from the public OSRM servers of FOSSGIS (OpenStreetMap data).
// Run once: node scripts/fetch-routes.mjs. The film itself never touches the network.
import { readFileSync, writeFileSync } from 'node:fs';

const s = JSON.parse(readFileSync('src/data/scenario.json', 'utf8'));
const PROFILE = { TRANSIT: 'car', BICYCLE: 'bike', DRIVE: 'car', WALK: 'foot' };
const dests = { midpoint: s.midpoint.loc, venue: s.options[0].loc };

async function route(from, to, profile) {
  const url = `https://routing.openstreetmap.de/routed-${profile}/route/v1/driving/${from.lng},${from.lat};${to.lng},${to.lat}?overview=full&geometries=geojson`;
  const r = await fetch(url);
  const d = await r.json();
  if (d.code !== 'Ok') throw new Error(`${profile}: ${d.code}`);
  return d.routes[0].geometry.coordinates.map(([lng, lat]) => [+lat.toFixed(5), +lng.toFixed(5)]);
}

const out = {};
for (const [key, to] of Object.entries(dests)) {
  out[key] = [];
  for (const p of s.people) {
    out[key].push(await route(p.loc, to, PROFILE[p.mode]));
    await new Promise((r) => setTimeout(r, 400));
  }
}
writeFileSync('src/data/routes.json', JSON.stringify(out));
for (const [k, v] of Object.entries(out)) console.log(k, v.map((r) => r.length).join(', '));

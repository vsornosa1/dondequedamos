// Las rutas reales de cada persona al sitio (Google Routes) y los enlaces a Google Maps para seguirlas.
import { decodePolyline } from './polyline.js';
import type { LatLng, Mode } from './types';

export type Route = [number, number][]; // [lng, lat]

// Una ruta por persona y sitio, guardada mientras dure la visita: volver a un sitio no repite la llamada.
const cache = new Map<string, { promise: Promise<Route | null>; value?: Route | null }>();
const keyOf = (from: LatLng, mode: Mode, to: LatLng) => `${from.lat},${from.lng}|${mode}|${to.lat},${to.lng}`;

export function routeFor(from: LatLng, mode: Mode, to: LatLng, departure: string) {
  const key = keyOf(from, mode, to);
  let hit = cache.get(key);
  if (!hit) {
    const entry: { promise: Promise<Route | null>; value?: Route | null } = {
      promise: fetch('/api/route', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ origin: from, dest: to, mode, when: departure }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => (d?.polyline ? (decodePolyline(d.polyline) as Route) : null))
        .catch(() => null)
        .then((v) => (entry.value = v && v.length >= 2 ? v : null)),
    };
    cache.set(key, (hit = entry));
  }
  return hit.promise;
}

// La ruta si ya ha llegado, sin esperar ni pedirla (undefined si aún no está).
export const routeIfReady = (from: LatLng, mode: Mode, to: LatLng) => cache.get(keyOf(from, mode, to))?.value;

const TRAVEL: Record<Mode, string> = { TRANSIT: 'transit', DRIVE: 'driving', BICYCLE: 'bicycling', WALK: 'walking' };

// Google Maps con la ruta en su transporte. Sin origen, Google sale de donde esté quien lo abre.
export function mapsDirections(to: LatLng, mode: Mode, placeId?: string | null, from?: LatLng | null) {
  const q = new URLSearchParams({ api: '1', destination: `${to.lat},${to.lng}`, travelmode: TRAVEL[mode] });
  if (placeId?.startsWith('ChIJ')) q.set('destination_place_id', placeId);
  if (from) q.set('origin', `${from.lat},${from.lng}`);
  return `https://www.google.com/maps/dir/?${q}`;
}

// El mapa y las rutas de cada persona, igual en la app y en la página del enlace: un borde blanco debajo y,
// encima, el color de cada uno. Cada persona va un poco desplazada a un lado, así dos rutas que comparten
// calle se ven en paralelo en vez de taparse.
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import { gsap, reduceMotion } from '@/lib/gsap';
import type { LatLng } from '@/lib/types';

export type Drawn = { coords: [number, number][]; color: string; lane: number };

const STYLE = 'https://tiles.openfreemap.org/styles/positron';
const SRC = 'dq-routes';
const LANE_PX = 2.5;

// Mapa de OpenFreeMap (gratis, sin clave), quieto con un dedo para no secuestrar el scroll de la página.
export function createMap(container: HTMLElement, center: LatLng) {
  maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs'); // lo copia scripts/copy-map-worker.mjs
  const m = new maplibregl.Map({
    container, style: STYLE, center: [center.lng, center.lat], zoom: 13,
    attributionControl: { compact: true }, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false,
    locale: {
      'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda para hacer zoom',
      'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda para hacer zoom',
      'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
    },
  });
  m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
  m.touchZoomRotate.disableRotation();
  return m;
}

// El desplazamiento de cada persona, centrado: con cuatro, -3.75, -1.25, 1.25 y 3.75 px.
export const laneOf = (i: number, n: number) => (i - (n - 1) / 2) * LANE_PX;

const collection = (routes: Drawn[]): GeoJSON.FeatureCollection => ({
  type: 'FeatureCollection',
  features: routes.map((r) => ({
    type: 'Feature', properties: { color: r.color, lane: r.lane },
    geometry: { type: 'LineString', coordinates: r.coords },
  })),
});

function put(m: maplibregl.Map, routes: Drawn[]) {
  const src = m.getSource(SRC) as GeoJSONSource | undefined;
  if (src) return src.setData(collection(routes));
  m.addSource(SRC, { type: 'geojson', data: collection(routes) });
  const layout = { 'line-cap': 'round', 'line-join': 'round' } as const;
  m.addLayer({ id: `${SRC}-case`, type: 'line', source: SRC, layout, paint: { 'line-color': '#FFFFFF', 'line-width': 7, 'line-offset': ['get', 'lane'] } });
  m.addLayer({ id: SRC, type: 'line', source: SRC, layout, paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-offset': ['get', 'lane'], 'line-opacity': 0.95 } });
}

// El trozo inicial de una ruta, hasta la fracción t de su longitud: para dibujarla creciendo.
function head(coords: [number, number][], t: number): [number, number][] {
  if (t >= 1 || coords.length < 2) return coords;
  const seg = coords.slice(1).map((p, i) => Math.hypot(p[0] - coords[i][0], p[1] - coords[i][1]));
  let left = seg.reduce((a, b) => a + b, 0) * t;
  const out: [number, number][] = [coords[0]];
  for (let i = 0; i < seg.length; i++) {
    if (seg[i] >= left) {
      const k = seg[i] ? left / seg[i] : 0, a = coords[i], b = coords[i + 1];
      out.push([a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k]);
      return out;
    }
    out.push(coords[i + 1]);
    left -= seg[i];
  }
  return out;
}

// Dibuja las rutas creciendo desde la salida hasta el sitio, todas a la vez. Devuelve cómo parar la animación.
// En una pestaña en segundo plano no hay fotogramas de animación: ahí se dibujan enteras de una vez.
export function drawRoutes(m: maplibregl.Map, routes: Drawn[], grow = true) {
  if (!grow || !routes.length || reduceMotion() || document.hidden) {
    put(m, routes);
    return () => {};
  }
  const p = { t: 0 };
  const frame = () => put(m, routes.map((r) => ({ ...r, coords: head(r.coords, p.t) })));
  frame();
  const tween = gsap.to(p, { t: 1, duration: 0.9, ease: 'power2.inOut', onUpdate: frame });
  // Si el navegador no da fotogramas (pestaña o panel ocultos), las rutas quedan enteras igualmente.
  const done = setTimeout(() => { tween.kill(); put(m, routes); }, 1200);
  return () => { tween.kill(); clearTimeout(done); };
}

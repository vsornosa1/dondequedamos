'use client';
// Mapa con OpenFreeMap (gratis, sin clave). Cada persona traza su línea punteada hasta el sitio elegido.
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import type { GeoJSONSource } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COLORS, meetPinHtml } from './brand';
import { initialOf, nameOf } from '@/lib/client';
import { gsap, reduceMotion } from '@/lib/gsap';
import type { LatLng, Option, Person, Plan } from '@/lib/types';

type Props = {
  people: Person[];
  midpoint: LatLng;
  options: Option[];
  selected: Option;
  plan: Plan;
  onSelect: (id: string) => void;
  onOpen: () => void;
  departure: string; // hora de salida de la búsqueda, para que la ruta sea la de ese momento
};

const LINES = 'dq-lines';
const STYLE = 'https://tiles.openfreemap.org/styles/positron';

// Polilínea codificada de Google → [lng, lat].
function decode(s: string) {
  const out: [number, number][] = [];
  let i = 0, lat = 0, lng = 0;
  const next = () => { let r = 0, sh = 0, b; do { b = s.charCodeAt(i++) - 63; r |= (b & 0x1f) << sh; sh += 5; } while (b >= 0x20); return r & 1 ? ~(r >> 1) : r >> 1; };
  while (i < s.length) { lat += next(); lng += next(); out.push([lng / 1e5, lat / 1e5]); }
  return out;
}

// Una ruta por persona y sitio, guardada mientras dure la visita: volver a un sitio no repite la llamada.
const routes = new Map<string, Promise<[number, number][] | null>>();
function routeFor(p: Person, dest: LatLng, departure: string) {
  const key = `${p.loc!.lat},${p.loc!.lng}|${p.mode}|${dest.lat},${dest.lng}`;
  if (!routes.has(key)) {
    routes.set(key, fetch('/api/route', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ origin: p.loc, dest, mode: p.mode, when: departure }),
    }).then((r) => (r.ok ? r.json() : null)).then((d) => (d?.polyline ? decode(d.polyline) : null)).catch(() => null));
  }
  return routes.get(key)!;
}
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function MeetMap({ people, midpoint, options, selected, plan, onSelect, onOpen, departure }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const linesData = useRef<GeoJSON.FeatureCollection>({ type: 'FeatureCollection', features: [] });
  const fitted = useRef(false);
  const handlers = useRef({ onSelect, onOpen });
  handlers.current = { onSelect, onOpen };

  // Lo que se dibuja como capa se pierde al cambiar de estilo (modo oscuro): se vuelve a añadir.
  const syncLines = () => {
    const m = map.current;
    if (!m || !m.isStyleLoaded()) return;
    const src = m.getSource(LINES) as GeoJSONSource | undefined;
    if (src) return src.setData(linesData.current);
    m.addSource(LINES, { type: 'geojson', data: linesData.current });
    m.addLayer({
      id: LINES, type: 'line', source: LINES,
      layout: { 'line-cap': 'round', 'line-join': 'round' },
      paint: { 'line-color': ['get', 'color'], 'line-width': 5, 'line-opacity': 0.9 },
    });
  };

  useEffect(() => {
    if (!box.current) return;
    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs'); // lo copia scripts/copy-map-worker.mjs
    const m = new maplibregl.Map({
      container: box.current, style: STYLE,
      center: [selected.loc.lng, selected.loc.lat], zoom: 13,
      attributionControl: { compact: true }, cooperativeGestures: true, dragRotate: false, pitchWithRotate: false,
      locale: {
        'CooperativeGesturesHandler.WindowsHelpText': 'Usa Ctrl + rueda para hacer zoom',
        'CooperativeGesturesHandler.MacHelpText': 'Usa ⌘ + rueda para hacer zoom',
        'CooperativeGesturesHandler.MobileHelpText': 'Usa dos dedos para mover el mapa',
      },
    });
    m.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
    m.touchZoomRotate.disableRotation();
    m.on('style.load', syncLines);
    map.current = m;
    return () => {
      m.remove();
      map.current = null;
    };
  }, []); // el mapa se crea una vez; los cambios llegan por el efecto de abajo

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    markers.current.forEach((mk) => mk.remove());
    markers.current = [];
    const pin = (className: string, html: string, title: string, color?: string) => {
      const el = document.createElement('div');
      el.className = className;
      el.innerHTML = html;
      el.title = title;
      if (color) el.style.setProperty('--c', color);
      return el;
    };
    const add = (loc: LatLng, el: HTMLElement, anchor: 'center' | 'bottom' = 'center') =>
      markers.current.push(new maplibregl.Marker({ element: el, anchor }).setLngLat([loc.lng, loc.lat]).addTo(m));

    add(midpoint, pin('pin mid', '½', 'Punto medio del mapa'));
    options.forEach((o, k) => {
      if (o.id === selected.id) return;
      const el = pin('pin venue', String(k + 1), o.name);
      el.addEventListener('click', () => handlers.current.onSelect(o.id));
      add(o.loc, el);
    });
    people.forEach((p, i) => p.loc && add(p.loc, pin('pin', esc(initialOf(p, i)), nameOf(p, i), COLORS[i])));
    const meet = pin('pin-meet', meetPinHtml(plan), selected.name);
    meet.addEventListener('click', () => handlers.current.onOpen());
    add(selected.loc, meet, 'bottom');
    if (!reduceMotion()) gsap.from(meet.firstElementChild, { y: -26, scale: 0.6, duration: 0.6, ease: 'bounce.out', transformOrigin: '50% 100%' });

    // Mientras llegan las rutas reales (o si fallan) se ve una línea recta punteada.
    const straight = (p: Person, i: number) => ({
      type: 'Feature' as const, properties: { color: COLORS[i], real: 0 },
      geometry: { type: 'LineString' as const, coordinates: [[p.loc!.lng, p.loc!.lat], [selected.loc.lng, selected.loc.lat]] },
    });
    const withLoc = people.map((p, i) => [p, i] as const).filter(([p]) => p.loc);
    linesData.current = { type: 'FeatureCollection', features: withLoc.map(([p, i]) => straight(p, i)) };
    syncLines();
    // Se piden tras un momento quieto en el sitio: pasar tarjetas deprisa no gasta rutas.
    let live = true;
    const t = setTimeout(async () => {
      const got = await Promise.all(withLoc.map(([p]) => routeFor(p, selected.loc, departure)));
      if (!live) return;
      linesData.current = {
        type: 'FeatureCollection',
        features: withLoc.map(([p, i], k) => (got[k]?.length
          ? { type: 'Feature' as const, properties: { color: COLORS[i], real: 1 }, geometry: { type: 'LineString' as const, coordinates: got[k]! } }
          : straight(p, i))),
      };
      syncLines();
    }, 600);

    const bounds = new maplibregl.LngLatBounds();
    people.forEach((p) => p.loc && bounds.extend([p.loc.lng, p.loc.lat]));
    bounds.extend([selected.loc.lng, selected.loc.lat]);
    m.fitBounds(bounds, { padding: { top: 56, bottom: 40, left: 40, right: 40 }, maxZoom: 15, duration: fitted.current && !reduceMotion() ? 700 : 0 });
    fitted.current = true;
    return () => { live = false; clearTimeout(t); };
  }, [people, midpoint, options, selected, plan, departure]);

  return <div className="map" ref={box} />;
}

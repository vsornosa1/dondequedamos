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
};

const LINES = 'dq-lines';
const styleUrl = (dark: boolean) => `https://tiles.openfreemap.org/styles/${dark ? 'dark' : 'positron'}`;
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function MeetMap({ people, midpoint, options, selected, plan, onSelect, onOpen }: Props) {
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
      paint: { 'line-color': ['get', 'color'], 'line-width': 4, 'line-opacity': 0.9, 'line-dasharray': [0.2, 2] },
    });
  };

  useEffect(() => {
    if (!box.current) return;
    maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs'); // lo copia scripts/copy-map-worker.mjs
    const dark = window.matchMedia('(prefers-color-scheme: dark)');
    const m = new maplibregl.Map({
      container: box.current, style: styleUrl(dark.matches),
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
    const onTheme = () => m.setStyle(styleUrl(dark.matches));
    dark.addEventListener('change', onTheme);
    map.current = m;
    return () => {
      dark.removeEventListener('change', onTheme);
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

    linesData.current = {
      type: 'FeatureCollection',
      features: people.flatMap((p, i) => (p.loc ? [{
        type: 'Feature' as const, properties: { color: COLORS[i] },
        geometry: { type: 'LineString' as const, coordinates: [[p.loc.lng, p.loc.lat], [selected.loc.lng, selected.loc.lat]] },
      }] : [])),
    };
    syncLines();

    const bounds = new maplibregl.LngLatBounds();
    people.forEach((p) => p.loc && bounds.extend([p.loc.lng, p.loc.lat]));
    bounds.extend([selected.loc.lng, selected.loc.lat]);
    m.fitBounds(bounds, { padding: { top: 56, bottom: 40, left: 40, right: 40 }, maxZoom: 15, duration: fitted.current && !reduceMotion() ? 700 : 0 });
    fitted.current = true;
  }, [people, midpoint, options, selected, plan]);

  return <div className="map" ref={box} />;
}

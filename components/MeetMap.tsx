'use client';
// El mapa de resultados: cada persona traza su ruta real hasta el sitio elegido, en su transporte, como en
// Google Maps. Mientras llega no se dibuja nada: una línea recta engañaría (andando no se cruza una autovía).
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COLORS, meetPinHtml } from './brand';
import { createMap, drawRoutes, laneOf, type Drawn } from './routeLayers';
import { initialOf, nameOf } from '@/lib/client';
import { gsap, reduceMotion } from '@/lib/gsap';
import { routeFor } from '@/lib/routes';
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

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export default function MeetMap({ people, midpoint, options, selected, plan, onSelect, onOpen, departure }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const map = useRef<maplibregl.Map | null>(null);
  // Si el estilo ya admite capas. No vale isStyleLoaded(): también espera a las teselas, y justo al
  // terminar la búsqueda daba falso, así que las rutas del primer sitio no llegaban a dibujarse.
  const ready = useRef(false);
  const routes = useRef<{ list: Drawn[]; grow: boolean }>({ list: [], grow: false });
  const stop = useRef(() => {});
  const markers = useRef<maplibregl.Marker[]>([]);
  const fitted = useRef(false);
  const first = useRef(true);
  const handlers = useRef({ onSelect, onOpen });
  handlers.current = { onSelect, onOpen };

  const draw = () => {
    const m = map.current;
    if (!m || !ready.current) return;
    stop.current();
    stop.current = drawRoutes(m, routes.current.list, routes.current.grow);
    routes.current.grow = false;
  };

  useEffect(() => {
    if (!box.current) return;
    const m = createMap(box.current, selected.loc);
    m.on('style.load', () => { ready.current = true; draw(); });
    map.current = m;
    return () => {
      stop.current();
      m.remove();
      map.current = null;
      ready.current = false;
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

    // Fuera las rutas del sitio anterior; las de este crecen juntas cuando han llegado todas.
    routes.current = { list: [], grow: false };
    draw();
    const withLoc = people.map((p, i) => [p, i] as const).filter(([p]) => p.loc);
    let live = true;
    // Las del primer sitio se piden ya; al pasar tarjetas, tras un momento quieto, para no gastar rutas.
    const delay = first.current ? 0 : 600;
    first.current = false;
    const t = setTimeout(async () => {
      const got = await Promise.all(withLoc.map(([p]) => routeFor(p.loc!, p.mode, selected.loc, departure)));
      if (!live) return;
      routes.current = {
        list: withLoc.flatMap(([, i], k) => (got[k] ? [{ coords: got[k]!, color: COLORS[i], lane: laneOf(i, people.length) }] : [])),
        grow: true,
      };
      draw();
    }, delay);

    const bounds = new maplibregl.LngLatBounds();
    people.forEach((p) => p.loc && bounds.extend([p.loc.lng, p.loc.lat]));
    bounds.extend([selected.loc.lng, selected.loc.lat]);
    m.fitBounds(bounds, { padding: { top: 56, bottom: 40, left: 40, right: 40 }, maxZoom: 15, duration: fitted.current && !reduceMotion() ? 700 : 0 });
    fitted.current = true;
    return () => { live = false; clearTimeout(t); };
  }, [people, midpoint, options, selected, plan, departure]);

  return <div className="map" ref={box} />;
}

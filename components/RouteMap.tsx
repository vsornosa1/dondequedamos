'use client';
// El mapa de quien abre el enlace: el sitio y la ruta de cada uno tal como venía en el enlace, sin sus
// primeros metros (el enlace no dice desde qué portal sale nadie).
import { useEffect, useRef } from 'react';
import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { COLORS, INK, destPinHtml, meetPinHtml, type Badge } from './brand';
import { createMap, drawRoutes, laneOf } from './routeLayers';
import { initialOf } from '@/lib/client';
import type { LatLng, Proposal } from '@/lib/types';

type Props = {
  to: LatLng; plan: Badge; name: string; people: { name: string }[]; routes: ([number, number][] | null)[];
  trip?: Proposal['trip']; // con destino: la bandera y el tramo juntos
};

export default function RouteMap({ to, plan, name, people, routes, trip = null }: Props) {
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!box.current) return;
    const m = createMap(box.current, to);
    const drawn = [
      ...(trip?.route ? [{ coords: trip.route, color: INK, lane: 0 }] : []),
      ...routes.flatMap((r, i) => (r ? [{ coords: r, color: COLORS[i], lane: laneOf(i, people.length) }] : [])),
    ];
    let stop = () => {};
    m.on('style.load', () => { stop = drawRoutes(m, drawn); });

    // Cada ruta empieza con la inicial de quien la hace; el sitio, con la chincheta del plan.
    routes.forEach((r, i) => {
      if (!r) return;
      const el = document.createElement('div');
      el.className = 'pin';
      el.textContent = initialOf(people[i], i);
      el.title = people[i].name;
      el.style.setProperty('--c', COLORS[i]);
      new maplibregl.Marker({ element: el }).setLngLat(r[0]).addTo(m);
    });
    const meet = document.createElement('div');
    meet.className = 'pin-meet';
    meet.innerHTML = meetPinHtml(plan);
    meet.title = name;
    new maplibregl.Marker({ element: meet, anchor: 'bottom' }).setLngLat([to.lng, to.lat]).addTo(m);

    if (trip) {
      const flag = document.createElement('div');
      flag.className = 'pin-meet dest';
      flag.innerHTML = destPinHtml();
      flag.title = trip.name;
      new maplibregl.Marker({ element: flag, anchor: 'bottom' }).setLngLat([trip.loc.lng, trip.loc.lat]).addTo(m);
    }

    const bounds = new maplibregl.LngLatBounds([to.lng, to.lat], [to.lng, to.lat]);
    if (trip) bounds.extend([trip.loc.lng, trip.loc.lat]);
    drawn.forEach((r) => r.coords.forEach((c) => bounds.extend(c)));
    if (drawn.length || trip) m.fitBounds(bounds, { padding: { top: 56, bottom: 40, left: 40, right: 40 }, maxZoom: 15, duration: 0 });
    else m.setZoom(15);
    return () => { stop(); m.remove(); };
  }, [to, plan, name, people, routes, trip]);

  return <div className="map" ref={box} />;
}

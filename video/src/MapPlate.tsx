import React, { useEffect, useRef, useState } from 'react';
import { AbsoluteFill, continueRender, delayRender, staticFile } from 'remotion';
import * as maplibregl from 'maplibre-gl';
import type { StyleSpecification, LayerSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import positron from './data/positron.json';
import { PLATE } from './geo';

// Renders a map plate once, with network: npx remotion still src/index.ts MapNight public/map-night.png
// The film only ever shows the saved PNGs.

type Theme = Record<string, string>;

const NIGHT: Theme = {
  background: '#0E1A2B', landuse: '#0F1C2F', park: '#123326', water: '#08111D', building: '#13233A',
  buildingLine: '#172941', minor: '#1A2A42', major: '#22344F', casing: '#18273D', motorway: '#283C5A', rail: '#1A2A42', path: '#14243A',
};
const DAY: Theme = {
  background: '#F0F0EA', landuse: '#ECECE5', park: '#DCE8D0', water: '#CFE0EA', building: '#E4E4DC',
  buildingLine: '#DADAD0', minor: '#FFFFFF', major: '#FFFFFF', casing: '#D9DAD1', motorway: '#FFFFFF', rail: '#D9DAD1', path: '#F8F8F3',
};

function styleFor(t: Theme): StyleSpecification {
  const src = positron as unknown as StyleSpecification;
  const color = (l: LayerSpecification): string | null => {
    const id = l.id;
    if (id === 'background') return t.background;
    if (id === 'park' || id === 'landcover_wood') return t.park;
    if (id === 'water' || id === 'waterway') return t.water;
    if (id.startsWith('landuse')) return t.landuse;
    if (id === 'building') return t.building;
    if (id.includes('casing')) return t.casing;
    if (id.includes('motorway')) return t.motorway;
    if (id.startsWith('highway_major')) return t.major;
    if (id === 'highway_minor') return t.minor;
    if (id === 'highway_path') return t.path;
    if (id.startsWith('railway')) return t.rail;
    if (id.startsWith('road_') || id.startsWith('aeroway')) return t.landuse;
    return null;
  };
  const layers = src.layers
    .filter((l) => l.type !== 'symbol' && !l.id.startsWith('boundary') && !l.id.startsWith('landcover_ice') && !l.id.startsWith('landcover_glacier'))
    .filter((l) => !l.id.endsWith('dashline'))
    .map((l) => {
      const fill = color(l);
      if (!fill) return l;
      const paint: Record<string, unknown> = { ...(l as { paint?: object }).paint };
      if (l.type === 'background') paint['background-color'] = fill;
      if (l.type === 'fill') {
        paint['fill-color'] = fill;
        if (l.id === 'building') paint['fill-outline-color'] = t.buildingLine;
        if (l.id.startsWith('landuse')) paint['fill-opacity'] = 1;
      }
      if (l.type === 'line') {
        paint['line-color'] = fill;
        delete paint['line-dasharray'];
      }
      return { ...l, paint } as LayerSpecification;
    });
  // Positron leaves grass out, which hides the Jardí del Túria: add it back, below the roads.
  const grass = {
    id: 'grass', type: 'fill', source: 'openmaptiles', 'source-layer': 'landcover',
    filter: ['in', ['get', 'class'], ['literal', ['grass', 'wood']]], paint: { 'fill-color': t.park },
  } as LayerSpecification;
  const at = layers.findIndex((l) => l.id === 'water');
  layers.splice(at, 0, grass);
  return { version: 8, sources: { openmaptiles: src.sources.openmaptiles }, layers };
}

export const MapPlate = ({ theme }: { theme: 'night' | 'day' }) => {
  const box = useRef<HTMLDivElement>(null);
  const [handle] = useState(() => delayRender('map tiles', { timeoutInMilliseconds: 240000 }));
  useEffect(() => {
    maplibregl.setWorkerUrl(staticFile('maplibre-gl-worker.mjs'));
    const map = new maplibregl.Map({
      container: box.current!,
      style: styleFor(theme === 'night' ? NIGHT : DAY),
      center: [PLATE.center.lng, PLATE.center.lat],
      zoom: PLATE.zoom,
      interactive: false,
      attributionControl: false,
      fadeDuration: 0,
      pixelRatio: 1,
      canvasContextAttributes: { preserveDrawingBuffer: true, antialias: true },
    });
    map.once('idle', () => setTimeout(() => continueRender(handle), 500));
    map.on('error', (e) => console.error('map error', e.error?.message));
  }, [handle, theme]);
  return (
    <AbsoluteFill>
      <div ref={box} style={{ width: PLATE.w, height: PLATE.h }} />
    </AbsoluteFill>
  );
};

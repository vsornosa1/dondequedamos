// MapLibre 6 busca su worker junto a su propio módulo, y al empaquetar con Next ese archivo no existe.
// Antes de dev y build se copia a public/ con la versión instalada, y el mapa lo pide desde ahí.
import { copyFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve('maplibre-gl/package.json'));
mkdirSync('public', { recursive: true });
copyFileSync(join(dist, 'dist', 'maplibre-gl-worker.mjs'), join('public', 'maplibre-gl-worker.mjs'));

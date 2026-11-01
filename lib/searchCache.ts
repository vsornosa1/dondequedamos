// Guarda los resultados de búsqueda unos minutos: en Upstash si está configurado (compartido entre
// instancias), si no en memoria. Un fallo de la caché nunca rompe la búsqueda.
import { redis, redisEnabled } from './redis';
import { CACHE_MIN } from './search.js';

const TTL = CACHE_MIN * 60;
const mem = new Map<string, { at: number; v: string }>();

export async function cacheGet(key: string): Promise<unknown | null> {
  try {
    if (redisEnabled()) {
      const v = await redis(['GET', key]);
      return typeof v === 'string' ? JSON.parse(v) : null;
    }
    const e = mem.get(key);
    return e && Date.now() - e.at < TTL * 1000 ? JSON.parse(e.v) : null;
  } catch (e) { console.error(e); return null; }
}

export async function cacheSet(key: string, value: unknown) {
  const v = JSON.stringify(value);
  try {
    if (redisEnabled()) { await redis(['SET', key, v, 'EX', TTL]); return; }
    if (mem.size > 500) mem.clear();
    mem.set(key, { at: Date.now(), v });
  } catch (e) { console.error(e); }
}

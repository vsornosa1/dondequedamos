// Utilidades de las rutas /api: clave de Google, límite por IP y errores.
import { NextResponse, type NextRequest } from 'next/server';
import { makeGoogle } from './google.js';
import { mockFetch } from './mockGoogle.js';
import { pipeline, redisEnabled } from './redis';

const hits = new Map<string, number[]>();

// Límite por IP. Con Upstash se cuenta en Redis (ventana fija), compartido entre todas las instancias de
// Vercel: en memoria cada instancia lleva su propia cuenta y se pierde al reiniciarse, así que no frena.
// Si Redis falla, se sigue contando en memoria antes que dejar pasar todo o bloquear a todos.
export async function limited(req: NextRequest, bucket: string, max: number, windowMs: number) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
  const k = `${bucket}:${ip}`, now = Date.now();
  if (redisEnabled()) {
    const key = `rl:${k}:${Math.floor(now / windowMs)}`;
    try {
      const [n] = await pipeline([['INCR', key], ['EXPIRE', key, Math.ceil(windowMs / 1000)]]);
      return Number(n) > max;
    } catch (e) { console.error(e); }
  }
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return true;
  arr.push(now);
  hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

// Sin clave (o con la clave «mock») fuera de producción se usan datos simulados, para trabajar en la interfaz
// sin gastar: `npm run dev:mock` arranca así aunque el .env tenga la clave de verdad.
export function getGoogle() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const dev = process.env.NODE_ENV !== 'production';
  if (dev && (!key || key === 'mock')) return makeGoogle('mock', mockFetch as unknown as typeof fetch);
  return key ? makeGoogle(key) : null;
}

export const json = (data: unknown, status = 200, headers?: HeadersInit) => NextResponse.json(data, { status, headers });
export const tooMany = (msg: string) => json({ error: msg }, 429);
export const noKey = () => json({ error: 'Falta configurar la clave de Google Maps en el servidor.' }, 503);

export function fail(e: unknown) {
  const err = e as { status?: number; message?: string };
  const status = err.status && err.status < 500 && err.status !== 403 && err.status !== 401 ? err.status : 502;
  if (status === 502) console.error(e);
  return json({ error: status === 502 ? 'Google Maps no ha respondido bien. Prueba en un momento.' : err.message }, status);
}

// Utilidades de las rutas /api: clave de Google, límite por IP y errores.
import { NextResponse, type NextRequest } from 'next/server';
import { makeGoogle } from './google.js';
import { mockFetch } from './mockGoogle.js';
import { pipeline, redisEnabled } from './redis';
import { capsFromEnv, closedGoogle, guardGoogle, makeQuota, memoryStore, safetyFromEnv } from './quota.js';
import { redisQuotaStore } from './quotaStore';
import { freeRoutingFromEnv, withFreeRouting } from './freeRouting.js';

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

// El simulado cuenta en memoria: así se puede probar el cupo en local sin tocar los contadores de producción.
let localCounts: ReturnType<typeof memoryStore> | null = null;

// El cliente de mapas de las rutas /api:
// - Sin clave (o con la clave «mock») fuera de producción, datos simulados para trabajar sin gastar
//   (`npm run dev:mock` arranca así aunque el .env tenga la clave de verdad).
// - Cada llamada a Google pasa por el guardián del tramo gratuito (lib/quota.js): lo que no cabe en el
//   tramo gratis no se llama. Se cuenta en Upstash Redis; en producción sin Redis no se llama a Google,
//   porque sin una cuenta compartida no hay garantía de no pasarse. FREE_TIER_GUARD=off lo quita (y entonces
//   Google cobra lo que pase del tramo gratis).
// - Con OSRM_* u OTP_URL, la matriz y las rutas de esos transportes van a servidores propios, gratis.
export function getGoogle() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  const prod = process.env.NODE_ENV === 'production';
  const mock = !prod && (!key || key === 'mock');
  if (!mock && !key) return null;
  const nearbyTier = process.env.PLACES_NEARBY_TIER === 'enterprise' ? 'enterprise' : 'pro';
  const base = mock
    ? makeGoogle('mock', mockFetch as unknown as typeof fetch, { nearbyTier })
    : makeGoogle(key!, fetch, { nearbyTier });
  const free = freeRoutingFromEnv();
  if (process.env.FREE_TIER_GUARD === 'off' && !mock) return withFreeRouting(base, free);
  const store = mock ? (localCounts ??= memoryStore()) : redisEnabled() ? redisQuotaStore : prod ? null : (localCounts ??= memoryStore());
  if (!store) {
    console.error('Sin Upstash Redis no se puede contar el tramo gratuito: no se llama a Google.');
    return withFreeRouting(closedGoogle(base), free);
  }
  return withFreeRouting(guardGoogle(base, makeQuota({ store, caps: capsFromEnv(), safety: safetyFromEnv() })), free);
}

export const json = (data: unknown, status = 200, headers?: HeadersInit) => NextResponse.json(data, { status, headers });
export const tooMany = (msg: string) => json({ error: msg }, 429);
export const noKey = () => json({ error: 'Falta configurar la clave de Google Maps en el servidor.' }, 503);

// La hora de España a la que se renueva el cupo diario («9:00»).
const madridTime = (ms: number) => new Intl.DateTimeFormat('es-ES', { hour: 'numeric', minute: '2-digit', timeZone: 'Europe/Madrid' }).format(new Date(ms));

export function fail(e: unknown) {
  const err = e as { status?: number; message?: string; code?: string; reason?: string; resetAt?: number };
  if (err.code === 'quota') {
    const closed = err.reason === 'store';
    return json({
      error: closed
        ? 'Ahora mismo no podemos consultar Google Maps. Prueba en un rato.'
        : `Por hoy se ha acabado el cupo gratis de Google Maps. Se renueva a las ${madridTime(err.resetAt!)}.`,
      code: 'quota', reason: closed ? 'store' : 'cap', resetAt: err.resetAt, resetText: madridTime(err.resetAt!),
    }, closed ? 503 : 429);
  }
  const status = err.status && err.status < 500 && err.status !== 403 && err.status !== 401 ? err.status : 502;
  if (status === 502) console.error(e);
  return json({ error: status === 502 ? 'Google Maps no ha respondido bien. Prueba en un momento.' : err.message }, status);
}

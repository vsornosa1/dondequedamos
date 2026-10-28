// Utilidades de las rutas /api: clave de Google, límite por IP y errores.
import { NextResponse, type NextRequest } from 'next/server';
import { makeGoogle } from './google.js';
import { mockFetch } from './mockGoogle.js';

const hits = new Map<string, number[]>();

export function limited(req: NextRequest, bucket: string, max: number, windowMs: number) {
  const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim() || 'anon';
  const k = `${bucket}:${ip}`, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  if (arr.length >= max) return true;
  arr.push(now);
  hits.set(k, arr);
  if (hits.size > 5000) hits.clear();
  return false;
}

// Sin clave fuera de producción se usan datos simulados, para poder trabajar en la interfaz.
export function getGoogle() {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (key) return makeGoogle(key);
  if (process.env.NODE_ENV !== 'production') return makeGoogle('mock', mockFetch as unknown as typeof fetch);
  return null;
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

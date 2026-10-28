import type { NextRequest } from 'next/server';
import { fail, getGoogle, json, limited, noKey, tooMany } from '@/lib/api';

const MODES = ['TRANSIT', 'DRIVE', 'BICYCLE', 'WALK'];
const point = (p: unknown) => {
  const v = p as { lat?: unknown; lng?: unknown } | null;
  const lat = Number(v?.lat), lng = Number(v?.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null;
};

// La ruta de una persona hasta el sitio elegido, para dibujarla en el mapa.
export async function POST(req: NextRequest) {
  if (limited(req, 'ro', 80, 600_000)) return tooMany('Demasiadas rutas, espera un poco.');
  const google = getGoogle();
  if (!google) return noKey();
  const { origin, dest, mode, when } = await req.json().catch(() => ({}));
  const a = point(origin), b = point(dest);
  if (!a || !b || !MODES.includes(mode)) return json({ error: 'Ruta no válida.' }, 400);
  const at = new Date(Math.max(Date.now() + 60_000, Date.parse(when) || 0)).toISOString();
  try {
    return json(await google.route(a, b, mode, at));
  } catch (e) {
    return fail(e);
  }
}

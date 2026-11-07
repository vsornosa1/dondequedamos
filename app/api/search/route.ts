import type { NextRequest } from 'next/server';
import { findMeetingPlace, findMeetingPoint, searchKey } from '@/lib/search.js';
import { cacheGet, cacheSet } from '@/lib/searchCache';
import { fail, getGoogle, json, limited, noKey, tooMany } from '@/lib/api';

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  const { friends, plan, when, to, together } = await req.json().catch(() => ({}));
  const clean = Array.isArray(friends)
    ? friends.map((f) => ({ mode: f?.mode, modes: Array.isArray(f?.modes) ? f.modes.slice(0, 4) : undefined, loc: { lat: Number(f?.loc?.lat), lng: Number(f?.loc?.lng) } }))
    : friends;
  // Con destino («Ya tenemos destino»): se busca dónde quedar antes para seguir juntos hasta allí.
  const trip = to ? { to: { lat: Number(to?.lat), lng: Number(to?.lng) }, together: typeof together === 'string' ? together : 'DRIVE' } : null;

  // Lo que ya está en caché no gasta Google, así que tampoco cuenta para el límite.
  const key = searchKey(clean, plan, when, Date.now(), trip);
  const hit = key ? await cacheGet(key) : null;
  if (hit) return json(hit, 200, { 'x-cache': 'hit' });

  if (await limited(req, 'se', 12, 3_600_000)) return tooMany('Has hecho muchas búsquedas seguidas. Vuelve en un rato.');
  const google = getGoogle();
  if (!google) return noKey();
  try {
    const result = trip
      ? await findMeetingPoint(google, { friends: clean, to: trip.to, together: trip.together, when })
      : await findMeetingPlace(google, { friends: clean, plan, when });
    if (key) await cacheSet(key, result);
    return json(result);
  } catch (e) {
    return fail(e);
  }
}

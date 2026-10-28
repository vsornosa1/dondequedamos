import type { NextRequest } from 'next/server';
import { findMeetingPlace } from '@/lib/search.js';
import { fail, getGoogle, json, limited, noKey, tooMany } from '@/lib/api';

export const maxDuration = 20;

export async function POST(req: NextRequest) {
  if (limited(req, 'se', 12, 3_600_000)) return tooMany('Has hecho muchas búsquedas seguidas. Vuelve en un rato.');
  const google = getGoogle();
  if (!google) return noKey();
  const { friends, plan, when } = await req.json().catch(() => ({}));
  const clean = Array.isArray(friends)
    ? friends.map((f) => ({ mode: f?.mode, loc: { lat: Number(f?.loc?.lat), lng: Number(f?.loc?.lng) } }))
    : friends;
  try {
    return json(await findMeetingPlace(google, { friends: clean, plan, when }));
  } catch (e) {
    return fail(e);
  }
}

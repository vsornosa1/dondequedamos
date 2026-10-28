import type { NextRequest } from 'next/server';
import { fail, getGoogle, json, limited, noKey, tooMany } from '@/lib/api';

export async function POST(req: NextRequest) {
  if (limited(req, 'ac', 120, 600_000)) return tooMany('Demasiadas búsquedas, espera un poco.');
  const google = getGoogle();
  if (!google) return noKey();
  const { input, session, bias } = await req.json().catch(() => ({}));
  if (typeof input !== 'string' || input.trim().length < 3 || input.length > 120) return json({ items: [] });
  try {
    return json({ items: await google.autocomplete(input.trim(), session, bias) });
  } catch (e) {
    return fail(e);
  }
}

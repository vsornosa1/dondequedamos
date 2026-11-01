import type { NextRequest } from 'next/server';
import { fail, getGoogle, json, limited, noKey, tooMany } from '@/lib/api';

export async function POST(req: NextRequest) {
  if (await limited(req, 'pl', 60, 600_000)) return tooMany('Demasiadas búsquedas, espera un poco.');
  const google = getGoogle();
  if (!google) return noKey();
  const { id, session } = await req.json().catch(() => ({}));
  if (typeof id !== 'string' || !/^[\w-]{10,300}$/.test(id)) return json({ error: 'Lugar no válido.' }, 400);
  try {
    return json(await google.place(id, session));
  } catch (e) {
    return fail(e);
  }
}

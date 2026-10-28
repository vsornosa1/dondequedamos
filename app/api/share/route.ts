import type { NextRequest } from 'next/server';
import { json, limited, tooMany } from '@/lib/api';
import { decodeProposal } from '@/lib/share.js';
import { createShort, shortLinksEnabled } from '@/lib/shortlinks';

// Convierte el enlace largo en uno corto. Solo guarda lo que ya enseña la página de la propuesta.
export async function POST(req: NextRequest) {
  if (!shortLinksEnabled()) return json({ error: 'Enlaces cortos no configurados.' }, 503);
  if (limited(req, 'sh', 40, 600_000)) return tooMany('Demasiados enlaces, espera un poco.');
  const { d } = await req.json().catch(() => ({}));
  if (typeof d !== 'string' || d.length > 1500 || !decodeProposal(d)) return json({ error: 'Propuesta no válida.' }, 400);
  try {
    return json({ id: await createShort(d) });
  } catch {
    return json({ error: 'No se ha podido crear el enlace corto.' }, 502);
  }
}

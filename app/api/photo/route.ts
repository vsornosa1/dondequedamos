import { NextResponse, type NextRequest } from 'next/server';
import { fail, getGoogle, json, limited, noKey, tooMany } from '@/lib/api';

// <img src="/api/photo?n=…"> redirige a la foto de Google sin exponer la clave.
export async function GET(req: NextRequest) {
  const name = req.nextUrl.searchParams.get('n') || '';
  const width = Math.min(1600, Math.max(100, Number(req.nextUrl.searchParams.get('w')) || 800));
  if (!/^places\/[\w-]+\/photos\/[\w-]+$/.test(name)) return json({ error: 'Foto no válida.' }, 400);
  if (limited(req, 'ph', 240, 600_000)) return tooMany('Demasiadas fotos, espera un poco.');
  const google = getGoogle();
  if (!google) return noKey();
  try {
    const uri: string = await google.photo(name, width);
    const cache = { 'Cache-Control': 'public, max-age=3600, s-maxage=3600' };
    // Las fotos simuladas son SVG en data: y un redirect a data: no se sigue: se sirven tal cual.
    if (uri.startsWith('data:image/svg+xml')) {
      const svg = decodeURIComponent(uri.slice(uri.indexOf(',') + 1));
      return new NextResponse(svg, { headers: { 'Content-Type': 'image/svg+xml', ...cache } });
    }
    return NextResponse.redirect(uri, { status: 302, headers: cache });
  } catch (e) {
    return fail(e);
  }
}

// La vista previa del enlace en WhatsApp: el cartel amarillo con el sitio y lo que tarda cada uno.
import { ImageResponse } from 'next/og';
import { loadProposal } from '@/lib/shortlinks';
import { INK, OG_SIZE, OgLines, OgMark, PAPER, SIGNAL, ogFonts } from '@/lib/og';
import { COLORS } from '@/components/brand';
import type { Proposal } from '@/lib/types';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = 'Propuesta de sitio para quedar';

export default async function Image({ params }: { params: Promise<{ data: string }> }) {
  const p = (await loadProposal((await params).data)) as Proposal | null;
  const fonts = await ogFonts();
  const people = (p?.people ?? []).slice(0, 5).map((x, i) => ({ name: x.name.slice(0, 11), min: x.min, color: COLORS[i] }));
  const name = p?.name ?? '¿Dónde quedamos?';
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: PAPER, fontFamily: 'Overpass', color: INK }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 560, padding: '56px 52px', background: SIGNAL }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 30, fontWeight: 800 }}>
            <OgMark size={58} />¿Quedamos aquí?
          </div>
          <div style={{ display: 'flex', fontSize: name.length > 22 ? 64 : 80, fontWeight: 900, lineHeight: 0.98, letterSpacing: -2 }}>{name}</div>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 800 }}>El sitio más justo para todos</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, padding: '40px 60px 40px 44px' }}>
          <div style={{ display: 'flex', fontSize: 28, fontWeight: 600, marginBottom: 18, color: '#4A5565' }}>Lo que tarda cada uno</div>
          <OgLines people={people} width={540} />
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

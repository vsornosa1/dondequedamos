// Vista previa de la portada: la idea en una imagen (el punto medio frente al sitio justo).
import { ImageResponse } from 'next/og';
import { INK, OG_SIZE, OgLines, OgMark, PAPER, ogFonts } from '@/lib/og';

export const size = OG_SIZE;
export const contentType = 'image/png';
export const alt = '¿Dónde quedamos? El sitio donde todos tardáis lo mismo';

export default async function Image() {
  const fonts = await ogFonts();
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: PAPER, fontFamily: 'Overpass', color: INK, padding: '60px 64px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', width: 560 }}>
          <OgMark size={84} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 104, fontWeight: 900, lineHeight: 0.92, letterSpacing: -4 }}>¿Dónde</div>
            <div style={{ display: 'flex', fontSize: 104, fontWeight: 900, lineHeight: 0.92, letterSpacing: -4 }}>quedamos?</div>
          </div>
          <div style={{ display: 'flex', fontSize: 32, fontWeight: 600, color: '#4A5565', lineHeight: 1.3 }}>
            El sitio donde todos tardáis lo mismo, cada uno con su transporte.
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', flex: 1, paddingLeft: 40, gap: 36 }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, marginBottom: 6 }}>Punto medio del mapa</div>
            <OgLines width={460} people={[{ name: 'Laura', min: 38, color: '#E5352B' }, { name: 'Marta', min: 9, color: '#1F6FD1' }]} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', fontSize: 26, fontWeight: 800, marginBottom: 6 }}>El sitio justo</div>
            <OgLines width={460} people={[{ name: 'Laura', min: 19, color: '#E5352B' }, { name: 'Marta', min: 20, color: '#1F6FD1' }]} />
          </div>
        </div>
      </div>
    ),
    { ...size, fonts },
  );
}

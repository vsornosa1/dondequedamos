// Icono para «Añadir a pantalla de inicio» en iPhone.
import { ImageResponse } from 'next/og';
import { OgMark } from '@/lib/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ display: 'flex', width: '100%', height: '100%', background: '#FFD100', alignItems: 'center', justifyContent: 'center' }}>
        <OgMark size={180} />
      </div>
    ),
    size,
  );
}

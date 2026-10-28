// Piezas comunes de las imágenes de vista previa (WhatsApp, LinkedIn…), dibujadas en el servidor.
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

export const OG_SIZE = { width: 1200, height: 630 };

export async function ogFonts() {
  const font = (w: number) => readFile(join(process.cwd(), 'assets/fonts', `Overpass-${w}.ttf`));
  const [w600, w800, w900] = await Promise.all([font(600), font(800), font(900)]);
  return [
    { name: 'Overpass', data: w600, weight: 600 as const, style: 'normal' as const },
    { name: 'Overpass', data: w800, weight: 800 as const, style: 'normal' as const },
    { name: 'Overpass', data: w900, weight: 900 as const, style: 'normal' as const },
  ];
}

export const INK = '#0E1A2B';
export const PAPER = '#F0F0EA';
export const SIGNAL = '#FFD100';

export function OgMark({ size = 72 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48">
      <rect width="48" height="48" rx="12" fill={SIGNAL} />
      <path d="M9 14h8l9 10" stroke="#E5352B" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <path d="M9 24h17" stroke="#1F6FD1" strokeWidth="4" strokeLinecap="round" fill="none" />
      <path d="M9 34h8l9-10" stroke="#12A150" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      <circle cx="32" cy="24" r="6" fill={INK} />
    </svg>
  );
}

// Líneas de minutos para la imagen: cada persona, su color y su largo; todas acaban en el punto amarillo.
export function OgLines({ people, width }: { people: { name: string; min: number; color: string }[]; width: number }) {
  const max = Math.max(10, ...people.map((p) => p.min));
  const rowH = Math.min(64, Math.floor(300 / Math.max(people.length, 1)));
  return (
    <div style={{ display: 'flex', flexDirection: 'column', width, position: 'relative' }}>
      {people.map((p) => {
        const len = Math.max(30, Math.round((p.min / max) * (width - 320))); // deja sitio al nombre y a los minutos
        return (
          <div key={p.name} style={{ display: 'flex', alignItems: 'center', height: rowH }}>
            <div style={{ display: 'flex', width: 190, fontSize: 30, fontWeight: 800, color: INK, overflow: 'hidden' }}>{p.name}</div>
            <div style={{ display: 'flex', flex: 1, justifyContent: 'flex-end', alignItems: 'center' }}>
              <div style={{ display: 'flex', flexShrink: 0, whiteSpace: 'nowrap', fontSize: 26, fontWeight: 800, color: INK, marginRight: 14 }}>{p.min} min</div>
              <div style={{ display: 'flex', width: 22, height: 22, borderRadius: 11, border: `6px solid ${p.color}`, background: '#fff' }} />
              <div style={{ display: 'flex', width: len, height: 10, background: p.color, borderRadius: 5, marginLeft: -4 }} />
            </div>
          </div>
        );
      })}
      <div style={{ position: 'absolute', right: -16, top: 6, bottom: 6, width: 26, borderRadius: 13, background: SIGNAL, border: `5px solid ${INK}`, display: 'flex' }} />
    </div>
  );
}

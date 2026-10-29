// Cómo llega cada uno: su ruta en Google Maps, en su transporte. Desde la app, desde donde sale cada uno;
// en el enlace compartido (que no lleva direcciones), desde donde esté quien lo abre.
import type { CSSProperties } from 'react';
import { COLORS, ExternalIcon, MODE_LABEL, ModeIcon } from './brand';
import { initialOf } from '@/lib/client';
import { mapsDirections } from '@/lib/routes';
import type { LatLng, Mode } from '@/lib/types';

type Who = { name: string; mode: Mode; min: number; est?: boolean; from?: LatLng | null };
type Props = { people: Who[]; to: LatLng; placeId?: string | null; fromHere?: boolean };

export default function Directions({ people, to, placeId, fromHere = false }: Props) {
  return (
    <section className="ways" aria-labelledby="h-ways">
      <h2 id="h-ways">Cómo llega cada uno</h2>
      <ul>
        {people.map((p, i) => (
          <li key={i} style={{ '--c': COLORS[i] } as CSSProperties}>
            <a className="way" href={mapsDirections(to, p.mode, placeId, fromHere ? null : p.from)} target="_blank" rel="noopener noreferrer">
              <span className="stop">{initialOf(p, i)}</span>
              <span className="way-main">
                <span className="way-name">{p.name}</span>
                <span className="way-how"><ModeIcon mode={p.mode} />{p.est ? '≈' : ''}{p.min} min · {MODE_LABEL[p.mode]}</span>
              </span>
              <span className="way-go">Ver ruta<ExternalIcon /></span>
            </a>
          </li>
        ))}
      </ul>
      <p className="note">
        {fromHere ? 'Toca tu nombre: Google Maps te lleva desde donde estés, en tu transporte.' : 'Se abre en Google Maps, desde donde sale cada uno y en su transporte.'}
      </p>
    </section>
  );
}

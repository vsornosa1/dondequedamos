'use client';
// Ficha de un sitio dentro de la app: fotos, qué es, precio, horario y qué tiene.
import { useEffect, useState } from 'react';
import Sheet from './Sheet';
import { photoSrc, priceText, ratingText } from '@/lib/client';
import type { Option, Venue } from '@/lib/types';

type Props = { option: Option; isSelected: boolean; onChoose: () => void; onClose: () => void };

const cache = new Map<string, Venue>();

export default function VenueSheet({ option, isSelected, onChoose, onClose }: Props) {
  const [venue, setVenue] = useState<Venue | null>(cache.get(option.id) ?? null);
  const [failed, setFailed] = useState<false | 'quota' | 'error'>(false);
  const [broken, setBroken] = useState<string[]>([]);

  useEffect(() => {
    if (cache.has(option.id)) return;
    let live = true;
    fetch(`/api/venue?id=${encodeURIComponent(option.id)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(String(r.status)))))
      .then((v: Venue) => { cache.set(option.id, v); if (live) setVenue(v); })
      .catch((e: Error) => live && setFailed(e.message === '429' || e.message === '503' ? 'quota' : 'error'));
    return () => { live = false; };
  }, [option.id]);

  const photos = (venue?.photos.length ? venue.photos : option.photo ? [option.photo] : []).filter((p) => !broken.includes(p.name));
  // Google empieza la semana en lunes; getDay() en domingo.
  const today = venue?.hours[(new Date().getDay() + 6) % 7]?.replace(/^[^:]+:\s*/, '');
  const price = venue?.range || priceText(option.price || venue?.price || null);
  // Con Nearby en nivel Pro la búsqueda no trae valoración ni horario: la ficha sí, y se aprovechan.
  const rating = option.rating ?? venue?.rating ?? null;
  const ratings = option.rating != null ? option.ratings : venue?.ratings ?? 0;
  const openNow = option.openNow ?? venue?.openNow ?? null;

  return (
    <Sheet label={option.name} onClose={onClose}>
      {(close) => (
        <div className="sheet-body venue">
          {photos.length > 0 && (
            <div className="v-photos">
              {photos.map((p, i) => (
                <figure key={p.name}>
                  <img
                    src={photoSrc(p.name, 900)} alt={i === 0 ? `Foto de ${option.name}` : ''} loading={i === 0 ? 'eager' : 'lazy'} decoding="async"
                    onError={() => setBroken((b) => [...b, p.name])}
                  />
                  {p.by && <figcaption>Foto: {p.by}</figcaption>}
                </figure>
              ))}
            </div>
          )}
          <h2 className="v-name">{option.name}</h2>
          <p className="v-type">{[venue?.type || option.type, price].filter(Boolean).join('. ')}</p>
          {rating != null && (
            <p className="v-rating"><b>{ratingText(rating)} ★</b> con {ratings} opiniones en Google</p>
          )}
          {(openNow != null || today) && (
            <p className={openNow === false ? 'v-open closed' : 'v-open'}>
              {openNow === true ? 'Abierto ahora.' : openNow === false ? 'Cerrado ahora.' : ''}
              {today && ` Hoy: ${today}`}
            </p>
          )}
          {!venue && !failed && <p className="v-loading"><span className="spin" aria-hidden="true" />Cargando la ficha…</p>}
          {failed === 'error' && <p className="v-loading">No hemos podido cargar más información de este sitio.</p>}
          {failed === 'quota' && <p className="v-loading">Por hoy se han acabado las fichas gratis. Tienes toda la información en Google Maps.</p>}
          {venue?.summary && <p className="v-summary">{venue.summary}</p>}
          {venue && venue.features.length > 0 && (
            <ul className="v-features">{venue.features.map((f) => <li key={f}>{f}</li>)}</ul>
          )}
          <div className="v-actions">
            {!isSelected && (
              <button type="button" className="btn primary" onClick={() => { onChoose(); close(); }}>Elegir este sitio</button>
            )}
            {venue?.web && <a className="btn" href={venue.web} target="_blank" rel="noopener noreferrer">Web del sitio</a>}
            {option.url && <a className="btn" href={option.url} target="_blank" rel="noopener noreferrer">Ver en Google Maps</a>}
          </div>
          <p className="v-source">Información y fotos de Google Maps.</p>
        </div>
      )}
    </Sheet>
  );
}

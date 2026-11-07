'use client';
// Elegir el destino cuando ya lo tenéis: el sitio al que vais todos después de quedar.
import Sheet from './Sheet';
import PlaceSearch from './PlaceSearch';
import { FlagIcon } from './brand';
import type { LatLng, Trip } from '@/lib/types';

type Props = { trip: Trip; bias: LatLng | null; onChange: (t: Trip) => void; onClose: () => void };

export default function TripSheet({ trip, bias, onChange, onClose }: Props) {
  return (
    <Sheet label="Adónde vais" full onClose={onClose}>
      {(close) => (
        <div className="sheet-body ps trip-sheet">
          <div className="ps-head">
            <span className="stop big dest" aria-hidden="true"><FlagIcon /></span>
            <p className="ps-title">Adónde vais</p>
            <button type="button" className="ps-done" onClick={close}>Listo</button>
          </div>
          <label className="ps-label" htmlFor="trip-q">El sitio al que vais todos juntos</label>
          <PlaceSearch
            id="trip-q" autoFocus bias={bias}
            placeholder={trip.loc ? trip.label : 'Pueblo, dirección o sitio'}
            onPick={(loc, label) => { onChange({ ...trip, loc, label }); close(); }}
          />
          <p className="ps-hint trip-hint">Buscamos dónde quedar antes, de camino, para ir juntos desde allí.</p>
        </div>
      )}
    </Sheet>
  );
}

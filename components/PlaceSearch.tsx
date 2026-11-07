'use client';
// El buscador de direcciones de las hojas: lo que se escribe, las sugerencias de Google, «Usar mi
// ubicación» y lo usado hace poco en este móvil. Sirve para desde dónde sale cada uno y para el destino.
import { useEffect, useMemo, useState } from 'react';
import { LocateIcon, SearchIcon, PinIcon, ClockIcon } from './brand';
import { api, isQuota, load, save, uid } from '@/lib/client';
import type { LatLng } from '@/lib/types';

type Item = { id: string; main: string; secondary: string };
type Recent = { label: string; loc: LatLng };

type Props = {
  id: string; // el del campo, para la etiqueta que lo nombra
  placeholder: string;
  bias: LatLng | null;
  autoFocus?: boolean;
  // El texto de «Usar mi ubicación»; sin él, no se ofrece.
  locate?: { title: string; small: string } | null;
  onPick: (loc: LatLng, label: string) => void;
};

export default function PlaceSearch({ id, placeholder, bias, autoFocus, locate, onPick }: Props) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  // El buscador no responde: 'cap', se ha acabado el gratis de hoy; 'off', Google Maps no está disponible;
  // 'error', ha fallado (nunca se disfraza de «Sin resultados»).
  const [noSearch, setNoSearch] = useState<false | 'cap' | 'off' | 'error'>(false);
  const [answered, setAnswered] = useState(''); // la última búsqueda que ya ha contestado
  const session = useMemo(() => uid(), []);
  const [recents, setRecents] = useState<Recent[]>([]);

  useEffect(() => setRecents(load<Recent[]>('dq:recientes', [])), []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) { setItems([]); return; }
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const d = await api<{ items: Item[] }>('/api/autocomplete', { input: query, session, bias });
        if (live) { setItems(d.items); setNoSearch(false); setAnswered(query); }
      } catch (e) {
        if (live) { setItems([]); setNoSearch(isQuota(e) ? (e.reason === 'cap' ? 'cap' : 'off') : 'error'); setAnswered(query); }
      } finally {
        if (live) setBusy(false);
      }
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [q, session, bias]);

  const finish = (loc: LatLng, label: string, remember = true) => {
    if (remember) save('dq:recientes', [{ label, loc }, ...recents.filter((r) => r.label !== label)].slice(0, 6));
    navigator.vibrate?.(10);
    onPick(loc, label);
  };

  const pick = async (it: Item) => {
    setBusy(true);
    setError('');
    try {
      const p = await api<LatLng>('/api/place', { id: it.id, session });
      finish({ lat: p.lat, lng: p.lng }, it.main);
    } catch (e) {
      setError((e as Error).message);
      setBusy(false);
    }
  };

  const useLocation = () => {
    if (!navigator.geolocation) return setError('Este navegador no deja usar la ubicación. Escribe la dirección.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => finish({ lat: p.coords.latitude, lng: p.coords.longitude }, 'Mi ubicación', false),
      () => { setBusy(false); setError('No hemos podido usar tu ubicación. Escribe la dirección.'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const typing = q.trim().length >= 3;
  const list = `${id}-list`;

  return (
    <>
      <div className="ps-search">
        <SearchIcon />
        <input
          id={id} data-autofocus={autoFocus || undefined} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={placeholder} autoComplete="off" enterKeyHint="search"
          role="combobox" aria-expanded={items.length > 0} aria-controls={list} aria-autocomplete="list"
        />
        {busy && <span className="spin" aria-hidden="true" />}
      </div>
      {error && <p className="ps-error" role="alert">{error}</p>}

      <ul className="ps-results" id={list} role="listbox" aria-label="Sitios">
        {locate && (!typing || noSearch) && (
          <li role="option" aria-selected="false">
            <button type="button" onClick={useLocation}>
              <span className="ps-ico accent"><LocateIcon /></span>
              <span>{locate.title}<small>{locate.small}</small></span>
            </button>
          </li>
        )}
        {!typing && recents.map((r) => (
          <li key={r.label} role="option" aria-selected="false">
            <button type="button" onClick={() => finish(r.loc, r.label)}>
              <span className="ps-ico"><ClockIcon /></span>
              <span>{r.label}<small>Usado hace poco en este móvil</small></span>
            </button>
          </li>
        ))}
        {typing && items.map((it) => (
          <li key={it.id} role="option" aria-selected="false">
            <button type="button" onClick={() => pick(it)}>
              <span className="ps-ico"><PinIcon /></span>
              <span>{it.main}<small>{it.secondary}</small></span>
            </button>
          </li>
        ))}
        {typing && !busy && !items.length && answered === q.trim() && (
          <li className="ps-empty">
            {noSearch === 'cap'
              ? `Por hoy se ha acabado el buscador de direcciones gratis. Usa ${locate ? 'tu ubicación o ' : ''}una dirección reciente.`
              : noSearch === 'off'
                ? `Ahora mismo no funciona el buscador de direcciones. Usa ${locate ? 'tu ubicación o ' : ''}una dirección reciente.`
                : noSearch === 'error'
                  ? `No hemos podido buscar la dirección. Prueba otra vez${locate ? ' o usa tu ubicación' : ''}.`
                  : 'Sin resultados. Prueba con la calle y el número, el barrio, el pueblo o una estación.'}
          </li>
        )}
      </ul>
    </>
  );
}

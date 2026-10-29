'use client';
// Editar a una persona: nombre, cómo viene y desde dónde. Pensado para el pulgar y el teclado del móvil.
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import Sheet from './Sheet';
import { MODE_LABEL, ModeIcon, LocateIcon, SearchIcon, PinIcon, ClockIcon } from './brand';
import { api, initialOf, load, save, uid } from '@/lib/client';
import type { LatLng, Mode, Person } from '@/lib/types';

// De lo más sencillo a lo menos: así se leen los que puede usar cada uno.
const CAN: Mode[] = ['WALK', 'TRANSIT', 'BICYCLE', 'DRIVE'];

type Item = { id: string; main: string; secondary: string };
type Recent = { label: string; loc: LatLng };

type Props = {
  person: Person;
  index: number;
  color: string;
  canRemove: boolean;
  bias: LatLng | null;
  onChange: (p: Person) => void;
  onRemove: () => void;
  onClose: () => void;
};

export default function PersonSheet(props: Props) {
  const { person, index } = props;
  const who = person.name.trim() || (index === 0 ? 'ti' : `Persona ${index + 1}`);
  // Al quitar a alguien, la hoja se cierra animada y luego desaparece de la lista.
  const removing = useRef(false);
  const onClose = () => {
    if (removing.current) props.onRemove();
    props.onClose();
  };
  return (
    <Sheet label={`Datos de ${who}`} full onClose={onClose}>
      {(close) => <Body {...props} onRemove={() => { removing.current = true; }} close={close} />}
    </Sheet>
  );
}

function Body({ person, index, color, canRemove, bias, onChange, onRemove, close }: Props & { close: () => void }) {
  const [q, setQ] = useState('');
  const [items, setItems] = useState<Item[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const session = useMemo(() => uid(), []);
  const [recents, setRecents] = useState<Recent[]>([]);
  const isYou = index === 0;

  useEffect(() => setRecents(load<Recent[]>('dq:recientes', [])), []);

  useEffect(() => {
    const query = q.trim();
    if (query.length < 3) { setItems([]); return; }
    let live = true;
    const t = setTimeout(async () => {
      setBusy(true);
      try {
        const d = await api<{ items: Item[] }>('/api/autocomplete', { input: query, session, bias });
        if (live) setItems(d.items);
      } catch {
        if (live) setItems([]);
      } finally {
        if (live) setBusy(false);
      }
    }, 220);
    return () => { live = false; clearTimeout(t); };
  }, [q, session, bias]);

  const finish = (loc: LatLng, label: string, remember = true) => {
    onChange({ ...person, loc, label });
    if (remember) save('dq:recientes', [{ label, loc }, ...recents.filter((r) => r.label !== label)].slice(0, 6));
    navigator.vibrate?.(10);
    close();
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

  const locate = () => {
    if (!navigator.geolocation) return setError('Este navegador no deja usar la ubicación. Escribe desde dónde sales.');
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (p) => finish({ lat: p.coords.latitude, lng: p.coords.longitude }, 'Mi ubicación', false),
      () => { setBusy(false); setError('No hemos podido usar tu ubicación. Escribe desde dónde sales.'); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  const typing = q.trim().length >= 3;

  return (
    <div className="sheet-body ps" style={{ '--c': color } as CSSProperties}>
      <div className="ps-head">
        <span className="stop big" aria-hidden="true">{initialOf(person, index)}</span>
        <input
          className="ps-name" value={person.name} maxLength={20} aria-label="Nombre"
          placeholder={isYou ? 'Tú' : `Persona ${index + 1}`}
          onChange={(e) => onChange({ ...person, name: e.target.value })}
        />
        <button type="button" className="ps-done" onClick={close}>Listo</button>
      </div>

      <p className="ps-label" id="ps-mode">{isYou ? 'Puedes ir' : 'Puede ir'}</p>
      <div className="ps-modes" role="group" aria-labelledby="ps-mode">
        {CAN.map((m) => {
          const on = person.modes.includes(m);
          // Siempre queda al menos uno marcado.
          const toggle = () => {
            const modes = CAN.filter((x) => (x === m ? !on : person.modes.includes(x)));
            if (modes.length) onChange({ ...person, modes });
          };
          return (
            <button key={m} type="button" role="checkbox" aria-checked={on} onClick={toggle}>
              <ModeIcon mode={m} />
              <span>{MODE_LABEL[m]}</span>
            </button>
          );
        })}
      </div>
      <p className="ps-hint">Marca todo lo que {isYou ? 'puedes' : 'puede'} usar: para cada sitio elegimos lo más rápido.</p>

      <label className="ps-label" htmlFor="ps-q">{isYou ? 'Sales de' : 'Sale de'}</label>
      <div className="ps-search">
        <SearchIcon />
        <input
          id="ps-q" data-autofocus={person.loc ? undefined : true} value={q} onChange={(e) => setQ(e.target.value)}
          placeholder={person.loc ? person.label : 'Calle, barrio o estación'} autoComplete="off" enterKeyHint="search"
          role="combobox" aria-expanded={items.length > 0} aria-controls="ps-list" aria-autocomplete="list"
        />
        {busy && <span className="spin" aria-hidden="true" />}
      </div>
      {error && <p className="ps-error" role="alert">{error}</p>}

      <ul className="ps-results" id="ps-list" role="listbox" aria-label="Sitios">
        {!typing && (
          <li role="option" aria-selected="false">
            <button type="button" onClick={locate}>
              <span className="ps-ico accent"><LocateIcon /></span>
              <span>{isYou ? 'Usar mi ubicación' : 'Usar mi ubicación actual'}<small>Si sale de donde estás ahora</small></span>
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
        {typing && !busy && !items.length && <li className="ps-empty">Sin resultados. Prueba con el barrio o una estación de metro.</li>}
      </ul>

      {canRemove && (
        <button type="button" className="ps-remove" onClick={() => { onRemove(); close(); }}>
          Quitar a {person.name.trim() || `Persona ${index + 1}`}
        </button>
      )}
    </div>
  );
}

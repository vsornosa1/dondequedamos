'use client';
// Editar a una persona: nombre, cómo viene y desde dónde. Pensado para el pulgar y el teclado del móvil.
import { useRef, type CSSProperties } from 'react';
import Sheet from './Sheet';
import PlaceSearch from './PlaceSearch';
import { MODE_LABEL, ModeIcon } from './brand';
import { initialOf } from '@/lib/client';
import type { LatLng, Mode, Person } from '@/lib/types';

// De lo más sencillo a lo menos: así se leen los que puede usar cada uno.
const CAN: Mode[] = ['WALK', 'TRANSIT', 'BICYCLE', 'DRIVE'];

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
  const isYou = index === 0;

  const finish = (loc: LatLng, label: string) => {
    onChange({ ...person, loc, label });
    close();
  };

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
      <PlaceSearch
        id="ps-q" autoFocus={!person.loc} bias={bias} onPick={finish}
        placeholder={person.loc ? person.label : 'Calle, barrio o estación'}
        locate={{ title: isYou ? 'Usar mi ubicación' : 'Usar mi ubicación actual', small: 'Si sale de donde estás ahora' }}
      />

      {canRemove && (
        <button type="button" className="ps-remove" onClick={() => { onRemove(); close(); }}>
          Quitar a {person.name.trim() || `Persona ${index + 1}`}
        </button>
      )}
    </div>
  );
}

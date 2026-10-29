// Marca y pictogramas. Cada persona es una línea de color; el amarillo solo marca el punto de encuentro.
import type { ReactNode } from 'react';
import type { Mode, Plan } from '@/lib/types';

export const SPONSORS_URL = 'https://github.com/sponsors/vsornosa1';

// Cada búsqueda se paga a Google Maps: el pie invita a apoyar el proyecto.
export function SponsorLink() {
  return (
    <div className="sponsor">
      <a className="sponsor-link" href={SPONSORS_URL} target="_blank" rel="noopener noreferrer">
        <HeartIcon />Apoya el proyecto
      </a>
      <p>Mantiene la app gratis y sin anuncios ;)</p>
    </div>
  );
}

export const COLORS = ['#E5352B', '#1F6FD1', '#12A150', '#8B4FD3', '#F07D19', '#0FA3B1', '#E0569B', '#7A5A3A'];

export const MODES: Mode[] = ['TRANSIT', 'DRIVE', 'BICYCLE', 'WALK'];
export const MODE_LABEL: Record<Mode, string> = { TRANSIT: 'Bus/metro', DRIVE: 'Coche', BICYCLE: 'Bici', WALK: 'Andando' };
export const MODE_TXT: Record<Mode, string> = { TRANSIT: 'en transporte público', DRIVE: 'en coche', BICYCLE: 'en bici', WALK: 'andando' };

export const PLANS: { id: Plan; label: string; txt: string }[] = [
  { id: 'canas', label: 'Cañas', txt: 'unas cañas' },
  { id: 'cafe', label: 'Café', txt: 'un café' },
  { id: 'cenar', label: 'Cenar', txt: 'cenar' },
  { id: 'parque', label: 'Parque', txt: 'un parque' },
];
// Copas ya no se ofrece, pero los enlaces que ya se mandaron con ese plan siguen diciéndolo bien.
export const planTxt = (p: Plan) => (p === 'copas' ? 'unas copas' : PLANS.find((x) => x.id === p)?.txt || 'veros');

// Trazos de 24×24, compartidos por los iconos de React y los marcadores del mapa (que son HTML).
export const PLAN_PATHS: Record<Plan, string[]> = {
  canas: ['M7 8.5h10l-1.3 11.6a1.2 1.2 0 0 1-1.2 1H9.5a1.2 1.2 0 0 1-1.2-1z', 'M6.6 8.6c-.5-1.9 1.3-3.5 3.1-2.7.9-1.5 3.3-1.6 4.3 0 1.7-.7 3.4.8 2.8 2.7'],
  cafe: ['M4.5 10h11v3.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z', 'M15.5 11H17a2.5 2.5 0 0 1 0 5h-1.8', 'M8.5 3.5c-.9.9.9 1.8 0 3M12 3.5c-.9.9.9 1.8 0 3M3.5 21h14'],
  cenar: ['M5 3v5a3 3 0 0 0 6 0V3M8 3v18', 'M18 21V3c-2.2 1.5-3 4.5-3 8h3'],
  copas: ['M5 4h14l-7 8.5z', 'M12 12.5V20M8 20.5h8'],
  parque: ['M12 21v-5', 'M12 3.5a4.5 4.5 0 0 0-4.3 5.9A4 4 0 0 0 9 17h6a4 4 0 0 0 1.3-7.6A4.5 4.5 0 0 0 12 3.5z'],
};

export const MODE_SHAPES: Record<Mode, ReactNode> = {
  TRANSIT: (<><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M9 21l-2-3M15 21l2-3" /><circle cx="9" cy="14" r=".6" fill="currentColor" /><circle cx="15" cy="14" r=".6" fill="currentColor" /></>),
  DRIVE: (<><path d="M4 16v-4l2-5h12l2 5v4z" /><path d="M4 12h16" /><circle cx="8" cy="16" r="1.8" /><circle cx="16" cy="16" r="1.8" /></>),
  BICYCLE: (<><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7M10 9l2 7h-6M14 6h2" /></>),
  WALK: (<><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6-2-3 1-4 3 3 3 1M12 15l3 6M11 8l-3 2-1 3" /></>),
};

type IconProps = { className?: string };

export function ModeIcon({ mode, className = 'ico' }: IconProps & { mode: Mode }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{MODE_SHAPES[mode]}</svg>;
}

export function PlanIcon({ plan, className = 'ico' }: IconProps & { plan: Plan }) {
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{PLAN_PATHS[plan].map((d) => <path key={d} d={d} />)}</svg>;
}

// El marcador amarillo del mapa: el plan dentro de una chincheta, la punta en el sitio.
export const meetPinHtml = (plan: Plan) =>
  `<svg viewBox="0 0 44 54" aria-hidden="true"><path d="M22 2.5C11.2 2.5 3.5 10.4 3.5 20.8c0 13.6 18.5 30.7 18.5 30.7s18.5-17.1 18.5-30.7C40.5 10.4 32.8 2.5 22 2.5z" fill="#FFD100" stroke="#0E1A2B" stroke-width="3"/><g transform="translate(10 8)" fill="none" stroke="#0E1A2B" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${PLAN_PATHS[plan].map((d) => `<path d="${d}"/>`).join('')}</g></svg>`;

export function Mark({ className = 'mark' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 48 48" aria-hidden="true">
      <rect width="48" height="48" rx="12" fill="#FFD100" />
      <g fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round">
        <path className="mk-line" d="M9 14h8l9 10" stroke="#E5352B" />
        <path className="mk-line" d="M9 24h17" stroke="#1F6FD1" />
        <path className="mk-line" d="M9 34h8l9-10" stroke="#12A150" />
      </g>
      <circle className="mk-dot" cx="32" cy="24" r="6" fill="#0E1A2B" />
    </svg>
  );
}

// Pictograma de punto de encuentro (líneas que se juntan), en el color del texto.
export function MeetIcon({ className = 'ico' }: IconProps) {
  return (
    <svg className={className} viewBox="0 0 32 32" aria-hidden="true">
      <path d="M3 8h7l9 8M3 16h16M3 24h7l9-8" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx="24" cy="16" r="5" fill="currentColor" />
    </svg>
  );
}

const icon = (children: ReactNode) =>
  function Icon({ className = 'ico' }: IconProps) {
    return <svg className={className} viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
  };

export const LocateIcon = icon(<><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7.5" /></>);
export const SearchIcon = icon(<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>);
export const CloseIcon = icon(<path d="M6 6l12 12M18 6L6 18" />);
export const BackIcon = icon(<path d="M15 5l-7 7 7 7" />);
export const ChevronIcon = icon(<path d="M9 5l7 7-7 7" />);
export const ShareIcon = icon(<><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>);
export const HeartIcon = icon(<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />);
export const CopyIcon = icon(<><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>);
export const ClockIcon = icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const PinIcon = icon(<><path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>);
export const ExternalIcon = icon(<><path d="M14 4h6v6M20 4l-9 9" /><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" /></>);

import React from 'react';
import type { ReactNode } from 'react';
import type { Mode } from '../timing';

// Copied as given from the app (components/brand.tsx), so the film draws the same pictograms.
export type Plan = 'canas' | 'cafe' | 'cenar' | 'copas' | 'parque';

export const PLANS: { id: Plan; label: string; txt: string }[] = [
  { id: 'canas', label: 'Cañas', txt: 'unas cañas' },
  { id: 'cafe', label: 'Café', txt: 'un café' },
  { id: 'cenar', label: 'Cenar', txt: 'cenar' },
  { id: 'copas', label: 'Copas', txt: 'unas copas' },
  { id: 'parque', label: 'Parque', txt: 'un parque' },
];
export const planTxt = (p: Plan) => PLANS.find((x) => x.id === p)?.txt || 'veros';

export const PLAN_PATHS: Record<Plan, string[]> = {
  canas: ['M7 8.5h10l-1.3 11.6a1.2 1.2 0 0 1-1.2 1H9.5a1.2 1.2 0 0 1-1.2-1z', 'M6.6 8.6c-.5-1.9 1.3-3.5 3.1-2.7.9-1.5 3.3-1.6 4.3 0 1.7-.7 3.4.8 2.8 2.7'],
  cafe: ['M4.5 10h11v3.5a5 5 0 0 1-5 5h-1a5 5 0 0 1-5-5z', 'M15.5 11H17a2.5 2.5 0 0 1 0 5h-1.8', 'M8.5 3.5c-.9.9.9 1.8 0 3M12 3.5c-.9.9.9 1.8 0 3M3.5 21h14'],
  cenar: ['M5 3v5a3 3 0 0 0 6 0V3M8 3v18', 'M18 21V3c-2.2 1.5-3 4.5-3 8h3'],
  copas: ['M5 4h14l-7 8.5z', 'M12 12.5V20M8 20.5h8'],
  parque: ['M12 21v-5', 'M12 3.5a4.5 4.5 0 0 0-4.3 5.9A4 4 0 0 0 9 17h6a4 4 0 0 0 1.3-7.6A4.5 4.5 0 0 0 12 3.5z'],
};

export const MODE_LABEL: Record<Mode, string> = { TRANSIT: 'Bus/metro', DRIVE: 'Coche', BICYCLE: 'Bici', WALK: 'Andando' };
export const MODE_TXT: Record<Mode, string> = { TRANSIT: 'en transporte público', DRIVE: 'en coche', BICYCLE: 'en bici', WALK: 'andando' };

export const MODE_SHAPES: Record<Mode, ReactNode> = {
  TRANSIT: (<><rect x="5" y="3" width="14" height="14" rx="3" /><path d="M5 11h14M9 21l-2-3M15 21l2-3" /><circle cx="9" cy="14" r=".6" fill="currentColor" /><circle cx="15" cy="14" r=".6" fill="currentColor" /></>),
  DRIVE: (<><path d="M4 16v-4l2-5h12l2 5v4z" /><path d="M4 12h16" /><circle cx="8" cy="16" r="1.8" /><circle cx="16" cy="16" r="1.8" /></>),
  BICYCLE: (<><circle cx="6" cy="16" r="3.5" /><circle cx="18" cy="16" r="3.5" /><path d="M6 16l4-7h5l3 7M10 9l2 7h-6M14 6h2" /></>),
  WALK: (<><circle cx="13" cy="4.5" r="1.8" /><path d="M10 21l2-6-2-3 1-4 3 3 3 1M12 15l3 6M11 8l-3 2-1 3" /></>),
};

type P = { className?: string; style?: React.CSSProperties };

export const ModeIcon = ({ mode, className = 'ico', style }: P & { mode: Mode }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">{MODE_SHAPES[mode]}</svg>
);

export const PlanIcon = ({ plan, className = 'ico', style }: P & { plan: Plan }) => (
  <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">{PLAN_PATHS[plan].map((d) => <path key={d} d={d} />)}</svg>
);

const icon = (children: ReactNode) =>
  function Icon({ className = 'ico', style }: P) {
    return <svg className={className} style={style} viewBox="0 0 24 24" aria-hidden="true">{children}</svg>;
  };

export const LocateIcon = icon(<><circle cx="12" cy="12" r="3.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /><circle cx="12" cy="12" r="7.5" /></>);
export const SearchIcon = icon(<><circle cx="11" cy="11" r="6.5" /><path d="M16 16l5 5" /></>);
export const BackIcon = icon(<path d="M15 5l-7 7 7 7" />);
export const ChevronIcon = icon(<path d="M9 5l7 7-7 7" />);
export const ShareIcon = icon(<><path d="M12 3v12M7 8l5-5 5 5" /><path d="M5 13v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></>);
export const HeartIcon = icon(<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7a4.3 4.3 0 0 1 7.5 2.8C19.5 15.4 12 20 12 20z" />);
export const CopyIcon = icon(<><rect x="8" y="8" width="12" height="12" rx="2.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></>);
export const ClockIcon = icon(<><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></>);
export const PinIcon = icon(<><path d="M12 21s-6.5-5.8-6.5-11a6.5 6.5 0 0 1 13 0c0 5.2-6.5 11-6.5 11z" /><circle cx="12" cy="10" r="2.3" /></>);

// The meeting pin of the map, as in brand.tsx meetPinHtml: the plan inside a yellow pin.
export const MeetPin = ({ size = 44, plan = 'canas' as Plan }: { size?: number; plan?: Plan }) => (
  <svg width={size} height={(size * 54) / 44} viewBox="0 0 44 54" aria-hidden="true" style={{ display: 'block', overflow: 'visible' }}>
    <path d="M22 2.5C11.2 2.5 3.5 10.4 3.5 20.8c0 13.6 18.5 30.7 18.5 30.7s18.5-17.1 18.5-30.7C40.5 10.4 32.8 2.5 22 2.5z" fill="#FFD100" stroke="#0E1A2B" strokeWidth="3" />
    <g transform="translate(10 8)" fill="none" stroke="#0E1A2B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      {PLAN_PATHS[plan].map((d) => <path key={d} d={d} />)}
    </g>
  </svg>
);

export type Mode = 'TRANSIT' | 'DRIVE' | 'BICYCLE' | 'WALK';
export type Plan = 'canas' | 'cafe' | 'cenar' | 'copas' | 'parque';
export type Sort = 'justo' | 'rapido';
export type LatLng = { lat: number; lng: number };

// modes: los transportes que puede usar; la búsqueda elige, para cada sitio, el más rápido de ellos.
export type Person = { id: string; name: string; modes: Mode[]; loc: LatLng | null; label: string };
// day: días desde hoy; minutes: desde las 00:00 de ese día (≥ 1440 = de madrugada).
export type When = { kind: 'now' } | { kind: 'later'; day: number; minutes: number };

export type Time = { min: number; est: boolean; mode: Mode }; // mode: el transporte con el que llega antes
export type Stats = { max: number; min: number; avg: number; gap: number; score: number };
export type Photo = { name: string; by: string };

export type Option = {
  id: string; name: string; address: string; type: string;
  rating: number | null; ratings: number; price: string | null; openNow: boolean | null;
  url: string; loc: LatLng; photo: Photo | null;
  times: Time[]; justo: Stats; rapido: Stats;
};

export type Result = {
  departureTime: string;
  zone: LatLng & { radius: number };
  midpoint: { loc: LatLng; times: Time[]; stats: Stats };
  options: Option[];
};

export type Venue = {
  id: string; name: string; type: string; address: string;
  rating: number | null; ratings: number; price: string | null; range: string;
  openNow: boolean | null; hours: string[]; summary: string; web: string; maps: string;
  features: string[]; photos: Photo[];
};

export type Proposal = {
  name: string; address: string; type: string; placeId: string | null; loc: LatLng | null;
  plan: Plan; when: string | null; people: { name: string; mode: Mode; min: number }[];
  routes: ([number, number][] | null)[]; // la de cada uno, sin sus primeros metros ([lng, lat])
};

export type Line = { name: string; mode: Mode; min: number; est?: boolean; ghost?: number | null; color: string };

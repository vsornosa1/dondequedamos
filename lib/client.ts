// Utilidades del navegador: llamadas a la API, guardado local y formato.
import type { Person, When } from './types';

export async function api<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Algo ha fallado. Prueba otra vez.');
  return data as T;
}

// randomUUID solo existe en https o localhost: al probar desde el móvil por la IP local hace falta el plan B.
export const uid = () => (typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : String(Math.random()).slice(2));
export const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const photoSrc = (name: string, w = 800) => `/api/photo?n=${encodeURIComponent(name)}&w=${w}`;

// Lo guardado en este móvil puede faltar o estar bloqueado: nunca debe romper la página.
export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(key);
    return v ? (JSON.parse(v) as T) : fallback;
  } catch {
    return fallback;
  }
}
export function save(key: string, value: unknown) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* sin almacenamiento, sin recuerdos */ }
}

export const nameOf = (p: Pick<Person, 'name'>, i: number) => p.name.trim() || (i === 0 ? 'Tú' : `Persona ${i + 1}`);
export const initialOf = (p: Pick<Person, 'name'>, i: number) => (p.name.trim() ? p.name.trim()[0].toUpperCase() : i === 0 ? 'T' : String(i + 1));
export const listNames = (names: string[]) => (names.length > 1 ? `${names.slice(0, -1).join(', ')} y ${names.at(-1)}` : names[0] || '');

const PRICE: Record<string, string> = { PRICE_LEVEL_INEXPENSIVE: '€', PRICE_LEVEL_MODERATE: '€€', PRICE_LEVEL_EXPENSIVE: '€€€', PRICE_LEVEL_VERY_EXPENSIVE: '€€€€' };
export const priceText = (level: string | null) => (level ? PRICE[level] || '' : '');
export const ratingText = (r: number) => r.toFixed(1).replace('.', ',');

/* ---------- Cuándo ---------- */
export const hhmm = (m: number) => `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;

export function whenDate(w: When) {
  if (w.kind === 'now') return null;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + w.day);
  d.setMinutes(w.minutes);
  return d;
}

const weekday = (d: Date, style: 'long' | 'short') => new Intl.DateTimeFormat('es-ES', { weekday: style }).format(d);

// Para las fichas de día: «Hoy 29», «Mañana 30», «vie 31».
export function dayParts(offset: number) {
  const d = new Date();
  d.setDate(d.getDate() + offset);
  const name = offset === 0 ? 'Hoy' : offset === 1 ? 'Mañana' : weekday(d, 'short').replace('.', '');
  return { name, num: d.getDate() };
}

// «hoy a las 21:00», «el sábado 1 a las 21:00». De madrugada se habla de la noche de antes:
// a la 01:00 tras el sábado es «la noche del sábado», no «el domingo».
export function whenText(w: When) {
  const d = whenDate(w);
  if (!d || w.kind === 'now') return 'ahora';
  const at = `${d.getHours() === 1 ? 'a la' : 'a las'} ${hhmm(w.minutes)}`;
  if (w.minutes >= 24 * 60) {
    if (w.day === 0) return `esta noche ${at}`;
    if (w.day === 1) return `mañana por la noche ${at}`;
    const eve = new Date(d);
    eve.setDate(eve.getDate() - 1);
    return `la noche del ${weekday(eve, 'long')} ${eve.getDate()} ${at}`;
  }
  if (w.day === 0) return `hoy ${at}`;
  if (w.day === 1) return `mañana ${at}`;
  return `el ${weekday(d, 'long')} ${d.getDate()} ${at}`;
}

// La primera hora razonable: dentro de un rato largo, en punto o y media.
export function defaultLater(): When {
  const now = new Date();
  const m = Math.ceil((now.getHours() * 60 + now.getMinutes() + 90) / 30) * 30;
  return m <= 26 * 60 ? { kind: 'later', day: 0, minutes: Math.max(m, 8 * 60) } : { kind: 'later', day: 1, minutes: 20 * 60 };
}

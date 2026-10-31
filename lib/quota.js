// Guardián del tramo gratuito de Google Maps: cada SKU tiene unos usos gratis al mes y aquí se cuentan
// antes de llamar. Si una llamada no cabe, no se hace (QuotaError) y la app sigue con lo que tenga:
// tiempos estimados, sin foto, sin ruta dibujada… Así Google nunca llega a cobrar.
//
// El cupo se reparte por días: cada día se puede gastar lo que queda del mes entre los días que faltan,
// así un pico no se come el mes entero y lo que no se usa un día pasa al siguiente.
// Google cuenta los meses en hora del Pacífico, y aquí también.

// Usos gratis al mes por SKU (tramo gratuito de Google Maps Platform desde marzo de 2025:
// Essentials 10.000, Pro 5.000, Enterprise 1.000). Se pueden cambiar con GOOGLE_FREE_CAPS (JSON).
export const FREE_CAPS = {
  autocomplete: 10000, // Autocomplete Requests (Essentials)
  autocompleteSessions: 10000, // Autocomplete Session Usage
  placeEssentials: 10000, // Place Details Essentials (ubicación y dirección al elegir una sugerencia)
  nearbyPro: 5000, // Nearby Search Pro
  nearbyEnterprise: 1000, // Nearby Search Enterprise (con valoraciones y horario)
  detailsEnterpriseAtmosphere: 1000, // Place Details Enterprise + Atmosphere (la ficha del sitio)
  photos: 1000, // Place Details Photos
  routesEssentials: 10000, // Compute Routes Essentials (la ruta dibujada)
  routesPro: 5000, // Compute Routes Pro (en coche con tráfico)
  matrixEssentials: 10000, // Compute Route Matrix Essentials (por elemento: origen × destino)
  matrixPro: 5000, // Compute Route Matrix Pro (por elemento)
};

// Margen por si Google cuenta algo que aquí no (reintentos, otra app con la misma clave…).
export const DEFAULT_SAFETY = 0.8;

export class QuotaError extends Error {
  constructor(sku, resetAt, reason = 'cap') {
    super(reason === 'cap' ? `Cupo gratuito agotado: ${sku}` : `No se puede comprobar el cupo gratuito: ${sku}`);
    this.name = 'QuotaError';
    this.status = 429;
    this.code = 'quota';
    this.reason = reason; // 'cap': agotado; 'store': no se puede contar (y sin contar no se gasta)
    this.sku = sku;
    this.resetAt = resetAt;
  }
}

/* ---------- El reloj de Google: hora del Pacífico ---------- */

const PT = 'America/Los_Angeles';
const dayFmt = new Intl.DateTimeFormat('en-CA', { timeZone: PT, year: 'numeric', month: '2-digit', day: '2-digit' });
const offsetFmt = new Intl.DateTimeFormat('en-US', { timeZone: PT, timeZoneName: 'shortOffset' });

export function pacificDay(ms) {
  const [y, m, d] = dayFmt.format(new Date(ms)).split('-').map(Number);
  return { y, m, d, daysInMonth: new Date(Date.UTC(y, m, 0)).getUTCDate() };
}

// Minutos que la hora del Pacífico va por detrás de UTC en ese instante (480 en invierno, 420 en verano).
const pacificOffset = (ms) => {
  const tz = offsetFmt.formatToParts(new Date(ms)).find((p) => p.type === 'timeZoneName')?.value || 'GMT-8';
  const [, sign, h, min] = tz.match(/GMT([+-])(\d+)(?::(\d+))?/) || [, '-', '8', '0'];
  return (sign === '-' ? 1 : -1) * (Number(h) * 60 + Number(min || 0));
};

// Cuándo empieza el día siguiente en el Pacífico (las 9:00 en España): ahí se renueva el cupo diario.
export function nextReset(ms) {
  const { y, m, d } = pacificDay(ms);
  const midnightUtc = Date.UTC(y, m - 1, d + 1);
  return midnightUtc + pacificOffset(midnightUtc + 12 * 3600e3) * 60e3;
}

const pad = (n) => String(n).padStart(2, '0');

/* ---------- Dónde se cuenta ---------- */

// En memoria: para desarrollo y pruebas. Cada proceso lleva su cuenta, así que en producción no vale.
export function memoryStore() {
  const data = new Map();
  const live = (k) => {
    const e = data.get(k);
    if (e && e.exp <= Date.now()) data.delete(k);
    return data.get(k);
  };
  return {
    async add(entries, by) {
      return entries.map(([k, ttl]) => {
        const e = live(k) || { v: 0, exp: Date.now() + ttl * 1000 };
        e.v += by;
        data.set(k, e);
        return e.v;
      });
    },
    async get(keys) {
      return keys.map((k) => live(k)?.v || 0);
    },
  };
}

/* ---------- El guardián ---------- */

/**
 * @typedef {{ add: (entries: [string, number][], by: number) => Promise<number[]>, get: (keys: string[]) => Promise<number[]> }} QuotaStore
 * @param {{ store: QuotaStore, caps?: Record<string, number>, safety?: number, now?: () => number, log?: (e: unknown) => void }} opts
 */
export function makeQuota({ store, caps = FREE_CAPS, safety = DEFAULT_SAFETY, now = Date.now, log = console.error }) {
  const limitOf = (sku) => Math.floor((caps[sku] ?? 0) * safety);

  const where = (sku, t) => {
    const { y, m, d, daysInMonth } = pacificDay(t);
    return {
      month: [`fq:${sku}:${y}-${pad(m)}`, 40 * 86400],
      day: [`fq:${sku}:${y}-${pad(m)}-${pad(d)}`, 2 * 86400],
      daysLeft: daysInMonth - d + 1,
    };
  };

  // Lo que se puede gastar hoy sin pasarse del mes: lo que queda entre los días que faltan.
  const fits = (sku, monthUsed, dayUsed, daysLeft) => {
    const limit = limitOf(sku);
    const today = Math.floor((limit - (monthUsed - dayUsed)) / daysLeft);
    return monthUsed <= limit && dayUsed <= today;
  };

  return {
    limitOf,

    // Reserva `units` usos de un SKU o lanza QuotaError. Se suma primero y se comprueba después: así dos
    // llamadas a la vez nunca pasan las dos del límite (la segunda ve la suma de ambas).
    async take(sku, units = 1) {
      const t = now();
      const { month, day, daysLeft } = where(sku, t);
      if (units > limitOf(sku)) throw new QuotaError(sku, nextReset(t));
      let m, d;
      try {
        [m, d] = await store.add([month, day], units);
      } catch (e) {
        log(e);
        throw new QuotaError(sku, nextReset(t), 'store');
      }
      if (!Number.isFinite(m) || !Number.isFinite(d)) throw new QuotaError(sku, nextReset(t), 'store');
      if (!fits(sku, m, d, daysLeft)) {
        await store.add([month, day], -units).catch(log);
        throw new QuotaError(sku, nextReset(t));
      }
    },

    // Si ahora mismo cabrían `units` usos, sin gastar nada.
    async canSpend(sku, units = 1) {
      const t = now();
      const { month, day, daysLeft } = where(sku, t);
      try {
        const [m, d] = await store.get([month[0], day[0]]);
        return fits(sku, m + units, d + units, daysLeft);
      } catch (e) {
        log(e);
        return false;
      }
    },

    // Lo gastado este mes y hoy, y el límite de hoy, de cada SKU (para el registro y las pruebas).
    async usage() {
      const t = now();
      const out = {};
      for (const sku of Object.keys(caps)) {
        const { month, day, daysLeft } = where(sku, t);
        const [m, d] = await store.get([month[0], day[0]]);
        out[sku] = { month: m, today: d, limit: limitOf(sku), todayLimit: Math.floor((limitOf(sku) - (m - d)) / daysLeft) };
      }
      return out;
    },
  };
}

// Los topes de GOOGLE_FREE_CAPS (JSON, p. ej. {"nearbyPro":2000}) mandan sobre los de serie.
export function capsFromEnv(env = process.env) {
  if (!env.GOOGLE_FREE_CAPS) return FREE_CAPS;
  try {
    const extra = JSON.parse(env.GOOGLE_FREE_CAPS);
    const clean = Object.fromEntries(Object.entries(extra).filter(([k, v]) => k in FREE_CAPS && Number.isFinite(v) && v >= 0));
    return { ...FREE_CAPS, ...clean };
  } catch {
    console.error('GOOGLE_FREE_CAPS no es un JSON válido: se usan los topes de serie.');
    return FREE_CAPS;
  }
}

export function safetyFromEnv(env = process.env) {
  const s = Number(env.FREE_TIER_SAFETY);
  return Number.isFinite(s) && s > 0 && s <= 1 ? s : DEFAULT_SAFETY;
}

// Envuelve el cliente de Google: cada método reserva su cupo antes de llamar. `sku` dice qué SKU gasta
// cada llamada (lo da el propio cliente, que es quien sabe qué campos pide).
export function guardGoogle(google, quota) {
  const sku = google.sku;
  return {
    ...google,
    async autocomplete(input, session, bias) {
      await quota.take(sku.autocomplete);
      return google.autocomplete(input, session, bias);
    },
    async place(id, session) {
      await quota.take(sku.place);
      if (session) await quota.take(sku.session);
      return google.place(id, session);
    },
    async details(id) {
      await quota.take(sku.details);
      return google.details(id);
    },
    async photo(name, maxPx) {
      await quota.take(sku.photo);
      return google.photo(name, maxPx);
    },
    async nearby(center, radius, types) {
      await quota.take(sku.nearby);
      return google.nearby(center, radius, types);
    },
    async route(origin, dest, mode, departureTime) {
      await quota.take(sku.route(mode));
      return google.route(origin, dest, mode, departureTime);
    },
    async matrix(origins, destinations, mode, departureTime) {
      await quota.take(sku.matrix(mode), origins.length * destinations.length);
      return google.matrix(origins, destinations, mode, departureTime);
    },
    // Para decidir antes de empezar: una búsqueda sin cupo de Nearby no debe gastar matriz.
    canSpend: (what, units = 1) => quota.canSpend(sku[what], units),
  };
}

// Un cliente que nunca llama a Google: para producción sin dónde contar (sin Redis no hay garantía).
export function closedGoogle(google) {
  const no = async () => { throw new QuotaError('store', nextReset(Date.now()), 'store'); };
  return { ...google, autocomplete: no, place: no, details: no, photo: no, nearby: no, route: no, matrix: no, canSpend: async () => false };
}

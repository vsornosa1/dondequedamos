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

// Lo que cuesta cada uso cuando pasa del tramo gratis, en milésimas de euro (= euros por cada 1.000 usos).
// Son los precios de lista en dólares tomados como euros, así que quedan un 10-15 % por encima de lo que
// Google cobra en euros (la factura de octubre lo confirma: Route Matrix Essentials salió a 4,40 € por 1.000).
// Solo se usan para gastar el crédito de Google (GOOGLE_CREDIT_EUR); sin precio, un SKU nunca usa crédito.
export const PRICE_MILLI_EUR = {
  autocomplete: 2.83,
  placeEssentials: 5,
  nearbyPro: 32,
  nearbyEnterprise: 35,
  detailsEnterpriseAtmosphere: 25,
  photos: 7,
  routesEssentials: 5,
  routesPro: 10,
  matrixEssentials: 5,
  matrixPro: 10,
};

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

// El número de día (en hora del Pacífico) para contar los días que le quedan al crédito.
const dayNumber = (t) => {
  const { y, m, d } = pacificDay(t);
  return Date.UTC(y, m - 1, d) / 86400e3;
};

/**
 * @typedef {{ add: (entries: [string, number][], by: number) => Promise<number[]>, get: (keys: string[]) => Promise<number[]> }} QuotaStore
 * @typedef {{ budget: number, lastDay: number, id: string }} Credit  budget en milésimas de euro; lastDay, número de día
 * @param {{ store: QuotaStore, caps?: Record<string, number>, safety?: number, credit?: Credit | null, prices?: Record<string, number>, now?: () => number, log?: (e: unknown) => void }} opts
 */
export function makeQuota({ store, caps = FREE_CAPS, safety = DEFAULT_SAFETY, credit = null, prices = PRICE_MILLI_EUR, now = Date.now, log = console.error }) {
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

  // El crédito, igual: cada día lo que queda entre los días que le faltan, hasta su último día.
  // Lo que paga el crédito no cuenta en el tramo gratis, así que nunca se descuenta dos veces; y como el tramo
  // gratis se queda en el 80 % del de Google, lo que Google llegue a cobrar es siempre menos que lo apuntado.
  const creditWhere = (t) => {
    const today = dayNumber(t);
    return {
      total: [`fq:credit:${credit.id}`, 400 * 86400],
      day: [`fq:credit:${credit.id}:${today}`, 2 * 86400],
      daysLeft: credit.lastDay - today + 1,
    };
  };
  const costOf = (sku, units) => Math.ceil(units * (prices[sku] ?? 0));
  const creditFits = (total, day, daysLeft) =>
    total <= credit.budget && day <= Math.floor((credit.budget - (total - day)) / daysLeft);

  // Suma en el almacén; si no puede, o devuelve algo raro, error (y sin contar no se gasta).
  const add = async (keys, by) => {
    const out = await store.add(keys, by);
    if (!out.every(Number.isFinite)) throw new Error(`Contador no válido: ${JSON.stringify(out)}`);
    return out;
  };

  const tryFree = async (sku, units, t) => {
    if (units > limitOf(sku)) return false;
    const { month, day, daysLeft } = where(sku, t);
    const [m, d] = await add([month, day], units);
    if (fits(sku, m, d, daysLeft)) return true;
    await store.add([month, day], -units).catch(log);
    return false;
  };

  const tryCredit = async (sku, units, t) => {
    if (!credit) return false;
    const cost = costOf(sku, units);
    const { total, day, daysLeft } = creditWhere(t);
    if (cost <= 0 || daysLeft < 1) return false;
    const [tot, d] = await add([total, day], cost);
    if (creditFits(tot, d, daysLeft)) return true;
    await store.add([total, day], -cost).catch(log);
    return false;
  };

  return {
    limitOf,

    // Reserva `units` usos de un SKU: del tramo gratis y, si no caben, del crédito. Si tampoco, QuotaError.
    // Se suma primero y se comprueba después: así dos llamadas a la vez nunca pasan las dos del límite
    // (la segunda ve la suma de ambas).
    async take(sku, units = 1) {
      const t = now();
      try {
        if (await tryFree(sku, units, t)) return;
        if (await tryCredit(sku, units, t)) return;
      } catch (e) {
        log(e);
        throw new QuotaError(sku, nextReset(t), 'store');
      }
      throw new QuotaError(sku, nextReset(t));
    },

    // Si ahora mismo cabrían `units` usos (gratis o con crédito), sin gastar nada.
    async canSpend(sku, units = 1) {
      const t = now();
      try {
        const { month, day, daysLeft } = where(sku, t);
        const [m, d] = await store.get([month[0], day[0]]);
        if (units <= limitOf(sku) && fits(sku, m + units, d + units, daysLeft)) return true;
        if (!credit) return false;
        const cost = costOf(sku, units);
        const c = creditWhere(t);
        if (cost <= 0 || c.daysLeft < 1) return false;
        const [tot, cd] = await store.get([c.total[0], c.day[0]]);
        return creditFits(tot + cost, cd + cost, c.daysLeft);
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
      if (credit) {
        const c = creditWhere(t);
        const [tot, d] = await store.get([c.total[0], c.day[0]]);
        const todayLimit = c.daysLeft >= 1 ? Math.floor((credit.budget - (tot - d)) / c.daysLeft) : 0;
        out.credit = { spent: tot / 1000, today: d / 1000, budget: credit.budget / 1000, todayLimit: todayLimit / 1000, daysLeft: Math.max(0, c.daysLeft) };
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

// El crédito de Google (p. ej. el de la prueba gratuita): GOOGLE_CREDIT_EUR, lo que queda tal como sale en
// Facturación → Créditos (vale «244,94»), y GOOGLE_CREDIT_UNTIL, su fecha de fin (AAAA-MM-DD). Se gasta como
// mucho el GOOGLE_CREDIT_SAFETY (0,8) de lo que queda y se deja de usar 2 días antes de que caduque: desde
// ahí, otra vez solo el tramo gratis. Si cambias el importe o la fecha, la cuenta empieza de cero.
export function creditFromEnv(env = process.env) {
  const eur = Number(String(env.GOOGLE_CREDIT_EUR || '').replace(',', '.'));
  const until = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(env.GOOGLE_CREDIT_UNTIL || '').trim());
  if (!(eur > 0) || !until) return null;
  const s = Number(String(env.GOOGLE_CREDIT_SAFETY || '').replace(',', '.'));
  const safety = Number.isFinite(s) && s > 0 && s <= 1 ? s : 0.8;
  return {
    budget: Math.floor(eur * safety * 1000),
    lastDay: Date.UTC(Number(until[1]), Number(until[2]) - 1, Number(until[3])) / 86400e3 - 2,
    id: `${eur}:${until[0]}`,
  };
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

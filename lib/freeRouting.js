// Rutas sin Google: OSRM para andar, bici y coche, y OpenTripPlanner para el transporte público, en
// servidores propios (un servidor gratuito basta: ver GRATIS.md). Se activan con variables de entorno
// y, para los transportes que cubren, sustituyen a Google en la matriz de tiempos y en la ruta dibujada.
// Si un servidor falla, la llamada vuelve a Google (con su cupo gratuito) o a la estimación.
import { decodePolyline, encodePolyline } from './polyline.js';

// El perfil de la URL lo ignora osrm-routed (cada proceso sirve uno), pero los servidores con varios lo usan.
const OSRM_PROFILE = { WALK: 'foot', BICYCLE: 'bike', DRIVE: 'car' };

const trim = (u) => u.replace(/\/+$/, '');
const coord = (p) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;
const minutes = (s) => Math.round(s / 60);

// Corre `fn` sobre cada elemento con como mucho `n` a la vez.
async function pool(items, n, fn) {
  const out = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i], i);
    }
  };
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, worker));
  return out;
}

// token: si el servidor está detrás del proxy de infra/free-routing, la contraseña que pide (X-Routing-Token).
export function makeFreeRouting({ osrm = {}, otp = null, token = '', fetchFn = fetch, timeoutMs = 8000, concurrency = 6, maxWaitMin = 20 } = {}) {
  const getJson = async (url, init = {}) => {
    const headers = { ...(init.headers || {}), ...(token ? { 'X-Routing-Token': token } : {}) };
    const res = await fetchFn(url, { ...init, headers, signal: AbortSignal.timeout(timeoutMs) });
    if (!res.ok) throw new Error(`${url.split('?')[0]}: HTTP ${res.status}`);
    return res.json();
  };

  /* ---------- OSRM ---------- */

  async function osrmMatrix(mode, origins, dests) {
    const pts = [...origins, ...dests].map(coord).join(';');
    const sources = origins.map((_, i) => i).join(';');
    const destinations = dests.map((_, j) => origins.length + j).join(';');
    const d = await getJson(`${trim(osrm[mode])}/table/v1/${OSRM_PROFILE[mode]}/${pts}?sources=${sources}&destinations=${destinations}&annotations=duration`);
    if (d.code !== 'Ok') throw new Error(`OSRM table: ${d.code} ${d.message || ''}`);
    return origins.map((_, i) => dests.map((_, j) => {
      const s = d.durations?.[i]?.[j];
      return s == null ? null : minutes(s);
    }));
  }

  async function osrmRoute(mode, a, b) {
    const d = await getJson(`${trim(osrm[mode])}/route/v1/${OSRM_PROFILE[mode]}/${coord(a)};${coord(b)}?overview=full&geometries=polyline`);
    if (d.code !== 'Ok') throw new Error(`OSRM route: ${d.code} ${d.message || ''}`);
    const r = d.routes?.[0];
    return r ? { polyline: r.geometry, min: minutes(r.duration) } : null;
  }

  /* ---------- OpenTripPlanner (transporte público) ---------- */

  // planConnection (API GTFS GraphQL de OTP 2.6 o posterior): los mejores itinerarios saliendo a esa hora,
  // con su trazado. Coordenadas y hora van escritas en la consulta (son números y una fecha que se generan
  // aquí), así no depende de los nombres de los tipos del esquema.
  const place = (p) => `{ location: { coordinate: { latitude: ${Number(p.lat).toFixed(6)}, longitude: ${Number(p.lng).toFixed(6)} } } }`;
  const planQuery = (a, b, at) => `{
  planConnection(origin: ${place(a)}, destination: ${place(b)}, dateTime: { earliestDeparture: "${at}" }, first: 3) {
    edges { node { start end duration legs { legGeometry { points } } } }
  }
}`;

  // Minutos reales de viaje. Si el primer bus sale mucho después de la hora pedida, la espera de más
  // cuenta: un sitio al que solo se llega con el último metro no es justo para quien lo coge.
  async function otpPlan(a, b, departureTime) {
    const d = await getJson(trim(otp), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // «2026-11-06T19:00:00Z»: ISO con zona, sin milésimas.
      body: JSON.stringify({ query: planQuery(a, b, new Date(departureTime).toISOString().replace(/\.\d{3}Z$/, 'Z')) }),
    });
    if (d.errors?.length) throw new Error(`OTP: ${d.errors[0].message}`);
    const dep = Date.parse(departureTime);
    let best = null;
    for (const { node } of d.data?.planConnection?.edges || []) {
      const wait = Math.max(0, (Date.parse(node.start) - dep) / 60e3 - maxWaitMin);
      const min = Math.round(node.duration / 60 + wait);
      if (!best || min < best.min) best = { min, legs: node.legs };
    }
    if (!best) return null;
    const pts = best.legs.flatMap((l) => (l.legGeometry?.points ? decodePolyline(l.legGeometry.points) : []));
    return { min: best.min, polyline: pts.length >= 2 ? encodePolyline(pts) : '' };
  }

  return {
    supports: (mode) => (mode === 'TRANSIT' ? Boolean(otp) : Boolean(osrm[mode])),

    // Matriz [origen][destino] en minutos (null si no hay ruta), como la de Google.
    async matrix(origins, destinations, mode, departureTime) {
      if (mode !== 'TRANSIT') return osrmMatrix(mode, origins, destinations);
      const pairs = origins.flatMap((o, i) => destinations.map((t, j) => [i, j, o, t]));
      const out = origins.map(() => destinations.map(() => null));
      let failed = 0;
      await pool(pairs, concurrency, async ([i, j, o, t]) => {
        try { out[i][j] = (await otpPlan(o, t, departureTime))?.min ?? null; } catch { failed++; }
      });
      // Si no ha contestado a nada, el servidor está caído: mejor que lo sepa quien llama.
      if (failed === pairs.length) throw new Error('OTP no responde');
      return out;
    },

    async route(origin, dest, mode, departureTime) {
      if (mode !== 'TRANSIT') return osrmRoute(mode, origin, dest);
      const r = await otpPlan(origin, dest, departureTime);
      return r && r.polyline ? { polyline: r.polyline, min: r.min } : null;
    },
  };
}

// OSRM_WALK_URL, OSRM_BIKE_URL, OSRM_CAR_URL y OTP_URL (el endpoint GraphQL, p. ej.
// https://servidor/otp/gtfs/v1), más ROUTING_TOKEN si el servidor lo pide. Sin ninguna, todo sigue con Google.
export function freeRoutingFromEnv(env = process.env, fetchFn = fetch) {
  const osrm = {};
  if (env.OSRM_WALK_URL) osrm.WALK = env.OSRM_WALK_URL;
  if (env.OSRM_BIKE_URL) osrm.BICYCLE = env.OSRM_BIKE_URL;
  if (env.OSRM_CAR_URL) osrm.DRIVE = env.OSRM_CAR_URL;
  const otp = env.OTP_URL || null;
  if (!Object.keys(osrm).length && !otp) return null;
  return makeFreeRouting({ osrm, otp, token: env.ROUTING_TOKEN || '', fetchFn });
}

// El cliente de siempre, pero con la matriz y la ruta de los servidores propios donde los haya.
export function withFreeRouting(google, free, log = console.error) {
  if (!free) return google;
  return {
    ...google,
    async matrix(origins, destinations, mode, departureTime) {
      if (free.supports(mode)) {
        try { return await free.matrix(origins, destinations, mode, departureTime); } catch (e) { log(e); }
      }
      return google.matrix(origins, destinations, mode, departureTime);
    },
    async route(origin, dest, mode, departureTime) {
      if (free.supports(mode)) {
        try {
          const r = await free.route(origin, dest, mode, departureTime);
          if (r) return r;
        } catch (e) { log(e); }
      }
      return google.route(origin, dest, mode, departureTime);
    },
  };
}

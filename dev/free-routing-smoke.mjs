// Comprueba tu servidor de rutas gratis (infra/free-routing) antes de ponerlo en Vercel. No usa Google.
//
//   OSRM_WALK_URL=https://203-0-113-7.sslip.io/osrm/foot \
//   OSRM_BIKE_URL=https://203-0-113-7.sslip.io/osrm/bike \
//   OSRM_CAR_URL=https://203-0-113-7.sslip.io/osrm/car \
//   OTP_URL=https://203-0-113-7.sslip.io/otp/gtfs/v1 \
//   ROUTING_TOKEN=tu-contraseña \
//   node dev/free-routing-smoke.mjs
//
// Por defecto prueba en Valencia; cambia los puntos con SMOKE_FROM / SMOKE_TO ("lat,lng").
import { freeRoutingFromEnv } from '../lib/freeRouting.js';
import { decodePolyline } from '../lib/polyline.js';

const point = (s, fallback) => {
  const [lat, lng] = (s || fallback).split(',').map(Number);
  return { lat, lng };
};
const FROM = point(process.env.SMOKE_FROM, '39.4616,-0.3749'); // Russafa
const TO = point(process.env.SMOKE_TO, '39.4840,-0.3990'); // Campanar
const OTHER = { lat: (FROM.lat + TO.lat) / 2 + 0.01, lng: (FROM.lng + TO.lng) / 2 + 0.02 };

const free = freeRoutingFromEnv(process.env);
if (!free) {
  console.error('No hay ninguna variable OSRM_*_URL ni OTP_URL. Mira el ejemplo al principio de este archivo.');
  process.exit(1);
}

// La próxima hora en punto, para que haya transporte público.
const at = new Date(Math.ceil(Date.now() / 3600e3) * 3600e3).toISOString();
let failures = 0;

for (const mode of ['WALK', 'BICYCLE', 'DRIVE', 'TRANSIT']) {
  if (!free.supports(mode)) { console.log(`${mode.padEnd(8)} sin servidor (seguirá con Google)`); continue; }
  try {
    const t0 = performance.now();
    const m = await free.matrix([FROM, TO], [TO, OTHER], mode, at);
    const t1 = performance.now();
    const r = await free.route(FROM, TO, mode, at);
    const t2 = performance.now();
    const pts = r?.polyline ? decodePolyline(r.polyline).length : 0;
    const ok = m[0][0] != null && r && pts >= 2;
    if (!ok) failures++;
    console.log(`${mode.padEnd(8)} ${ok ? 'OK ' : 'MAL'} matriz ${JSON.stringify(m)} min (${Math.round(t1 - t0)} ms) · ruta ${r?.min ?? '—'} min, ${pts} puntos (${Math.round(t2 - t1)} ms)`);
  } catch (e) {
    failures++;
    console.log(`${mode.padEnd(8)} ERROR ${e.message}`);
  }
}
process.exit(failures ? 1 : 0);

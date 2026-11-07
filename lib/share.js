// La propuesta viaja entera en el enlace (/p/<datos>); con Upstash configurado, el enlace corto la guarda tal cual.
import { decodePolyline } from './polyline.js';

const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

const MODES = ['TRANSIT', 'DRIVE', 'BICYCLE', 'WALK'];
// Por posición en el enlace: los planes nuevos, siempre al final, o los enlaces ya enviados cambiarían de plan.
const PLANS = ['canas', 'cafe', 'cenar', 'copas', 'parque', 'biblioteca'];

const CODE = { TRANSIT: 'T', DRIVE: 'D', BICYCLE: 'B', WALK: 'W' };
const clean = (s) => String(s ?? '').replace(/[~.\r\n]/g, ' ').trim();

// Formato corto para que el enlace quepa bien en WhatsApp:
// nombre~lat~lng~plan~minutos desde 1970~Laura.T13~Pablo.B14 (coordenadas ×10⁴, ~11 m de precisión).
// Recibe el mismo objeto de siempre ({ n, l, pl, w, p, r }); dirección, tipo e id no viajan.
// r: la ruta de cada uno (polilíneas ya recortadas, ver routeForLink), tras un salto de línea y separadas
// por comas: ninguno de los dos caracteres sale en una polilínea ni en los enlaces de antes.
// d: con destino («Ya tenemos destino»), [nombre, lat, lng, transporte, minutos juntos, ruta juntos]; va tras
// un segundo salto de línea como Almussafes~392917~-4128~D22~<polilínea>, sin plan (-1).
export function encodeProposal(p) {
  const [lat, lng] = p.l || [];
  const w = p.w ? Math.round(Date.parse(p.w) / 60000) : '';
  const people = (p.p || []).map(([n, m, t]) => `${clean(n)}.${CODE[m] || 'W'}${Math.round(t)}`);
  const short = [clean(p.n), Math.round(lat * 1e4), Math.round(lng * 1e4), PLANS.indexOf(p.pl), w, ...people].join('~');
  const hasRoutes = (p.r || []).some(Boolean);
  const routes = hasRoutes || p.d ? `\n${(p.r || []).map((r) => r || '').join(',')}` : '';
  const dest = p.d
    ? `\n${[clean(p.d[0]), Math.round(p.d[1] * 1e4), Math.round(p.d[2] * 1e4), `${CODE[p.d[3]] || 'D'}${Math.round(p.d[4])}`, p.d[5] || ''].join('~')}`
    : '';
  return toB64(short + routes + dest);
}

function decodeShort(s) {
  const [head, routes, dest] = s.split('\n');
  const [n, lat, lng, plan, w, ...ps] = head.split('~');
  const modes = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
  let d = null;
  if (dest) {
    // La polilínea puede llevar «~»: es todo lo que queda tras los cuatro primeros campos.
    const [dn, dlat, dlng, dm, ...poly] = dest.split('~');
    const m = (dm || '').match(/^([TDBW])(\d+)$/);
    d = [dn, Number(dlat) / 1e4, Number(dlng) / 1e4, m ? modes[m[1]] : 'DRIVE', m ? Number(m[2]) : 0, poly.join('~')];
  }
  return {
    n, l: [Number(lat) / 1e4, Number(lng) / 1e4], pl: PLANS[Number(plan)],
    w: w ? new Date(Number(w) * 60000).toISOString() : null,
    p: ps.map((x) => { const m = x.match(/^(.*)\.([TDBW])(\d+)$/); return m ? [m[1], modes[m[2]], Number(m[3])] : [x, 'WALK', 0]; }),
    r: routes == null ? [] : routes.split(','),
    d,
  };
}

// Una ruta del enlace solo se dibuja si es una polilínea sana y razonable.
function routeOf(s) {
  if (typeof s !== 'string' || s.length < 4 || s.length > 4000 || !/^[?-~]+$/.test(s)) return null;
  const pts = decodePolyline(s);
  return pts.length >= 2 && pts.length <= 1500 && pts.every(([x, y]) => Math.abs(x) <= 180 && Math.abs(y) <= 90) ? pts : null;
}

// Lo que llega en un enlace lo puede escribir cualquiera: se valida campo a campo.
// Acepta el formato corto y el JSON de los primeros enlaces.
export function decodeProposal(data) {
  let d;
  try {
    const s = fromB64(String(data));
    d = s.startsWith('{') ? JSON.parse(s) : decodeShort(s);
  } catch { return null; }
  if (!d || typeof d.n !== 'string' || !d.n.trim() || !Array.isArray(d.p) || !d.p.length) return null;
  const num = (v) => (v !== null && v !== '' && Number.isFinite(Number(v)) ? Number(v) : null);
  const lat = num(d.l?.[0]), lng = num(d.l?.[1]);
  return {
    name: d.n.slice(0, 80),
    address: typeof d.a === 'string' ? d.a.slice(0, 140) : '',
    type: typeof d.t === 'string' ? d.t.slice(0, 40) : '',
    placeId: typeof d.i === 'string' && /^[\w-]{2,300}$/.test(d.i) ? d.i : null,
    loc: lat != null && lng != null && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : null,
    plan: PLANS.includes(d.pl) ? d.pl : 'canas',
    when: typeof d.w === 'string' && !Number.isNaN(Date.parse(d.w)) ? d.w : null,
    people: d.p.slice(0, 8).map((x, i) => ({
      name: (typeof x?.[0] === 'string' ? x[0].slice(0, 20) : '') || `Persona ${i + 1}`,
      mode: MODES.includes(x?.[1]) ? x[1] : 'WALK',
      min: Math.max(0, Math.min(600, Math.round(num(x?.[2]) ?? 0))),
    })),
    routes: d.p.slice(0, 8).map((_, i) => routeOf(Array.isArray(d.r) ? d.r[i] : null)),
    trip: tripOf(d.d, num),
  };
}

// El destino de un enlace con «Ya tenemos destino», validado como el resto.
function tripOf(t, num) {
  if (!Array.isArray(t) || typeof t[0] !== 'string' || !t[0].trim()) return null;
  const lat = num(t[1]), lng = num(t[2]);
  if (lat == null || lng == null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return {
    name: t[0].slice(0, 80), loc: { lat, lng },
    mode: MODES.includes(t[3]) ? t[3] : 'DRIVE',
    min: Math.max(0, Math.min(600, Math.round(num(t[4]) ?? 0))),
    route: routeOf(t[5]),
  };
}

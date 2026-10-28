// La propuesta viaja entera en el enlace (/p/<datos>): no se guarda nada en el servidor.
const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

const MODES = ['TRANSIT', 'DRIVE', 'BICYCLE', 'WALK'];
const PLANS = ['canas', 'cafe', 'cenar', 'copas', 'parque'];

const CODE = { TRANSIT: 'T', DRIVE: 'D', BICYCLE: 'B', WALK: 'W' };
const clean = (s) => String(s ?? '').replace(/[~.]/g, ' ').trim();

// Formato corto para que el enlace quepa bien en WhatsApp:
// nombre~lat~lng~plan~minutos desde 1970~Laura.T13~Pablo.B14 (coordenadas ×10⁴, ~11 m de precisión).
// Recibe el mismo objeto de siempre ({ n, l, pl, w, p }); dirección, tipo e id no viajan.
export function encodeProposal(p) {
  const [lat, lng] = p.l || [];
  const w = p.w ? Math.round(Date.parse(p.w) / 60000) : '';
  const people = (p.p || []).map(([n, m, t]) => `${clean(n)}.${CODE[m] || 'W'}${Math.round(t)}`);
  return toB64([clean(p.n), Math.round(lat * 1e4), Math.round(lng * 1e4), PLANS.indexOf(p.pl), w, ...people].join('~'));
}

function decodeShort(s) {
  const [n, lat, lng, plan, w, ...ps] = s.split('~');
  const modes = Object.fromEntries(Object.entries(CODE).map(([k, v]) => [v, k]));
  return {
    n, l: [Number(lat) / 1e4, Number(lng) / 1e4], pl: PLANS[Number(plan)],
    w: w ? new Date(Number(w) * 60000).toISOString() : null,
    p: ps.map((x) => { const m = x.match(/^(.*)\.([TDBW])(\d+)$/); return m ? [m[1], modes[m[2]], Number(m[3])] : [x, 'WALK', 0]; }),
  };
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
  };
}

// La propuesta viaja entera en el enlace (/p/<datos>): no se guarda nada en el servidor.
const toB64 = (s) => btoa(String.fromCharCode(...new TextEncoder().encode(s))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const fromB64 = (s) => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0)));

const MODES = ['TRANSIT', 'DRIVE', 'BICYCLE', 'WALK'];
const PLANS = ['canas', 'cafe', 'cenar', 'copas', 'parque'];

// { n: nombre, a: dirección, t: tipo, i: placeId, l: [lat, lng], pl: plan, w: ISO, p: [[nombre, modo, minutos]] }
export function encodeProposal(p) {
  return toB64(JSON.stringify(p));
}

// Lo que llega en un enlace lo puede escribir cualquiera: se valida campo a campo.
export function decodeProposal(data) {
  let d;
  try { d = JSON.parse(fromB64(String(data))); } catch { return null; }
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

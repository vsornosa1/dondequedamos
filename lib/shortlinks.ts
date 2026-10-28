// Enlaces cortos (/p/k3X9aQ2b): la propuesta se guarda en Upstash Redis y el enlace solo lleva un código.
// Se habla con Upstash por su API REST, sin dependencias. Si no está configurado, se usa el enlace largo.
import { decodeProposal } from './share.js';

const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;
const TTL = 30 * 24 * 3600; // las propuestas caducan solas a los 30 días
const ALPHABET = 'abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // sin 0/O ni 1/l/I
export const SHORT_ID = /^[a-zA-Z0-9]{8}$/;

export const shortLinksEnabled = () => Boolean(URL_ && TOKEN);

async function redis(cmd: (string | number)[]) {
  const res = await fetch(URL_!, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(cmd), cache: 'no-store' });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return (await res.json()).result as unknown;
}

// 8 caracteres de 56 posibles: ~10¹⁴ códigos, imposible de adivinar o de recorrer.
function newId() {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

// Guarda el código largo ya validado y devuelve el corto. NX: nunca pisa una propuesta existente.
export async function createShort(data: string) {
  for (let i = 0; i < 3; i++) {
    const id = newId();
    if ((await redis(['SET', `p:${id}`, data, 'EX', TTL, 'NX'])) === 'OK') return id;
  }
  throw new Error('No se ha podido crear el enlace');
}

// Acepta el código corto o el enlace largo de siempre.
export async function loadProposal(param: string) {
  if (SHORT_ID.test(param) && shortLinksEnabled()) {
    const data = await redis(['GET', `p:${param}`]).catch(() => null);
    return typeof data === 'string' ? decodeProposal(data) : null;
  }
  return decodeProposal(param);
}

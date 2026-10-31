// Upstash Redis por su API REST, sin dependencias. Lo usan los enlaces cortos, la caché de búsquedas
// y el límite por IP. Si no está configurado, cada uso tiene su plan B en memoria.
const URL_ = process.env.KV_REST_API_URL;
const TOKEN = process.env.KV_REST_API_TOKEN;

export const redisEnabled = () => Boolean(URL_ && TOKEN);

const post = async (path: string, body: unknown) => {
  const res = await fetch(URL_! + path, { method: 'POST', headers: { Authorization: `Bearer ${TOKEN}` }, body: JSON.stringify(body), cache: 'no-store' });
  if (!res.ok) throw new Error(`Upstash ${res.status}`);
  return res.json();
};

export async function redis(cmd: (string | number)[]) {
  return (await post('', cmd)).result as unknown;
}

// Varios comandos en una sola petición. Si alguno falla, falla todo: quien cuenta no puede fiarse a medias.
export async function pipeline(cmds: (string | number)[][]) {
  const out = (await post('/pipeline', cmds)) as { result?: unknown; error?: string }[];
  const bad = out.find((r) => r.error);
  if (bad) throw new Error(`Upstash: ${bad.error}`);
  return out.map((r) => r.result);
}

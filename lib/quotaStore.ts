// Dónde cuenta el guardián del tramo gratuito (lib/quota.js): en Upstash Redis, compartido por todas las
// instancias de Vercel. Cada reserva es un INCRBY atómico, así que dos búsquedas a la vez no se pisan.
import { pipeline, redis } from './redis';

export const redisQuotaStore = {
  async add(entries: [string, number][], by: number) {
    const out = await pipeline(entries.flatMap(([k, ttl]) => [['INCRBY', k, by], ['EXPIRE', k, ttl]]));
    return entries.map((_, i) => Number(out[i * 2]));
  },
  async get(keys: string[]) {
    const out = (await redis(['MGET', ...keys])) as (string | null)[];
    return out.map((v) => Number(v) || 0);
  },
};

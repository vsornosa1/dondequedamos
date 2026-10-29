// `npm run dev:mock`: `next dev` con el Google simulado aunque el .env tenga la clave de verdad, para probar
// la interfaz sin gastar. Las variables del proceso mandan sobre las del .env, y lib/api.ts nunca usa el
// simulador en producción.
import { spawn } from 'node:child_process';

const child = spawn('npx', ['next', 'dev', ...process.argv.slice(2)], {
  stdio: 'inherit', shell: true, env: { ...process.env, GOOGLE_MAPS_API_KEY: 'mock' },
});
child.on('exit', (code) => process.exit(code ?? 0));

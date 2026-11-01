// Exports the relaunch clip's cut list for its score: node scripts/cues-vuelve.ts (Node strips the types).
import { writeFileSync } from 'node:fs';
import { V_TOTAL, VK, VT } from '../src/vuelve/timing.ts';

writeFileSync('music/cues-vuelve.json', JSON.stringify({ fps: 30, total: V_TOTAL, T: VT, K: VK }, null, 1));
console.log('wrote music/cues-vuelve.json');

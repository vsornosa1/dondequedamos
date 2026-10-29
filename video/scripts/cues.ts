// Exports the cut list for the score: node scripts/cues.ts (Node strips the types).
import { writeFileSync } from 'node:fs';
import { BEAT, FPS, K, T, TOTAL } from '../src/timing.ts';

writeFileSync('music/cues.json', JSON.stringify({ fps: FPS, beat: BEAT, total: TOTAL, T, K }, null, 1));
console.log('wrote music/cues.json');

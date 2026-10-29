// Experimento: ¿debe la búsqueda pesar el esfuerzo de cada transporte? (solo con Google simulado)
// Repite findMeetingPlace con varias reglas de puntuación sobre grupos mixtos y de control, y saca
// los minutos de cada uno en el sitio elegido. Nunca usa GOOGLE_MAPS_API_KEY: todo va contra lib/mockGoogle.js.
//
//   node dev/effort-by-mode.mjs             tabla por grupo
//   node dev/effort-by-mode.mjs --md        la misma tabla en Markdown
//   node dev/effort-by-mode.mjs --zones     además, las 8 zonas de prueba de cada grupo
//   node dev/effort-by-mode.mjs --random 300  grupos al azar (semilla fija): cuánto cambia cada regla
import { PLANS, MODES, clamp, offset, centroid, spreadMeters, estimateMinutes, pickVenues } from '../lib/core.js';
import { timesTo, findMeetingPlace } from '../lib/search.js';
import { makeGoogle } from '../lib/google.js';
import { mockFetch } from '../lib/mockGoogle.js';

const google = makeGoogle('mock', mockFetch);
const MD = process.argv.includes('--md');
const ZONES = process.argv.includes('--zones');
const RANDOM = process.argv.includes('--random') ? Number(process.argv[process.argv.indexOf('--random') + 1]) || 300 : 0;

const SPOTS = {
  Russafa: [39.4616, -0.3749], 'Gran Vía': [39.4660, -0.3700], Campanar: [39.4840, -0.3990],
  Benimaclet: [39.4876, -0.3570], Patraix: [39.4607, -0.3962], 'El Cabanyal': [39.4699, -0.3283],
  Torrent: [39.4371, -0.4655], Burjassot: [39.5097, -0.4133], Mislata: [39.4752, -0.4180],
  'Pl. Reina': [39.4742, -0.3766], 'El Carme': [39.4790, -0.3800], 'Algirós': [39.4740, -0.3530],
  Ayuntamiento: [39.4699, -0.3763],
};

const GROUPS = [
  ['G1', 'Dos a pie cerca + coche (el caso de Vicent)', [['Russafa', 'WALK'], ['Gran Vía', 'WALK'], ['Campanar', 'DRIVE']]],
  ['G2', 'Grupo del vídeo', [['Benimaclet', 'TRANSIT'], ['Russafa', 'BICYCLE'], ['Patraix', 'DRIVE'], ['El Cabanyal', 'WALK']]],
  ['G3', 'Uno a pie + dos en coche', [['Russafa', 'WALK'], ['Mislata', 'DRIVE'], ['Benimaclet', 'DRIVE']]],
  ['G4', 'Pareja: a pie + coche', [['Russafa', 'WALK'], ['Campanar', 'DRIVE']]],
  ['G5', 'Tres a pie cerca + coche', [['Russafa', 'WALK'], ['Gran Vía', 'WALK'], ['Ayuntamiento', 'WALK'], ['Burjassot', 'DRIVE']]],
  ['G6', 'Dos a pie cerca + transporte público', [['Russafa', 'WALK'], ['Gran Vía', 'WALK'], ['Burjassot', 'TRANSIT']]],
  ['G7', 'Dos a pie cerca + bici', [['Russafa', 'WALK'], ['Gran Vía', 'WALK'], ['Benimaclet', 'BICYCLE']]],
  ['G8', 'Dos a pie lejos entre sí + coche', [['Russafa', 'WALK'], ['Benimaclet', 'WALK'], ['Torrent', 'DRIVE']]],
  ['C1', 'Control: todos en transporte público', [['Benimaclet', 'TRANSIT'], ['Patraix', 'TRANSIT'], ['El Cabanyal', 'TRANSIT'], ['Campanar', 'TRANSIT']]],
  ['C2', 'Control: cinco en el centro + uno en Torrent (público)', [['Russafa', 'TRANSIT'], ['Gran Vía', 'TRANSIT'], ['Pl. Reina', 'TRANSIT'], ['El Carme', 'TRANSIT'], ['Algirós', 'TRANSIT'], ['Torrent', 'TRANSIT']]],
  ['C3', 'Control: uno vive en medio (todos en bici)', [['Benimaclet', 'BICYCLE'], ['Pl. Reina', 'BICYCLE'], ['Patraix', 'BICYCLE']]],
  ['C4', 'Control: dos en público + coche', [['Benimaclet', 'TRANSIT'], ['Russafa', 'TRANSIT'], ['Mislata', 'DRIVE']]],
].map(([id, name, people]) => ({
  id, name,
  labels: people.map(([spot]) => spot),
  friends: people.map(([spot, mode]) => ({ mode, loc: { lat: SPOTS[spot][0], lng: SPOTS[spot][1] } })),
}));

// ---------- Reglas ----------
// Cada regla decide tres cosas: el coste del estimador (centro del anillo de zonas), la zona de la fase A
// y el orden de los sitios de la fase B. Los minutos que se muestran son siempre los reales.

const sum = (t) => t.reduce((s, x) => s + x, 0);
const stats = (t) => {
  const max = Math.max(...t), min = Math.min(...t), total = sum(t);
  return { max, min, gap: max - min, total, avg: total / t.length };
};
const argmin = (xs) => xs.reduce((best, x, i) => (x < xs[best] ? i : best), 0);
const order = (xs) => xs.map((x, i) => [x, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map(([, i]) => i);

// Fórmulas de lib/core.js antes del cambio, copiadas para poder comparar aunque la librería cambie.
const justo0 = (t) => { const s = stats(t); return s.max + 0.35 * s.gap; };
const rapido0 = (t) => { const s = stats(t); return s.avg + 0.25 * s.gap; };
const est0 = (t) => { const s = stats(t); return s.max + 0.05 * s.gap; };

const weigh = (W) => (t, modes) => t.map((x, i) => x * W[modes[i]]);
const byScore = (f, est = f) => ({
  estimate: est,
  zone: (cols, modes) => argmin(cols.map((t) => f(t, modes))),
  order: (cols, modes) => order(cols.map((t) => f(t, modes))),
});

// Tolerancia: entre los sitios cuyo «quien más tarda» queda a ≤ tol min del mejor, el que menos suma.
const tolerance = (tol) => {
  const rank = (cols) => {
    const best = Math.min(...cols.map((t) => Math.max(...t)));
    return cols.map((t) => (Math.max(...t) <= best + tol ? sum(t) + justo0(t) / 1000 : 1e6 + justo0(t)));
  };
  return { estimate: est0, zone: (cols) => argmin(rank(cols)), order: (cols) => order(rank(cols)) };
};

const W_SOFT = { WALK: 1.3, BICYCLE: 1.15, TRANSIT: 1, DRIVE: 0.9 };
const W_STRONG = { WALK: 2, BICYCLE: 1.5, TRANSIT: 1, DRIVE: 1 };
const maxAvg = (lambda) => (t) => { const s = stats(t); return s.max + lambda * s.avg; };

const RULES = {
  R0: { label: 'Actual: «Más justo» (máx + 0,35·dif.)', ...byScore(justo0, est0) },
  R0m: { label: 'Actual, botón «Menos tiempo» (misma zona)', estimate: est0, zone: (c) => argmin(c.map(justo0)), order: (c) => order(c.map(rapido0)) },
  R1: { label: 'Pesos por esfuerzo (pie 1,3 · bici 1,15 · público 1 · coche 0,9)', ...byScore((t, m) => justo0(weigh(W_SOFT)(t, m)), (t, m) => est0(weigh(W_SOFT)(t, m))) },
  R1x: { label: 'Pesos fuertes (pie 2 · bici 1,5 · público 1 · coche 1)', ...byScore((t, m) => justo0(weigh(W_STRONG)(t, m)), (t, m) => est0(weigh(W_STRONG)(t, m))) },
  R2: { label: 'Tolerancia: ≤ 2 min del mejor máximo → menos minutos en total', ...tolerance(2) },
  R3: { label: 'Fase A con «Menos tiempo» (media + 0,25·dif.)', ...byScore(rapido0) },
  'R4¼': { label: 'máx + ¼·media (sin diferencia)', ...byScore(maxAvg(0.25)) },
  'R4½': { label: 'máx + ½·media (sin diferencia)', ...byScore(maxAvg(0.5)) },
  'R4¾': { label: 'máx + ¾·media (sin diferencia)', ...byScore(maxAvg(0.75)) },
  R4: { label: 'máx + media (sin diferencia)', ...byScore(maxAvg(1)) },
};
// Probado y descartado: meter también el punto de tiempos iguales entre las 8 zonas (sustituyendo la del
// anillo más cercana). No cambió nada: los sitios mejores que se escapan salen del ruido de la fase B.

// En la tabla por grupo solo salen las reglas principales (con --all, todas); el barrido de λ va en --random.
const TABLE = process.argv.includes('--all') ? Object.keys(RULES) : ['R0', 'R0m', 'R1', 'R1x', 'R2', 'R3', 'R4½', 'R4'];

// ---------- La búsqueda, con la regla enchufable (misma lógica que lib/search.js) ----------

function estimateBestPoint(friends, cost) {
  const pts = friends.map((f) => f.loc), modes = friends.map((f) => f.mode);
  const c = (p) => cost(friends.map((f) => estimateMinutes(f.loc, f.mode, p)), modes);
  let best = centroid(pts);
  let span = Math.max(spreadMeters(pts), 500);
  let bestCost = c(best);
  for (let round = 0; round < 6; round++) {
    const center = best;
    for (let i = -6; i <= 6; i++)
      for (let j = -6; j <= 6; j++) {
        const p = offset(offset(center, (i / 6) * span, 0), (j / 6) * span, 90);
        const v = c(p);
        if (v < bestCost) { bestCost = v; best = p; }
      }
    span /= 3;
  }
  return best;
}

function candidates(friends, cost) {
  const pts = friends.map((f) => f.loc);
  const fair = estimateBestPoint(friends, cost);
  const r = clamp(spreadMeters(pts) * 0.15, 400, 3000);
  const cands = [{ ...fair, kind: 'estimado' }];
  for (let k = 0; k < 6; k++) cands.push({ ...offset(fair, r, k * 60), kind: `anillo${k}` });
  cands.push({ ...centroid(pts), kind: 'centro' });
  return { cands, ringRadius: r };
}

const column = (t, j) => t.map((row) => row[j].min);

async function search(friends, rule, plan = 'cenar') {
  const modes = friends.map((f) => f.mode);
  const dep = new Date(Date.now() + 60_000).toISOString();
  const { cands, ringRadius } = candidates(friends, rule.estimate);
  const one = friends.map((f) => ({ ...f, modes: [f.mode] })); // este script compara reglas con un transporte por persona
  const tA = (await timesTo(google, one, cands, dep)).times;
  const colsA = cands.map((_, j) => column(tA, j));
  const z = rule.zone(colsA, modes);
  const radius = Math.round(clamp(ringRadius * 1.2, 500, 2500));
  const places = await google.nearby(cands[z], radius, PLANS[plan].types);
  const venues = pickVenues(places, cands[z], 12);
  const vLocs = venues.map((v) => ({ lat: v.location.latitude, lng: v.location.longitude }));
  const tB = (await timesTo(google, one, vLocs, dep)).times;
  const colsB = venues.map((_, j) => column(tB, j));
  const ord = rule.order(colsB, modes);
  return { cands, colsA, z, venues, colsB, ord, top: ord[0] };
}

// ¿Hay otro sitio de la lista donde nadie tarda más y alguien tarda menos?
const dominated = (cols, i) => cols.some((t, j) => j !== i && t.every((x, k) => x <= cols[i][k]) && t.some((x, k) => x < cols[i][k]));

// ---------- Ejecución ----------

async function runGroup(g, keys = Object.keys(RULES), withLib = true) {
  const out = { g, rules: {} };
  for (const key of keys) {
    const r = await search(g.friends, RULES[key]);
    const t = r.colsB[r.top];
    out.rules[key] = { ...r, t, s: stats(t), name: r.venues[r.top].displayName.text, zoneKind: r.cands[r.z].kind, dom: dominated(r.colsB, r.top),
      dom5: r.ord.slice(0, 5).filter((i) => dominated(r.colsB, i)).length };
  }
  if (withLib) {
    // Qué regla reproduce hoy lib/search.js (R0 antes del cambio, R4½ después).
    const real = await findMeetingPlace(google, { friends: g.friends, plan: 'cenar' });
    const realTop = [...real.options].sort((a, b) => a.justo.score - b.justo.score)[0];
    out.libIs = keys.filter((k) => out.rules[k].name === realTop.name && out.rules[k].t.join() === realTop.times.map((x) => x.min).join());
  }
  return out;
}

if (RANDOM) {
  await randomReport(RANDOM);
  process.exit(0);
}

const MODE = { WALK: 'a pie', BICYCLE: 'bici', TRANSIT: 'público', DRIVE: 'coche' };
const rows = [];
for (const g of GROUPS) rows.push(await runGroup(g, TABLE));

const fmt = (n) => String(Math.round(n));
if (MD) {
  console.log('| Grupo | Regla | Minutos por persona | Máx | Dif. | Total | Sitio (zona) |');
  console.log('|---|---|---|--:|--:|--:|---|');
}
for (const { g, rules, libIs } of rows) {
  if (!MD) {
    console.log(`\n${g.id} · ${g.name}`);
    console.log('   ' + g.labels.map((l, i) => `${l} (${MODE[g.friends[i].mode]})`).join(' · '));
  }
  for (const [key, r] of Object.entries(rules)) {
    const per = r.t.map((x, i) => `${g.labels[i]} ${x}`).join(' · ');
    const flag = (r.dom ? ' [dominado]' : '') + (libIs.includes(key) ? ' ← lib hoy' : '');
    if (MD) console.log(`| ${g.id} | ${key} | ${per} | ${r.s.max} | ${r.s.gap} | ${r.s.total} | ${r.name} (${r.zoneKind})${flag} |`);
    else console.log(`   ${key.padEnd(4)} ${r.t.map((x) => String(x).padStart(3)).join(' ')}   máx ${fmt(r.s.max).padStart(2)}  dif ${fmt(r.s.gap).padStart(2)}  total ${fmt(r.s.total).padStart(3)}   ${r.name} · ${r.zoneKind}${flag}${r.dom5 ? ` · ${r.dom5} dominados en el top 5` : ''}`);
  }
  if (ZONES) {
    const r0 = rules.R0;
    console.log('   zonas de prueba (R0):');
    r0.cands.forEach((c, j) => console.log(`     ${c.kind.padEnd(8)} ${r0.colsA[j].map((x) => String(x).padStart(3)).join(' ')}  máx ${Math.max(...r0.colsA[j])}  total ${sum(r0.colsA[j])}${j === r0.z ? '  ← elegida' : ''}`));
  }
}

if (!MD) {
  console.log('\nReglas:');
  for (const key of TABLE) console.log(`   ${key.padEnd(4)} ${RULES[key].label}`);
  // Resumen frente a la regla actual: cuánto empeora quien más tarda y cuántos minutos ahorra el grupo.
  console.log('\nFrente a R0 (Δmáx / Δtotal por grupo):');
  for (const key of TABLE.filter((k) => k !== 'R0')) {
    const d = rows.map(({ g, rules }) => `${g.id} ${signed(rules[key].s.max - rules.R0.s.max)}/${signed(rules[key].s.total - rules.R0.s.total)}`);
    console.log(`   ${key.padEnd(4)} ${d.join('  ')}`);
  }
  const domR0 = rows.filter((r) => r.rules.R0.dom).map((r) => r.g.id);
  console.log(`\nR0 elige un sitio dominado (otro con nadie peor y alguien mejor) en: ${domR0.join(', ') || 'ninguno'}`);
}
function signed(n) { return (n > 0 ? '+' : '') + n; }

// ---------- Grupos al azar ----------
// Puntos dentro de 5 km del centro de València, de 2 a 6 personas. Dos familias: mixtos (al menos uno a pie
// y uno en coche) y de control (todos con el mismo transporte). Semilla fija para que salga siempre igual.

function rng(seed) {
  return () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

function randomGroups(n, rand) {
  const CENTER = { lat: 39.4699, lng: -0.3763 };
  const spot = () => offset(CENTER, 5000 * Math.sqrt(rand()), rand() * 360);
  const groups = [];
  for (let k = 0; k < n; k++) {
    const size = 2 + Math.floor(rand() * 5);
    const mixed = k % 2 === 0;
    const same = MODES[Math.floor(rand() * MODES.length)];
    const modes = Array.from({ length: size }, (_, i) => (mixed ? (i === 0 ? 'WALK' : i === 1 ? 'DRIVE' : MODES[Math.floor(rand() * MODES.length)]) : same));
    groups.push({ id: `${mixed ? 'M' : 'S'}${k}`, mixed, friends: modes.map((mode) => ({ mode, loc: spot() })) });
  }
  return groups;
}

async function randomReport(n) {
  const keys = Object.keys(RULES).filter((k) => k !== 'R0m');
  const groups = randomGroups(n, rng(20261029));
  const runs = [];
  for (const g of groups) runs.push(await runGroup(g, keys, false));
  const pct = (a, b) => `${Math.round((100 * a) / b)}%`.padStart(4);
  const median = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };
  const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;
  for (const [title, set] of [['Mixtos (al menos uno a pie y uno en coche)', runs.filter((r) => r.g.mixed)], ['Control (todos con el mismo transporte)', runs.filter((r) => !r.g.mixed)]]) {
    console.log(`\n${title}: ${set.length} grupos`);
    console.log('   regla  Δmáx≤0  Δmáx+1  Δmáx+2  Δmáx≥3  peor Δmáx  Δtotal medio  dominado   a pie (mediana)  coche (mediana)');
    for (const key of keys) {
      const dMax = set.map((r) => r.rules[key].s.max - r.rules.R0.s.max);
      const dTot = set.map((r) => r.rules[key].s.total - r.rules.R0.s.total);
      const dom = set.filter((r) => r.rules[key].dom).length;
      const byMode = (m) => median(set.flatMap((r) => r.rules[key].t.filter((_, i) => r.g.friends[i].mode === m)));
      console.log(`   ${key.padEnd(5)} ${pct(dMax.filter((d) => d <= 0).length, set.length)}    ${pct(dMax.filter((d) => d === 1).length, set.length)}    ${pct(dMax.filter((d) => d === 2).length, set.length)}    ${pct(dMax.filter((d) => d >= 3).length, set.length)}    ${signed(Math.max(...dMax)).padStart(4)}       ${mean(dTot).toFixed(1).padStart(6)}       ${pct(dom, set.length)}     ${String(byMode('WALK')).padStart(6)}           ${String(byMode('DRIVE')).padStart(6)}`);
    }
  }
  console.log('\nΔ frente a R0 (la regla de hoy). «dominado»: hay otro sitio en la lista con nadie peor y alguien mejor.');

  // ¿Se le escapan a la búsqueda nueva sitios mejores según su propia regla? Comparamos con el sitio de R0.
  for (const key of ['R4¼', 'R4½', 'R4¾', 'R4']) {
    const f = maxAvg({ 'R4¼': 0.25, 'R4½': 0.5, 'R4¾': 0.75, R4: 1 }[key]);
    const missed = runs.filter((r) => f(r.rules.R0.t) < f(r.rules[key].t) - 1e-9);
    const pairs = runs.filter((r) => r.g.friends.length === 2 && r.g.mixed);
    const door = pairs.filter((r) => Math.min(...r.rules[key].t) <= 2).length;
    console.log(`${key}: el sitio de R0 puntúa mejor con ${key} en ${missed.length}/${runs.length} grupos; parejas a pie + coche que quedan en la puerta de quien va a pie: ${door}/${pairs.length}`);
  }

  // Los casos en que R4½ más empeora a quien más tarda: ¿es el coche absorbiendo el viaje o algo raro?
  const TAG = { WALK: 'pie', BICYCLE: 'bici', TRANSIT: 'púb', DRIVE: 'coche' };
  const worst = [...runs].sort((a, b) => (b.rules['R4½'].s.max - b.rules.R0.s.max) - (a.rules['R4½'].s.max - a.rules.R0.s.max)).slice(0, 12);
  console.log('\nDonde R4½ más sube el máximo (R0 → R4½, minutos por persona):');
  for (const r of worst) {
    const a = r.rules.R0, b = r.rules['R4½'];
    const per = r.g.friends.map((f, i) => `${TAG[f.mode]} ${a.t[i]}→${b.t[i]}`).join(' · ');
    console.log(`   ${r.g.id.padEnd(5)} máx ${a.s.max}→${b.s.max}  total ${a.s.total}→${b.s.total}   ${per}`);
  }
}

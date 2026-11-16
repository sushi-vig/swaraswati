// Swara math: names, tuning tables, nearest-swara lookup.

export const SWARA_ORDER = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];

// Short display names. Lowercase = komal, Ma^ = tivra Ma. These two tables are rewritten in place by setNaming()
// so every module that imported them follows the chosen tradition.
export const SWARA_NAMES = { S: 'Sa', r: 're', R: 'Re', g: 'ga', G: 'Ga', m: 'Ma', M: 'Ma^', P: 'Pa', d: 'dha', D: 'Dha', n: 'ni', N: 'Ni' };
export const SWARA_LONG = { S: 'Sa', r: 'komal Re', R: 'shuddha Re', g: 'komal Ga', G: 'shuddha Ga', m: 'shuddha Ma', M: 'tivra Ma', P: 'Pa', d: 'komal Dha', D: 'shuddha Dha', n: 'komal Ni', N: 'shuddha Ni' };
const HINDUSTANI_NAMES = { ...SWARA_NAMES }, HINDUSTANI_LONG = { ...SWARA_LONG };

// Carnatic: sixteen names over the same twelve pitches. Ri2 and Ga1 share a pitch, as do Ri3/Ga2, Da2/Ni1 and
// Da3/Ni2; which name a pitch takes depends on the raga, so carnaticNames() looks at the raga's swaras.
const CARNATIC = {
  S: ['Sa', 'Shadja'], r: ['Ri1', 'suddha Rishabha'], R: ['Ri2', 'chatusruti Rishabha'], g: ['Ga2', 'sadharana Gandhara'], G: ['Ga3', 'antara Gandhara'],
  m: ['Ma1', 'suddha Madhyama'], M: ['Ma2', 'prati Madhyama'], P: ['Pa', 'Panchama'], d: ['Da1', 'suddha Dhaivata'], D: ['Da2', 'chatusruti Dhaivata'],
  n: ['Ni2', 'kaisiki Nishada'], N: ['Ni3', 'kakali Nishada'],
};
const CARNATIC_ALT = { R: ['Ga1', 'suddha Gandhara'], g: ['Ri3', 'shatsruti Rishabha'], D: ['Ni1', 'suddha Nishada'], n: ['Da3', 'shatsruti Dhaivata'] };
export function carnaticNames(set) {
  const names = {}, long = {};
  for (const k of SWARA_ORDER) { names[k] = CARNATIC[k][0]; long[k] = CARNATIC[k][1]; }
  if (set) {
    if (set.has('r') && set.has('R') && !set.has('g') && !set.has('G')) { names.R = CARNATIC_ALT.R[0]; long.R = CARNATIC_ALT.R[1]; }
    if (set.has('g') && set.has('G')) { names.g = CARNATIC_ALT.g[0]; long.g = CARNATIC_ALT.g[1]; }
    if (set.has('d') && set.has('D') && !set.has('n') && !set.has('N')) { names.D = CARNATIC_ALT.D[0]; long.D = CARNATIC_ALT.D[1]; }
    if (set.has('n') && set.has('N')) { names.n = CARNATIC_ALT.n[0]; long.n = CARNATIC_ALT.n[1]; }
  }
  return { names, long };
}
export let NAMING = 'hindustani';
// Switch the live name tables. `set` is the current raga's swara set (for Carnatic name resolution).
export function setNaming(mode, set = null) {
  NAMING = mode === 'carnatic' ? 'carnatic' : 'hindustani';
  const src = NAMING === 'carnatic' ? carnaticNames(set) : { names: HINDUSTANI_NAMES, long: HINDUSTANI_LONG };
  Object.assign(SWARA_NAMES, src.names); Object.assign(SWARA_LONG, src.long);
  Object.assign(OCT_NAMES, NAMING === 'carnatic' ? { '-2': 'anumandra', '-1': 'mandra', '0': 'madhya', '1': 'tara', '2': 'ati-tara' }
    : { '-2': 'ati-mandra', '-1': 'mandra', '0': 'madhya', '1': 'taar', '2': 'ati-taar' });
}
// Sruti as Carnatic singers name it (kattai: C = 1, C# = 1½ … B = 7) and as harmonium players do (safed/kali keys).
const KATTAI = ['1', '1½', '2', '2½', '3', '4', '4½', '5', '5½', '6', '6½', '7'];
const HARMONIUM = ['safed 1', 'kali 1', 'safed 2', 'kali 2', 'safed 3', 'safed 4', 'kali 3', 'safed 5', 'kali 4', 'safed 6', 'kali 5', 'safed 7'];
export const kattaiOf = (midi) => KATTAI[((Math.round(midi) % 12) + 12) % 12];
export const harmoniumKeyOf = (midi) => HARMONIUM[((Math.round(midi) % 12) + 12) % 12];

// 5-limit just intonation (what a tanpura/harmonium-free ear settles on).
export const CENTS_JI = { S: 0, r: 111.73, R: 203.91, g: 315.64, G: 386.31, m: 498.04, M: 590.22, P: 701.96, d: 813.69, D: 884.36, n: 1017.60, N: 1088.27 };
// 12-tone equal temperament (harmonium / keyboard).
export const CENTS_ET = { S: 0, r: 100, R: 200, g: 300, G: 400, m: 500, M: 600, P: 700, d: 800, D: 900, n: 1000, N: 1100 };

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const OCT_NAMES = { '-2': 'ati-mandra', '-1': 'mandra', '0': 'madhya', '1': 'taar', '2': 'ati-taar' };

export const midiToHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
export const hzToMidi = (hz) => 69 + 12 * Math.log2(hz / 440);
export function noteName(midi) {
  const m = Math.round(midi);
  return NOTE_NAMES[((m % 12) + 12) % 12] + (Math.floor(m / 12) - 1);
}

// Token grammar: letter from SWARA_ORDER, "'" suffix per taar octave, "." prefix (or suffix) per mandra octave.
export function parseSwara(tok) {
  let oct = 0, s = tok.trim();
  while (s.startsWith('.')) { oct--; s = s.slice(1); }
  while (s.endsWith("'")) { oct++; s = s.slice(0, -1); }
  while (s.endsWith('.')) { oct--; s = s.slice(0, -1); }
  if (!SWARA_ORDER.includes(s)) return null;
  return { sw: s, oct };
}
export const tokens = (str) => str.split(/\s+/).filter(Boolean).map(parseSwara).filter(Boolean);

export function swaraLabel(sw, oct = 0) {
  let n = SWARA_NAMES[sw];
  if (oct > 0) n += "'".repeat(oct);
  if (oct < 0) n = '.'.repeat(-oct) + n;
  return n;
}

export function swaraCents(sw, oct, cmap) { return cmap[sw] + oct * 1200; }

// Nearest swara to a cents value (relative to Sa). `allowed` restricts to a raga's swaras.
export function nearestSwara(cents, cmap, allowed = null) {
  const list = allowed && allowed.size ? SWARA_ORDER.filter((s) => allowed.has(s)) : SWARA_ORDER;
  const baseOct = Math.floor(cents / 1200);
  const c = cents - baseOct * 1200;
  let best = null;
  for (const sw of list) {
    let d = c - cmap[sw], oct = baseOct;
    if (d > 600) { d -= 1200; oct += 1; } else if (d < -600) { d += 1200; oct -= 1; }
    if (!best || Math.abs(d) < Math.abs(best.dev)) best = { sw, oct, dev: d };
  }
  best.label = swaraLabel(best.sw, best.oct);
  best.cents = cmap[best.sw] + best.oct * 1200;
  return best;
}

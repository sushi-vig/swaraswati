// Swara math: names, tuning tables, nearest-swara lookup.

export const SWARA_ORDER = ['S', 'r', 'R', 'g', 'G', 'm', 'M', 'P', 'd', 'D', 'n', 'N'];

// Short display names. Lowercase = komal, Ma^ = tivra Ma.
export const SWARA_NAMES = { S: 'Sa', r: 're', R: 'Re', g: 'ga', G: 'Ga', m: 'Ma', M: 'Ma^', P: 'Pa', d: 'dha', D: 'Dha', n: 'ni', N: 'Ni' };
export const SWARA_LONG = { S: 'Sa', r: 'komal Re', R: 'shuddha Re', g: 'komal Ga', G: 'shuddha Ga', m: 'shuddha Ma', M: 'tivra Ma', P: 'Pa', d: 'komal Dha', D: 'shuddha Dha', n: 'komal Ni', N: 'shuddha Ni' };

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

// Raga library: Hindustani and Carnatic lists plus the open "all twelve" scale.
import { tokens } from './music.js';
import { HINDUSTANI_RAGAS } from './ragas-hindustani.js';
import { CARNATIC_RAGAS, MELAKARTA_NAMES, melaName } from './ragas-carnatic.js';

export const CHROMATIC = { id: 'chromatic', name: 'All 12 swaras (no raga)', tradition: 'any', thaat: '—', aroha: "S r R g G m M P d D n N S'", avaroha: "S' N n D d P M m G g R r S", drone: 'P', time: '' };
export const RAGAS = [...HINDUSTANI_RAGAS, ...CARNATIC_RAGAS, CHROMATIC];
export { HINDUSTANI_RAGAS, CARNATIC_RAGAS, MELAKARTA_NAMES, melaName };

// Swaras that appear only on the way up or only on the way down (audav/shadav behaviour).
export function ragaDirectionSets(raga) {
  const up = new Set(tokens(raga.aroha).map((t) => t.sw));
  const down = new Set(tokens(raga.avaroha).map((t) => t.sw));
  return { up, down };
}

export function ragaSwaraSet(raga) {
  const set = new Set();
  for (const t of tokens(raga.aroha)) set.add(t.sw);
  for (const t of tokens(raga.avaroha)) set.add(t.sw);
  return set;
}

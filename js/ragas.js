// Raga library (Hindustani). aroha/avaroha use the token grammar from music.js.
// drone: which tanpura string accompanies Sa ('P' = Pa, 'm' = shuddha Ma).
// vadi/samvadi: the raga's leading and second swaras; pakad: its catch-phrase; guru: how a teacher would describe its pitfalls.
import { tokens } from './music.js';

export const RAGAS = [
  { id: 'yaman', name: 'Yaman', thaat: 'Kalyan', aroha: ".N R G M D N S'", avaroha: "S' N D P M G R S", drone: 'P', time: 'early night',
    vadi: 'G', samvadi: 'N', pakad: "Ni Re Ga · Re Ga · Ni Re Sa",
    guru: "Ma is always tivra in Yaman; a shuddha Ma pulls the raga towards Bilawal. Sa and Pa are passed over lightly on the way up, and the raga likes to rest on Ga and Ni." },
  { id: 'bilawal', name: 'Bilawal', thaat: 'Bilawal', aroha: "S R G m P D N S'", avaroha: "S' N D P m G R S", drone: 'P', time: 'morning',
    vadi: 'D', samvadi: 'G', pakad: "Ga Re Ga Pa · Dha Ni Sa'",
    guru: "Every swara is shuddha, so the danger is sounding like a plain scale. Give Dha its weight and let the Ga-Pa movement sing." },
  { id: 'bhupali', name: 'Bhupali', thaat: 'Kalyan', aroha: "S R G P D S'", avaroha: "S' D P G R S", drone: 'P', time: 'evening',
    vadi: 'G', samvadi: 'D', pakad: "Sa Re Ga · Re Ga Pa · Dha Pa Ga Re Sa",
    guru: "Ma and Ni never appear. A stray Ni on the way down is the usual slip, and a Ma turns it into something else altogether." },
  { id: 'durga', name: 'Durga', thaat: 'Bilawal', aroha: "S R m P D S'", avaroha: "S' D P m R S", drone: 'P', time: 'night',
    vadi: 'm', samvadi: 'S', pakad: "Sa Re Ma Pa Dha · Ma Pa Dha Sa' · Dha Pa Ma Re Sa",
    guru: "Ga and Ni are absent. Ma is the pillar here, approached with a glide from Re." },
  { id: 'hamsadhwani', name: 'Hamsadhwani', thaat: 'Bilawal', aroha: "S R G P N S'", avaroha: "S' N P G R S", drone: 'P', time: 'evening',
    vadi: 'S', samvadi: 'P', pakad: "Ga Pa Ni · Pa Ni Sa' · Ni Pa Ga Re Sa",
    guru: "Ma and Dha are absent. The leaps Pa to Ni and Ni to Sa' have to land cleanly." },
  { id: 'bhairav', name: 'Bhairav', thaat: 'Bhairav', aroha: "S r G m P d N S'", avaroha: "S' N d P m G r S", drone: 'P', time: 'dawn',
    vadi: 'd', samvadi: 'r', pakad: "Sa Ga Ma Pa · dha Pa · Ga Ma re Sa",
    guru: "Komal Re and komal Dha both take a slow andolan, a gentle sway. Do not let them creep up to shuddha, especially coming down from Pa." },
  { id: 'kafi', name: 'Kafi', thaat: 'Kafi', aroha: "S R g m P D n S'", avaroha: "S' n D P m g R S", drone: 'P', time: 'late night',
    vadi: 'P', samvadi: 'S', pakad: "Sa Sa Re Re ga ga Ma Ma Pa · ga Re Sa",
    guru: "Komal Ga and komal Ni, everything else shuddha. Shuddha Ga slips in easily if your ear is used to Bilawal." },
  { id: 'bhimpalasi', name: 'Bhimpalasi', thaat: 'Kafi', aroha: ".n S g m P n S'", avaroha: "S' n D P m g R S", drone: 'P', time: 'afternoon',
    vadi: 'm', samvadi: 'S', pakad: "ni Sa Ma · Ma ga · Pa ga · Ma ga Re Sa",
    guru: "Re and Dha are skipped on the way up and come only while descending. Ma is the resting note; lean on it." },
  { id: 'bageshri', name: 'Bageshri', thaat: 'Kafi', aroha: "S g m D n S'", avaroha: "S' n D m P D g R S", drone: 'P', time: 'late night',
    vadi: 'm', samvadi: 'S', pakad: "Dha ni Sa Ma · ga Ma Dha ni Dha · Ma ga Re Sa",
    guru: "Re and Pa are skipped going up, and Pa is used sparingly even on the way down. Avoid landing on Pa." },
  { id: 'malkauns', name: 'Malkauns', thaat: 'Bhairavi', aroha: "S g m d n S'", avaroha: "S' n d m g S", drone: 'm', time: 'late night',
    vadi: 'm', samvadi: 'S', pakad: "ni Sa Ma ga Ma · dha ni Sa' · ga Ma ga Sa",
    guru: "Re and Pa are absent entirely. Komal Ga, komal Dha, komal Ni, and a heavy Ma. The usual slip is reaching for Pa." },
  { id: 'bhairavi', name: 'Bhairavi', thaat: 'Bhairavi', aroha: "S r g m P d n S'", avaroha: "S' n d P m g r S", drone: 'P', time: 'morning / closing',
    vadi: 'm', samvadi: 'S', pakad: "Sa re ga Ma · ga re Sa · ni dha Pa Ma",
    guru: "All komal swaras with shuddha Ma. Performers touch all twelve notes in Bhairavi, but in riyaz keep to the komal frame." },
  { id: 'khamaj', name: 'Khamaj', thaat: 'Khamaj', aroha: "S G m P D N S'", avaroha: "S' n D P m G R S", drone: 'P', time: 'late evening',
    vadi: 'G', samvadi: 'N', pakad: "Ga Ma Pa Dha ni Dha · Ma Pa Dha Ma Ga",
    guru: "Shuddha Ni going up, komal Ni coming down, and Re is skipped in the ascent." },
  { id: 'des', name: 'Des', thaat: 'Khamaj', aroha: "S R m P N S'", avaroha: "S' n D P m G R S", drone: 'P', time: 'late evening',
    vadi: 'R', samvadi: 'P', pakad: "Re Ma Pa Ni Sa' · ni Dha Pa · Ma Ga Re",
    guru: "Ga is skipped on the way up. Ni is shuddha going up and komal coming down. Re is the resting note." },
  { id: 'asavari', name: 'Asavari', thaat: 'Asavari', aroha: "S R m P d S'", avaroha: "S' n d P m g R S", drone: 'P', time: 'morning',
    vadi: 'd', samvadi: 'g', pakad: "Re Ma Pa · dha Ma Pa · ga Re Sa",
    guru: "Ga and Ni are skipped on the way up. Komal Dha is held with a slight sway." },
  { id: 'jaunpuri', name: 'Jaunpuri', thaat: 'Asavari', aroha: "S R m P d n S'", avaroha: "S' n d P m g R S", drone: 'P', time: 'late morning',
    vadi: 'd', samvadi: 'g', pakad: "Ma Pa ni dha Pa · dha Ma Pa ga Re Sa",
    guru: "Ga is skipped going up. It is very close to Asavari; the difference is the stronger Ni and the Ma Pa ni dha movement." },
  { id: 'darbari', name: 'Darbari Kanada', thaat: 'Asavari', aroha: "S R g m P d n S'", avaroha: "S' d n P m P g m R S", drone: 'P', time: 'late night',
    vadi: 'R', samvadi: 'P', pakad: "ni Sa Re Re Sa · dha ni Pa · Ma Pa ga ga Ma Re Sa",
    guru: "Komal Ga and komal Dha sit low and slow, with andolan. Coming down, Ni dha Pa comes in a zigzag. This raga cannot be rushed." },
  { id: 'bihag', name: 'Bihag', thaat: 'Bilawal', aroha: ".N S G m P N S'", avaroha: "S' N D P M P G m G R S", drone: 'P', time: 'night',
    vadi: 'G', samvadi: 'N', pakad: "Ni Sa Ga Ma Pa · Ma Ga · Pa Ma^ Pa Ga Ma Ga",
    guru: "Re and Dha are skipped going up. Tivra Ma is only a brief touch between two Pa's on the way down; the main Ma is shuddha." },
  { id: 'kedar', name: 'Kedar', thaat: 'Kalyan', aroha: "S m P D N S'", avaroha: "S' N D P M P D P m R S", drone: 'P', time: 'night',
    vadi: 'm', samvadi: 'S', pakad: "Sa Ma · Ma Pa · Dha Pa Ma · Ma^ Pa Dha Pa Ma · Sa Re Sa",
    guru: "Ma is the heart of Kedar, reached by a leap from Sa. Ga is almost absent, and tivra Ma is a fleeting touch beside Pa." },
  { id: 'marwa', name: 'Marwa', thaat: 'Marwa', aroha: ".N r G M D N S'", avaroha: "S' N D M G r S", drone: 'P', time: 'sunset',
    vadi: 'r', samvadi: 'D', pakad: "Dha Ma^ Ga re · Ga re Sa · Ni Dha Sa",
    guru: "Pa is completely absent, and Sa is touched only lightly. The raga hangs on komal Re and Dha, which is what makes it feel unresolved." },
  { id: 'puriya_dhanashree', name: 'Puriya Dhanashree', thaat: 'Purvi', aroha: "S r G M P d N S'", avaroha: "S' N d P M G r S", drone: 'P', time: 'sunset',
    vadi: 'P', samvadi: 'r', pakad: "Ni re Ga · Ma^ Pa · dha Pa · Ma^ Ga re Sa",
    guru: "Komal Re, komal Dha and tivra Ma. Pa is the resting note, and the dha-Pa movement is the signature." },
  { id: 'todi', name: 'Miyan ki Todi', thaat: 'Todi', aroha: "S r g M P d N S'", avaroha: "S' N d P M g r S", drone: 'P', time: 'late morning',
    vadi: 'd', samvadi: 'g', pakad: "dha Ni Sa re ga · re ga · re Sa",
    guru: "Komal Re, komal Ga, tivra Ma and komal Dha. Ga and Dha sit very low and sway; Pa is used sparingly." },
  { id: 'chromatic', name: 'All 12 swaras (no raga)', thaat: '—', aroha: "S r R g G m M P d D n N S'", avaroha: "S' N n D d P M m G g R r S", drone: 'P', time: '' },
];

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

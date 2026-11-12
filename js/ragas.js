// Raga library (Hindustani). aroha/avaroha use the token grammar from music.js.
// drone: which tanpura string accompanies Sa ('P' = Pa, 'm' = shuddha Ma).
import { tokens } from './music.js';

export const RAGAS = [
  { id: 'yaman', name: 'Yaman', thaat: 'Kalyan', aroha: ".N R G M D N S'", avaroha: "S' N D P M G R S", drone: 'P', time: 'early night' },
  { id: 'bilawal', name: 'Bilawal', thaat: 'Bilawal', aroha: "S R G m P D N S'", avaroha: "S' N D P m G R S", drone: 'P', time: 'morning' },
  { id: 'bhupali', name: 'Bhupali', thaat: 'Kalyan', aroha: "S R G P D S'", avaroha: "S' D P G R S", drone: 'P', time: 'evening' },
  { id: 'durga', name: 'Durga', thaat: 'Bilawal', aroha: "S R m P D S'", avaroha: "S' D P m R S", drone: 'P', time: 'night' },
  { id: 'hamsadhwani', name: 'Hamsadhwani', thaat: 'Bilawal', aroha: "S R G P N S'", avaroha: "S' N P G R S", drone: 'P', time: 'evening' },
  { id: 'bhairav', name: 'Bhairav', thaat: 'Bhairav', aroha: "S r G m P d N S'", avaroha: "S' N d P m G r S", drone: 'P', time: 'dawn' },
  { id: 'kafi', name: 'Kafi', thaat: 'Kafi', aroha: "S R g m P D n S'", avaroha: "S' n D P m g R S", drone: 'P', time: 'late night' },
  { id: 'bhimpalasi', name: 'Bhimpalasi', thaat: 'Kafi', aroha: ".n S g m P n S'", avaroha: "S' n D P m g R S", drone: 'P', time: 'afternoon' },
  { id: 'bageshri', name: 'Bageshri', thaat: 'Kafi', aroha: "S g m D n S'", avaroha: "S' n D m P D g R S", drone: 'P', time: 'late night' },
  { id: 'malkauns', name: 'Malkauns', thaat: 'Bhairavi', aroha: "S g m d n S'", avaroha: "S' n d m g S", drone: 'm', time: 'late night' },
  { id: 'bhairavi', name: 'Bhairavi', thaat: 'Bhairavi', aroha: "S r g m P d n S'", avaroha: "S' n d P m g r S", drone: 'P', time: 'morning / closing' },
  { id: 'khamaj', name: 'Khamaj', thaat: 'Khamaj', aroha: "S G m P D N S'", avaroha: "S' n D P m G R S", drone: 'P', time: 'late evening' },
  { id: 'des', name: 'Des', thaat: 'Khamaj', aroha: "S R m P N S'", avaroha: "S' n D P m G R S", drone: 'P', time: 'late evening' },
  { id: 'asavari', name: 'Asavari', thaat: 'Asavari', aroha: "S R m P d S'", avaroha: "S' n d P m g R S", drone: 'P', time: 'morning' },
  { id: 'jaunpuri', name: 'Jaunpuri', thaat: 'Asavari', aroha: "S R m P d n S'", avaroha: "S' n d P m g R S", drone: 'P', time: 'late morning' },
  { id: 'darbari', name: 'Darbari Kanada', thaat: 'Asavari', aroha: "S R g m P d n S'", avaroha: "S' d n P m P g m R S", drone: 'P', time: 'late night' },
  { id: 'bihag', name: 'Bihag', thaat: 'Bilawal', aroha: ".N S G m P N S'", avaroha: "S' N D P M P G m G R S", drone: 'P', time: 'night' },
  { id: 'kedar', name: 'Kedar', thaat: 'Kalyan', aroha: "S m P D N S'", avaroha: "S' N D P M P D P m R S", drone: 'P', time: 'night' },
  { id: 'marwa', name: 'Marwa', thaat: 'Marwa', aroha: ".N r G M D N S'", avaroha: "S' N D M G r S", drone: 'P', time: 'sunset' },
  { id: 'puriya_dhanashree', name: 'Puriya Dhanashree', thaat: 'Purvi', aroha: "S r G M P d N S'", avaroha: "S' N d P M G r S", drone: 'P', time: 'sunset' },
  { id: 'todi', name: 'Miyan ki Todi', thaat: 'Todi', aroha: "S r g M P d N S'", avaroha: "S' N d P M g r S", drone: 'P', time: 'late morning' },
  { id: 'chromatic', name: 'All 12 swaras (no raga)', thaat: '—', aroha: "S r R g G m M P d D n N S'", avaroha: "S' N n D d P M m G g R r S", drone: 'P', time: '' },
];

export function ragaSwaraSet(raga) {
  const set = new Set();
  for (const t of tokens(raga.aroha)) set.add(t.sw);
  for (const t of tokens(raga.avaroha)) set.add(t.sw);
  return set;
}

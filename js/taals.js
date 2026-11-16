// Taal library. Each taal has a fixed matra count, vibhag structure and marks (X = sam, 0 = khali, digits = tali),
// and one or more thekas (bol variations). A theka is one string per matra; several bols inside a matra are
// separated by spaces and share the matra equally ("- Dhin" = rest then Dhin on the off-beat; "Dha Ge" = two bols).
const T = (id, name, matras, vibhags, marks, thekas, note = '') => ({ id, name, matras, vibhags, marks, note, thekas: thekas.map(([n, s]) => ({ name: n, bols: split(s, matras) })) });
function split(s, matras) {
  const out = s.split('|').flatMap((v) => v.trim().split(/\s*,\s*/)).map((m) => m.trim()).filter(Boolean);
  if (out.length !== matras) throw new Error(`theka has ${out.length} matras, expected ${matras}: ${s}`);
  return out;
}

export const TAALS = [
  // ---- the staples ----
  T('teentaal', 'Teentaal (16)', 16, [4, 4, 4, 4], ['X', '2', '0', '3'], [
    ['Theka', 'Dha, Dhin, Dhin, Dha | Dha, Dhin, Dhin, Dha | Dha, Tin, Tin, Ta | Ta, Dhin, Dhin, Dha'],
    ['Madhya laya (Na in khali)', 'Dha, Dhin, Dhin, Dha | Dha, Dhin, Dhin, Dha | Na, Tin, Tin, Na | Ta, Dhin, Dhin, Dha'],
    ['Filled (tirkit before sam)', 'Dha, Dhin, Dhin, Dha | Dha, Dhin, Dhin, Dha | Dha, Tin, Tin, Ta | Tirkit, Dhin, Dhin, Dha'],
    ['Vilambit (bharav)', 'Dha, Dhin, Dhin, Dha | Dha, Dhin, Dhin, Dha | Dha Tirkit, Tin, Tin, Ta Tirkit | Ta, Dhin, Dhin, Dha Tirkit'],
    ['Drut (crisp)', 'Dha, Dhin, Dhin, Dha | Dha, Dhin, Dhin, Dha | Na, Tin, Tin, Na | Ta Ta, Dhin, Dhin, Dha'],
  ], 'The universal taal of khayal, instrumental music and most light forms.'),
  T('keherwa', 'Keherwa (8)', 8, [4, 4], ['X', '0'], [
    ['Theka', 'Dha, Ge, Na, Ti | Na, Ka, Dhi, Na'],
    ['Bright', 'Dha, Ge, Na, Tin | Na, Ka, Dhin, Na'],
    ['Filled', 'Dha, Ge, Na, Ti | Na, Ka, Dhi, Na Tirkit'],
    ['Dholak style', 'Dha Ge, Na, Ti Na, Ka | Dha Ge, Na, Ti Na, Ka'],
    ['Off-beat', 'Dha, - Ge, Na, Ti | Na, - Ka, Dhi, Na'],
  ], 'Bhajan, ghazal, folk and film songs. The khali on 5 is light rather than silent.'),
  T('bhajani', 'Bhajani theka (8)', 8, [4, 4], ['X', '0'], [
    ['Theka', 'Dhin, - Na, Dhin, Dhin Na | Tin, - Na, Dhin, Dhin Na'],
    ['Open', 'Dhin, - Na, Dhin Dhin, Na | Tin, - Na, Dhin Dhin, Na'],
  ], 'The lilting eight-beat of bhajans and kirtan.'),
  T('dadra', 'Dadra (6)', 6, [3, 3], ['X', '0'], [
    ['Theka', 'Dha, Dhi, Na | Dha, Tu, Na'],
    ['Dhin-Tin', 'Dha, Dhin, Na | Ta, Tin, Na'],
    ['Filled', 'Dha, Dhi, Na | Dha, Tu, Na Tirkit'],
    ['Off-beat', 'Dha, Dhi Na, - Na | Dha, Tu Na, - Na'],
  ], 'Thumri, dadra, bhajans: six beats in two halves.'),
  T('khemta', 'Khemta (6)', 6, [3, 3], ['X', '0'], [
    ['Theka', 'Dha, Ti, Na | Ta, Dhi, Na'],
    ['Rolling', 'Dha Ti, Na, - Ti | Ta Dhi, Na, - Dhi'],
  ], 'A swinging cousin of dadra used in light classical and folk.'),
  T('rupak', 'Rupak (7)', 7, [3, 2, 2], ['0', '2', '3'], [
    ['Theka', 'Tin, Tin, Na | Dhin, Na | Dhin, Na'],
    ['Soft (Ti-Ti)', 'Ti, Ti, Na | Dhi, Na | Dhi, Na'],
    ['Filled', 'Tin, Tin, Na | Dhin, Na | Dhin, Na Tirkit'],
  ], 'The only common taal whose sam is a khali: the first beat is empty-handed.'),
  T('tevra', 'Tevra / Teevra (7)', 7, [3, 2, 2], ['X', '2', '3'], [
    ['Theka', 'Dha, Din, Ta | Tite, Kata | Gadi, Gana'],
  ], 'A pakhawaj taal for dhrupad and dhamar; also used for some bhajans.'),
  T('pashto', 'Pashto (7)', 7, [3, 2, 2], ['X', '2', '3'], [
    ['Theka', 'Tin, - Tin, Na | Dhin, Na | Dhin, Na'],
  ], 'Seven beats with a sam on Tin; heard in Punjabi and north-western light music.'),
  T('jhaptaal', 'Jhaptaal (10)', 10, [2, 3, 2, 3], ['X', '2', '0', '3'], [
    ['Theka', 'Dhi, Na | Dhi, Dhi, Na | Ti, Na | Dhi, Dhi, Na'],
    ['Filled', 'Dhi, Na | Dhi, Dhi, Na | Ti, Na | Dhi, Dhi, Na Tirkit'],
    ['Vilambit', 'Dhi, Na Tirkit | Dhi, Dhi, Na | Ti, Na Tirkit | Dhi, Dhi, Na'],
  ], 'Ten beats in 2+3+2+3, favoured for madhya laya khayal.'),
  T('sooltaal', 'Sooltaal (10)', 10, [2, 2, 2, 2, 2], ['X', '0', '2', '3', '0'], [
    ['Theka', 'Dha, Dha | Din, Ta | Kit, Dha | Tite, Kata | Gadi, Gana'],
  ], 'Ten beats on the pakhawaj, for dhrupad and dhamar.'),
  T('ektaal', 'Ektaal (12)', 12, [2, 2, 2, 2, 2, 2], ['X', '0', '2', '0', '3', '4'], [
    ['Theka', 'Dhin, Dhin | Dhage, Tirkit | Tu, Na | Kat, Ta | Dhage, Tirkit | Dhin, Na'],
    ['Vilambit (filled)', 'Dhin, - Dhin | Dhage, Tirkit | Tu, Na Tirkit | Kat, Ta Tirkit | Dhage, Tirkit | Dhin, Na Tirkit'],
    ['Drut (plain)', 'Dhin, Dhin | Dha Ge, Tirkit | Tu, Na | Kat, Ta | Dha Ge, Tirkit | Dhin, Na'],
  ], 'Twelve beats in six vibhags: the taal of vilambit khayal (bada khayal) and tarana.'),
  T('chautaal', 'Chautaal (12)', 12, [2, 2, 2, 2, 2, 2], ['X', '0', '2', '0', '3', '4'], [
    ['Theka', 'Dha, Dha | Din, Ta | Kit, Dha | Din, Ta | Tite, Kata | Gadi, Gana'],
  ], 'The dhrupad taal on the pakhawaj; the same structure as Ektaal with open bols.'),
  T('adachautaal', 'Ada Chautaal (14)', 14, [2, 2, 2, 2, 2, 2, 2], ['X', '2', '0', '3', '0', '4', '0'], [
    ['Theka', 'Dhin, Tirkit | Dhin, Na | Tu, Na | Kat, Ta | Tirkit, Dhin | Na, Dhin | Dhin, Na'],
  ], 'Fourteen beats in seven pairs, used for madhya laya khayal.'),
  T('deepchandi', 'Deepchandi (14)', 14, [3, 4, 3, 4], ['X', '2', '0', '3'], [
    ['Theka', 'Dha, Dhin, - | Dha, Dha, Tin, - | Ta, Tin, - | Dha, Dha, Dhin, -'],
    ['Chachar', 'Dha, Dha, Dhin | - Dha, Dha, Tin, - | Ta, Ta, Tin | - Dha, Dha, Dhin, -'],
    ['Filled', 'Dha, Dhin, - Dha | Dha, Dha, Tin, - Ta | Ta, Tin, - Ta | Dha, Dha, Dhin, - Dha'],
  ], 'Thumri and dadra in a slow 3+4+3+4; Chachar is its folk-flavoured sibling.'),
  T('jhoomra', 'Jhoomra (14)', 14, [3, 4, 3, 4], ['X', '2', '0', '3'], [
    ['Theka', 'Dhin, - Dha, Tirkit | Dhin, Dhin, Dhage, Tirkit | Tin, - Ta, Tirkit | Dhin, Dhin, Dhage, Tirkit'],
  ], 'A heavy, ornamented vilambit taal for bada khayal.'),
  T('dhamar', 'Dhamar (14)', 14, [5, 2, 3, 4], ['X', '2', '0', '3'], [
    ['Theka', 'Ka, Dhi, Ta, Dhi, Ta | Dha, - | Ga, Ti, Ta | Ti, Ta, Ta, -'],
  ], 'The taal of the hori-dhamar repertoire, 5+2+3+4.'),
  T('tilwada', 'Tilwada (16)', 16, [4, 4, 4, 4], ['X', '2', '0', '3'], [
    ['Theka', 'Dha, Tirkit, Dhin, Dhin | Dha, Dha, Tin, Tin | Ta, Tirkit, Dhin, Dhin | Dha, Dha, Dhin, Dhin'],
  ], 'Sixteen beats like Teentaal, but a vilambit theka with its own weight.'),
  T('addha', 'Addha / Sitarkhani / Punjabi (16)', 16, [4, 4, 4, 4], ['X', '2', '0', '3'], [
    ['Theka', 'Dha, - Dhin, - Dha, Dha | Dha, - Dhin, - Dha, Dha | Dha, - Tin, - Ta, Ta | Ta, - Dhin, - Dha, Dha'],
    ['Punjabi', 'Dha, - Dhin, - Dha, Dha | Dha, - Dhin, - Dha, Dha | Dha, - Tin, - Ta, Ta | Ta, - Dhin, - Dha, Dha Dhin'],
  ], 'Teentaal with a swing: the bols sit on the off-beats. Thumri, ghazal, instrumental gats.'),
  T('jat', 'Jat (16)', 16, [4, 4, 4, 4], ['X', '2', '0', '3'], [
    ['Theka', 'Dha, - Dhin, -, Dha | Dha, Dhin, -, Dha | Dha, - Tin, -, Ta | Ta, Dhin, -, Dha'],
  ], 'A sparse sixteen for slow thumri and folk.'),
  T('dhumali', 'Dhumali (8)', 8, [4, 4], ['X', '0'], [
    ['Theka', 'Dhin, Dhin, Dha, Tirkit | Tu, Na, Kat, Ta'],
  ], 'A brisk eight used for light pieces and some bhajans.'),
  T('ganesh', 'Ganesh taal (21)', 21, [5, 5, 5, 6], ['X', '2', '0', '3'], [
    ['Theka', 'Dha, Dhin, Dhin, Dha, Ge | Dha, Dhin, Dhin, Dha, Ge | Dha, Tin, Tin, Ta, Ke | Ta, Dhin, Dhin, Dha, Ge, Na'],
  ], 'A rare 21-beat cycle; included for layakari practice.'),
  T('matta', 'Matta taal (9)', 9, [2, 2, 2, 3], ['X', '2', '0', '3'], [
    ['Theka', 'Dhin, Tirkit | Dhin, Na | Tu, Na | Kat, Ta, Tirkit'],
  ], 'Nine beats, uncommon; good for odd-cycle practice.'),
];

// ---- Carnatic talas ----
// Angas: I = laghu (a clap then jati-1 finger counts), O = dhrutam (clap, wave), U = anudhrutam (clap).
// The 35-tala scheme is seven tala shapes in five jatis; the chapu talas sit outside it.
const JATI = { tisra: 3, chatusra: 4, khanda: 5, misra: 7, sankeerna: 9 };
const SUB = { 3: '₃', 4: '₄', 5: '₅', 7: '₇', 9: '₉' };
const SHAPES = { dhruva: 'IOII', matya: 'IOI', rupaka: 'OI', jhampa: 'IUO', triputa: 'IOO', ata: 'IIOO', eka: 'I' };
const cap = (w) => w[0].toUpperCase() + w.slice(1);
function angaLayout(shape, jati) {
  const vibhags = [], marks = [], kriya = [];
  for (const a of shape) {
    if (a === 'I') { vibhags.push(jati); marks.push('I' + SUB[jati]); kriya.push('clap'); for (let k = 2; k <= jati; k++) kriya.push(String(k)); }
    else if (a === 'O') { vibhags.push(2); marks.push('O'); kriya.push('clap', 'wave'); }
    else { vibhags.push(1); marks.push('U'); kriya.push('clap'); }
  }
  return { vibhags, marks, kriya };
}
// Sollukattu (mridangam syllables) built from the kriya: claps strong, counts soft, waves open.
function sollukattu(kriya, extra = []) {
  const n = kriya.length;
  const plain = kriya.map((k, i) => (i === 0 ? 'tham' : k === 'clap' ? 'tha' : k === 'wave' ? 'dhi' : (Number(k) % 2 ? 'ta' : 'ki')));
  const chat = kriya.map((k, i) => (i === 0 ? 'tham ka dhi mi' : i % 2 ? 'tha ka jo nu' : 'tha ka dhi mi'));
  const tisra = kriya.map((k, i) => (i === 0 ? 'tham ki ta' : k === 'clap' ? 'tha ki ta' : 'dhi ki ta'));
  return [['Kriya (one stroke per akshara)', plain], ['Sarva laghu, chatusra nadai', chat], ['Sarva laghu, tisra nadai', tisra], ...extra].map(([name, bols]) => ({ name, bols: bols.length === n ? bols : bols.slice(0, n) }));
}
const C = (id, name, shape, jati, note = '', extra = []) => {
  const lay = angaLayout(shape, jati);
  return { id, name, tradition: 'carnatic', matras: lay.kriya.length, vibhags: lay.vibhags, marks: lay.marks, kriya: lay.kriya, note, thekas: sollukattu(lay.kriya, extra) };
};
const COMMON = [
  C('adi', 'Adi (8)', 'IOO', 4, 'Chatusra-jati Triputa: laghu 4, dhrutam, dhrutam. The tala of most kritis and all beginners\' exercises.',
    [['Standard', ['tham', 'ki ta', 'tha ka', 'dhi mi', 'tha', 'ka', 'dhi', 'mi']]]),
  C('rupaka', 'Rupaka (6)', 'OI', 4, 'Chatusra-jati Rupaka: dhrutam then laghu 4. Often counted as three beats of two.'),
  C('tisra_eka', 'Tisra Eka (3)', 'I', 3, 'A single laghu of three: clap, two counts.'),
  C('chatusra_eka', 'Chatusra Eka (4)', 'I', 4, 'A single laghu of four.'),
  C('khanda_eka', 'Khanda Eka (5)', 'I', 5, 'A single laghu of five.'),
  C('jhampa', 'Misra Jhampa (10)', 'IUO', 7, 'Laghu 7, anudhrutam, dhrutam: 7 + 1 + 2.'),
  C('ata', 'Khanda Ata (14)', 'IIOO', 5, 'Two laghus of five then two dhrutams: 5 + 5 + 2 + 2. The tala of many varnams.'),
  C('matya', 'Chatusra Matya (10)', 'IOI', 4, 'Laghu, dhrutam, laghu: 4 + 2 + 4.'),
  C('dhruva', 'Chatusra Dhruva (14)', 'IOII', 4, 'Laghu, dhrutam, laghu, laghu: 4 + 2 + 4 + 4.'),
  C('tisra_triputa', 'Tisra Triputa (7)', 'IOO', 3, 'Laghu 3, dhrutam, dhrutam: 3 + 2 + 2.'),
];
const CHAPU = [
  { id: 'misra_chapu', name: 'Misra Chapu (7)', tradition: 'carnatic', matras: 7, vibhags: [3, 2, 2], marks: ['X', '2', '3'], kriya: ['clap', '2', '3', 'clap', '2', 'clap', '2'],
    note: 'Seven in 3 + 2 + 2, claps on 1, 4 and 6. Outside the 35-tala scheme; the tala of many padams and bhajans.',
    thekas: [{ name: 'Ta ki ta · ta ka · dhi mi', bols: ['tham', 'ki', 'ta', 'tha', 'ka', 'dhi', 'mi'] }, { name: 'Filled', bols: ['tham ka', 'dhi mi', 'tha ka', 'jo nu', 'tha ka', 'dhi mi', 'tha ka'] }] },
  { id: 'khanda_chapu', name: 'Khanda Chapu (5)', tradition: 'carnatic', matras: 5, vibhags: [2, 3], marks: ['X', '2'], kriya: ['clap', '2', 'clap', '2', '3'],
    note: 'Five in 2 + 3, claps on 1 and 3. Outside the 35-tala scheme.',
    thekas: [{ name: 'Ta ka · ta ki ta', bols: ['tham', 'ka', 'tha', 'ki', 'ta'] }, { name: 'Filled', bols: ['tham ka', 'dhi mi', 'tha ka', 'jo nu', 'tha ka'] }] },
  { id: 'adi2', name: 'Adi, 2 kalai (16)', tradition: 'carnatic', matras: 16, vibhags: [8, 4, 4], marks: ['I₄', 'O', 'O'],
    kriya: ['clap', '', '2', '', '3', '', '4', '', 'clap', '', 'wave', '', 'clap', '', 'wave', ''],
    note: 'Adi with every kriya lasting two aksharas, for slow kritis.',
    thekas: [{ name: 'Kriya', bols: ['tham', 'ka', 'ta', 'ka', 'ki', 'ta', 'ta', 'ka', 'tha', 'ka', 'dhi', 'mi', 'tha', 'ka', 'dhi', 'mi'] },
      { name: 'Sarva laghu', bols: ['tham ka dhi mi', 'tha ka jo nu', 'tha ka dhi mi', 'tha ka jo nu', 'tha ka dhi mi', 'tha ka jo nu', 'tha ka dhi mi', 'tha ka jo nu', 'tha ka dhi mi', 'tha ka jo nu', 'tha ka dhi mi', 'tha ka jo nu', 'tha ka dhi mi', 'tha ka jo nu', 'tha ka dhi mi', 'tha ka jo nu'] }] },
];
// The rest of the 35-tala scheme.
const have = new Set(COMMON.map((t) => `${t.vibhags.join('.')}:${t.marks.join('.')}`));
const SCHEME = [];
for (const [shape, letters] of Object.entries(SHAPES)) for (const [jati, n] of Object.entries(JATI)) {
  const lay = angaLayout(letters, n), key = `${lay.vibhags.join('.')}:${lay.marks.join('.')}`;
  if (have.has(key)) continue;
  SCHEME.push(C(`${jati}_${shape}`, `${cap(jati)} ${cap(shape)} (${lay.kriya.length})`, letters, n, `${cap(jati)}-jati ${cap(shape)}: ${lay.vibhags.join(' + ')}.`));
}
export const CARNATIC_TAALS = [...COMMON, ...CHAPU];
export const SCHEME_TAALS = SCHEME;
for (const t of TAALS) t.tradition = 'hindustani';
TAALS.push(...CARNATIC_TAALS, ...SCHEME_TAALS);

export const thekaOf = (taal, idx = 0) => taal.thekas[Math.min(Math.max(0, idx | 0), taal.thekas.length - 1)];

// Returns, per matra, the index of its vibhag and whether it starts one.
export function matraMeta(taal) {
  const out = [];
  let v = 0, inV = 0;
  for (let i = 0; i < taal.matras; i++) {
    out.push({ vibhag: v, startsVibhag: inV === 0, mark: inV === 0 ? taal.marks[v] : '', kriya: taal.kriya ? taal.kriya[i] || '' : '' });
    inV++;
    if (inV >= taal.vibhags[v]) { v++; inV = 0; }
  }
  return out;
}

// Display form of a matra's bols: "- Dhin" → "‑Dhin", "Dha Ge" → "DhaGe".
export const bolLabel = (m) => m.split(/\s+/).map((b) => (b === '-' ? '‑' : b)).join('');

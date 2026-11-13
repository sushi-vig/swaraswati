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

export const thekaOf = (taal, idx = 0) => taal.thekas[Math.min(Math.max(0, idx | 0), taal.thekas.length - 1)];

// Returns, per matra, the index of its vibhag and whether it starts one.
export function matraMeta(taal) {
  const out = [];
  let v = 0, inV = 0;
  for (let i = 0; i < taal.matras; i++) {
    out.push({ vibhag: v, startsVibhag: inV === 0, mark: inV === 0 ? taal.marks[v] : '' });
    inV++;
    if (inV >= taal.vibhags[v]) { v++; inV = 0; }
  }
  return out;
}

// Display form of a matra's bols: "- Dhin" → "‑Dhin", "Dha Ge" → "DhaGe".
export const bolLabel = (m) => m.split(/\s+/).map((b) => (b === '-' ? '‑' : b)).join('');

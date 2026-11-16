// Carnatic raga library: all 72 melakartas generated from the scheme, plus the commonly taught janya ragas.
// Tokens: S r R g G m M P d D n N where r R g G stand for the four Ri/Ga pitches (Ri1, Ri2=Ga1, Ri3=Ga2, Ga3),
// m M for Ma1/Ma2 and d D n N for Da1, Da2=Ni1, Da3=Ni2, Ni3. The display names are resolved per raga by
// carnaticNames() in music.js, so the same pitch shows as Ri3 in Nata and Ga2 in Kharaharapriya.

export const MELAKARTA_NAMES = [
  'Kanakangi', 'Ratnangi', 'Ganamurti', 'Vanaspati', 'Manavati', 'Tanarupi',
  'Senavati', 'Hanumatodi', 'Dhenuka', 'Natakapriya', 'Kokilapriya', 'Rupavati',
  'Gayakapriya', 'Vakulabharanam', 'Mayamalavagowla', 'Chakravakam', 'Suryakantam', 'Hatakambari',
  'Jhankaradhwani', 'Natabhairavi', 'Keeravani', 'Kharaharapriya', 'Gourimanohari', 'Varunapriya',
  'Mararanjani', 'Charukesi', 'Sarasangi', 'Harikambhoji', 'Dheerasankarabharanam', 'Naganandini',
  'Yagapriya', 'Ragavardhini', 'Gangeyabhushani', 'Vagadheeswari', 'Shulini', 'Chalanata',
  'Salagam', 'Jalarnavam', 'Jhalavarali', 'Navaneetam', 'Pavani', 'Raghupriya',
  'Gavambhodi', 'Bhavapriya', 'Shubhapantuvarali', 'Shadvidamargini', 'Suvarnangi', 'Divyamani',
  'Dhavalambari', 'Namanarayani', 'Kamavardhini', 'Ramapriya', 'Gamanashrama', 'Vishwambari',
  'Shamalangi', 'Shanmukhapriya', 'Simhendramadhyamam', 'Hemavati', 'Dharmavati', 'Neetimati',
  'Kantamani', 'Rishabhapriya', 'Latangi', 'Vachaspati', 'Mechakalyani', 'Chitrambari',
  'Sucharitra', 'Jyotiswarupini', 'Dhatuvardhini', 'Nasikabhushani', 'Kosalam', 'Rasikapriya',
];
const CHAKRAS = ['Indu', 'Netra', 'Agni', 'Veda', 'Bana', 'Rutu', 'Rishi', 'Vasu', 'Brahma', 'Disi', 'Rudra', 'Aditya'];
const ALIASES = { 8: 'Todi', 15: 'Mayamalavagowla', 29: 'Sankarabharanam', 51: 'Pantuvarali', 65: 'Kalyani', 28: 'Harikambhoji', 22: 'Kharaharapriya', 56: 'Shanmukhapriya', 20: 'Natabhairavi' };
const RIGA = [['r', 'R'], ['r', 'g'], ['r', 'G'], ['R', 'g'], ['R', 'G'], ['g', 'G']];
const DANI = [['d', 'D'], ['d', 'n'], ['d', 'N'], ['D', 'n'], ['D', 'N'], ['n', 'N']];

// Hand-written teacher notes for the melakartas people actually sing.
const MELA_GURU = {
  8: "Hanumatodi, the Carnatic Todi: Ri1, Ga2, Da1, Ni2 with suddha Ma. The Ga and Ni live in their oscillations; a flat, held Ga2 sounds like a different raga.",
  15: "Mayamalavagowla is the first scale every student learns, so the danger is singing it as an exercise. Ri1 and Da1 sit close to Sa and Pa and take a gentle kampita; Ga3 and Ni3 are bright and steady.",
  20: "Natabhairavi: the natural minor. Keep Da1 low and let Ni2 lead cleanly to Sa; its janyas Hindolam, Bhairavi and Jonpuri all borrow this frame.",
  21: "Keeravani is Natabhairavi with Ni3, the harmonic minor. The Da1-to-Ni3 step is wide; sing it as a reach, not a slide.",
  22: "Kharaharapriya: Ri2, Ga2, Da2, Ni2. The Ga2 and Ni2 are gamaka swaras, sung with a sway from the note above. Hold Ri2 and Da2 steady as the anchors.",
  26: "Charukesi: bright lower half, Da1 and Ni2 above. The Pa-to-Da1 fall is the colour of the raga; do not let Da1 drift up.",
  28: "Harikambhoji: Ni2 is the only non-major swara. Mohanam, Kambhoji and Kedaragowla grow from it; in the full scale, let Ni2 sway and resolve to Da2 or Sa.",
  29: "Sankarabharanam, the major scale. Its life is in the gamakas on Ri2, Ga3 and Ni3, not in the plain scale; sing Ga3 with its sway from Ma1.",
  36: "Chalanata: Ri3 and Da3 are the highest Ri and Da, sitting right under Ga3 and Ni3. Keep them distinct from the Ga and Ni above them.",
  39: "Jhalavarali, the home of Varali: Ri1, Ga1 (the same pitch as Ri2), prati Ma. Ga1 must be sung as a Ga, sliding from Ma2, or it will sound like a Ri.",
  45: "Shubhapantuvarali: Ri1, Ga2, Ma2, Da1, Ni3. Heavy and slow; every swara except Sa, Pa and Ni3 is oscillated.",
  51: "Kamavardhini, sung as Pantuvarali: Ri1, Ga3, Ma2, Da1, Ni3. The Ma2 leans on Pa; the Da1 leans on Pa from above. Keep Ga3 steady between the two sways.",
  53: "Gamanashrama: Ri1 with Ga3 and Ma2, like Pantuvarali, but Da2. Purvikalyani and Hamsanandi come from here; the Da2 is what separates it from Pantuvarali.",
  56: "Shanmukhapriya: Ri2, Ga2, Ma2, Da1, Ni2. The Ma2 and Da1 give it its tension. Ga2 and Ni2 take a sway, Ma2 is held.",
  57: "Simhendramadhyamam: Keeravani with prati Ma. Da1 to Ni3 is a wide step here too, and Ma2 sits close to Pa; keep the two from merging.",
  59: "Dharmavati: Ri2, Ga2, Ma2, Da2, Ni3. Madhuvanti and Ranjani derive from it; the Ga2 against Ma2 is the signature interval.",
  64: "Vachaspati: Kalyani with Ni2. The Ni2 must drop clearly from Sa; otherwise the raga collapses into Kalyani.",
  65: "Mechakalyani, sung as Kalyani: Ma2 is the only difference from Sankarabharanam and it must be unmistakable, leaning on Pa. Ri2 and Da2 are sung with a sway from the note above.",
  66: "Chitrambari: Kalyani with Da3, which sits right under Ni3. Amritavarshini takes only its Ga, Ma2 and Ni.",
};

const melaTokens = (n) => {
  const i = n - 1, [ri, ga] = RIGA[Math.floor((i % 36) / 6)], [da, ni] = DANI[i % 6], ma = n <= 36 ? 'm' : 'M';
  return { up: `S ${ri} ${ga} ${ma} P ${da} ${ni} S'`, down: `S' ${ni} ${da} P ${ma} ${ga} ${ri} S`, ri, ga, ma, da, ni };
};

export const MELAKARTAS = MELAKARTA_NAMES.map((name, i) => {
  const n = i + 1, t = melaTokens(n), alias = ALIASES[n] && ALIASES[n] !== name ? ALIASES[n] : null;
  return {
    id: `mela${n}`, name: alias ? `${name} (${alias})` : name, tradition: 'carnatic', mela: n, chakra: CHAKRAS[Math.floor(i / 6)],
    aroha: t.up, avaroha: t.down, drone: 'P', time: '',
    guru: MELA_GURU[n] || null,
  };
});

// Janya ragas: [id, name, parent mela, arohana, avarohana, {pakad, guru, drone, note}]
const J = (id, name, mela, aroha, avaroha, extra = {}) => ({ id, name, tradition: 'carnatic', mela, aroha, avaroha, drone: 'P', time: '', ...extra });
export const JANYAS = [
  // Mela 2
  J('revati', 'Revati', 2, "S r m P n S'", "S' n P m r S", { pakad: 'Sa Ri1 Ma Pa Ni2 Sa · Ni2 Pa Ma Ri1 Sa', guru: 'Only five notes and no Ga or Da. Ri1 and Ni2 are oscillated from above; Ma and Pa are the anchors.' }),
  // Mela 8 Todi
  J('dhanyasi', 'Dhanyasi', 8, "S g m P n S'", "S' n d P m g r S", { pakad: 'Sa Ga2 Ma Pa Ni2 Sa · Ni2 Da1 Pa Ma Ga2 Ri1 Sa', guru: 'Ri1 and Da1 appear only on the way down. The ascent is Suddha Dhanyasi; the descent is Todi.' }),
  J('punnagavarali', 'Punnagavarali', 8, ".n S r g m P d n", "n d P m g r S .n", { guru: 'A nishadantya raga: it lives between the lower Ni2 and the Ni2 above, rarely touching the upper Sa.' }),
  J('bhupalam', 'Bhupalam', 8, "S r g P d S'", "S' d P g r S", { guru: 'The Todi pentatonic, a dawn raga. Ri1 and Da1 are shaded with a slow kampita.' }),
  // Mela 10
  J('sindhubhairavi', 'Sindhu Bhairavi', 10, "S r g m P d n S'", "S' n d P m g r S", { note: 'bhashanga: in practice touches all twelve swaras', guru: 'A bhashanga raga that borrows freely. In riyaz, keep to the komal frame and let the ornaments carry the colour.' }),
  // Mela 15 Mayamalavagowla
  J('malahari', 'Malahari', 15, "S r m P d S'", "S' d P m G r S", { pakad: 'Sa Ri1 Ma Pa Da1 Sa · Da1 Pa Ma Ga3 Ri1 Sa', guru: 'The geetam raga. Ga3 comes only while descending; the Ma-Ga3-Ri1 fall should be unhurried.' }),
  J('saveri', 'Saveri', 15, "S r m P d S'", "S' N d P m G r S", { pakad: 'Sa Ri1 Ma Pa Da1 Sa · Ni3 Da1 Pa Ma Ga3 Ri1 Sa', guru: 'Ga3 and Ni3 come only in descent, both as touches from above. Ri1 and Da1 sway; Ma and Pa stand still.' }),
  J('bowli', 'Bowli', 15, "S r G P d S'", "S' N d P G r S", { guru: 'Ri1 and Da1 with Ga3 and Pa; Ni3 only in descent. A morning raga sung with weight on Ga3.' }),
  J('gowla', 'Gowla', 15, "S r m P N S'", "S' N P m r G m r S", { pakad: 'Sa Ri1 Ma Pa Ni3 Sa · Ni3 Pa Ma Ri1 Ga3 Ma Ri1 Sa', guru: 'Ri1 is the heart of Gowla, sung with a sharp kampita. Ga3 appears only in the Ri1-Ga3-Ma-Ri1 turn.' }),
  J('revagupti', 'Revagupti', 15, "S r G P d S'", "S' d P G r S", { guru: 'Bowli without Ni. Ga3 and Da1 as straight notes, Ri1 shaded.' }),
  J('lalita', 'Lalita', 15, "S r G m d N S'", "S' N d m G r S", { guru: 'No Pa at all. Ma is the pillar; Da1 leans on Ma from above, and the Ri1-Ga3-Ma rise is slow.' }),
  J('nadanamakriya', 'Nadanamakriya', 15, ".N S r G m P d N", "N d P m G r S .N", { guru: 'Nishadantya: the phrases rest on Ni3 below Sa rather than on the upper Sa.' }),
  J('jaganmohini', 'Jaganmohini', 15, "S G m P N S'", "S' N P m G r S", { guru: 'Ri1 only in descent, no Da at all. Ga3 and Ni3 are bright; the Ri1 at the bottom is a shaded landing.' }),
  // Mela 16
  J('malayamarutam', 'Malayamarutam', 16, "S r G P D n S'", "S' n D P G r S", { guru: 'No Ma. Ri1 against Ga3 below, Da2 against Ni2 above; the two halves have different colours.' }),
  // Mela 17
  J('vasanta', 'Vasanta', 17, "S m G m D N S'", "S' N D m G r S", { pakad: 'Sa Ma Ga3 Ma Da2 Ni3 Sa · Ni3 Da2 Ma Ga3 Ri1 Sa', guru: 'No Pa. The Sa-to-Ma leap opens the raga; Ri1 comes only in descent and only as a landing.' }),
  // Mela 20 Natabhairavi
  J('hindolam', 'Hindolam', 20, "S g m d n S'", "S' n d m g S", { pakad: 'Sa Ga2 Ma Da1 Ni2 Sa · Ni2 Da1 Ma Ga2 Sa', guru: 'No Ri, no Pa. Ga2 and Ni2 are oscillated from above, Da1 is held low. Reaching for Pa is the usual slip.' }),
  J('bhairavi_c', 'Bhairavi', 20, "S R g m P D n S'", "S' n d P m g R S", { note: 'bhashanga: Da2 ascending, Da1 descending', pakad: 'Sa Ri2 Ga2 Ma Pa Da2 Ni2 Sa · Ni2 Da1 Pa Ma Ga2 Ri2 Sa', guru: 'Da2 on the way up, Da1 on the way down: that is the whole character of Bhairavi. Ga2 and Ni2 sway; Ri2 is steady.' }),
  J('anandabhairavi', 'Anandabhairavi', 20, "S g R g m P D P S'", "S' n D P m g R S", { note: 'bhashanga: Da2, with Ga3 and Ni3 as visitors', pakad: 'Sa Ga2 Ri2 Ga2 Ma Pa · Da2 Pa Sa · Ni2 Da2 Pa Ma Ga2 Ri2 Sa', guru: 'The Ga2-Ri2-Ga2 turn and the Da2-Pa-Sa rise are the signature. Da2, not Da1, despite the parent scale.' }),
  J('jonpuri', 'Jonpuri', 20, "S R m P d n S'", "S' n d P m g R S", { guru: 'Ga2 only in descent. Da1 and Ni2 are oscillated; a straight Da1 sounds Western.' }),
  J('saramati', 'Saramati', 20, "S R g m P d n S'", "S' n d m g S", { guru: 'Full on the way up, Hindolam on the way down. Keep Pa and Ri2 out of the descent.' }),
  J('asaveri', 'Asaveri', 20, "S R m P d S'", "S' n d P m g R S", { guru: 'Ga2 and Ni2 only in descent. Da1 is the swara to shade; Ri2 and Ma are straight.' }),
  // Mela 21
  J('kalyanavasantam', 'Kalyanavasantam', 21, "S g m P N S'", "S' N d P m g R S", { guru: 'Ri2 and Da1 come only in descent. Ni3 rises to Sa cleanly; Ga2 sways.' }),
  // Mela 22 Kharaharapriya
  J('abheri', 'Abheri', 22, "S g m P n S'", "S' n D P m g R S", { pakad: 'Sa Ga2 Ma Pa Ni2 Sa · Ni2 Da2 Pa Ma Ga2 Ri2 Sa', guru: 'Ri2 and Da2 only in descent. Ga2 and Ni2 are the gamaka swaras; the Pa-Ma-Ga2 fall is the colour.' }),
  J('abhogi', 'Abhogi', 22, "S R g m D S'", "S' D m g R S", { pakad: 'Sa Ri2 Ga2 Ma Da2 Sa · Da2 Ma Ga2 Ri2 Sa', guru: 'No Pa, no Ni. Ga2 sways from Ma; Da2 is sung from Sa above. The Ma-Da2 leap must land cleanly.' }),
  J('sriranjani', 'Sriranjani', 22, "S R g m D n S'", "S' n D m g R S", { pakad: 'Sa Ri2 Ga2 Ma Da2 Ni2 Sa · Ni2 Da2 Ma Ga2 Ri2 Sa', guru: 'No Pa. Ni2 and Ga2 are oscillated; Ri2, Ma and Da2 are the resting notes.' }),
  J('suddhadhanyasi', 'Suddha Dhanyasi', 22, "S g m P n S'", "S' n P m g S", { pakad: 'Sa Ga2 Ma Pa Ni2 Sa · Ni2 Pa Ma Ga2 Sa', guru: 'The Carnatic Dhani. Ga2 and Ni2 take a sway from the note above; Ma and Pa are the pillars.' }),
  J('madhyamavati', 'Madhyamavati', 22, "S R m P n S'", "S' n P m R S", { pakad: 'Sa Ri2 Ma Pa Ni2 Sa · Ni2 Pa Ma Ri2 Sa', guru: 'The closing raga. Ri2 and Ni2 are sung with a kampita from the note above; Ma and Pa stand still. No Ga, no Da.' }),
  J('reetigowla', 'Reetigowla', 22, "S g R g m n D m n n S'", "S' n D m g m P m g R S", { note: 'vakra', pakad: 'Sa Ga2 Ri2 Ga2 Ma · Ni2 Da2 Ma · Ni2 Ni2 Sa', guru: 'A vakra raga: it moves in turns, never straight up. Pa is touched only in the Ma-Pa-Ma descent phrase.' }),
  J('mukhari', 'Mukhari', 22, "S R m P n D S'", "S' n d P m g R S", { note: 'bhashanga: Da2 ascending, Da1 descending', guru: 'Da2 going up, Da1 coming down, like Bhairavi, but Ga2 only in descent and a plaintive weight on Ni2.' }),
  J('darbar', 'Darbar', 22, "S R m P D n S'", "S' n D P m R g R S", { note: 'vakra', guru: 'Ga2 appears only in the Ri2-Ga2-Ri2 turn at the bottom of the descent, sung as a sway from Ma.' }),
  J('kanada', 'Kanada', 22, "S R g m D n S'", "S' n P m g m R S", { note: 'vakra', guru: 'Pa is skipped on the way up and Da2 on the way down. The Ga2-Ma-Ri2 turn, with Ga2 oscillated, is the catch.' }),
  J('manirangu', 'Manirangu', 22, "S R m P n S'", "S' n P m g R S", { guru: 'Madhyamavati with Ga2 in descent. The Ga2 is a landing from Ma, not a note to hold.' }),
  J('devamanohari', 'Devamanohari', 22, "S R m P D n S'", "S' n D n P m R S", { guru: 'No Ga. The Da2-Ni2-Da2-Pa turn in descent is the signature.' }),
  J('jayamanohari', 'Jayamanohari', 22, "S R g m D S'", "S' n D m g R S", { guru: 'Abhogi with Ni2 in descent. No Pa.' }),
  J('brindavanasaranga', 'Brindavana Saranga', 22, "S R m P N S'", "S' n P m R S", { note: 'bhashanga: Ni3 ascending, Ni2 descending', guru: 'Ni3 up, Ni2 down. Ri2 is sung with a kampita; Ma and Pa are still.' }),
  J('sri', 'Sri', 22, "S R m P n S'", "S' n P D n P m R g R S", { note: 'vakra', pakad: 'Sa Ri2 Ma Pa Ni2 Sa · Ni2 Pa Da2 Ni2 Pa Ma Ri2 Ga2 Ri2 Sa', guru: 'Ga2 and Da2 appear only in their turns during descent. Ri2 carries the raga; sing it with its sway from Ga2.' }),
  J('kapi', 'Kapi', 22, "S R m P n S'", "S' N D n P m G R S", { note: 'bhashanga: Ni3 and Ga3 as visitors', guru: 'Kapi borrows Ni3 and Ga3 in descent. In riyaz keep the Kharaharapriya frame and add the visitors only in phrases you know.' }),
  // Mela 27
  J('nalinakanti', 'Nalinakanti', 27, "S G R m P N S'", "S' N P m G R S", { note: 'vakra', guru: 'No Da. The Sa-Ga3-Ri2-Ma turn opens it; Ni3 to Sa is bright and direct.' }),
  // Mela 28 Harikambhoji
  J('mohanam', 'Mohanam', 28, "S R G P D S'", "S' D P G R S", { pakad: 'Sa Ri2 Ga3 Pa Da2 Sa · Da2 Pa Ga3 Ri2 Sa', guru: 'No Ma, no Ni. Ga3 and Da2 are sung with a gentle sway from the note above; Ri2 is steady. A stray Ni in descent is the usual slip.' }),
  J('kambhoji', 'Kambhoji', 28, "S R G m P D S'", "S' n D P m G R S", { note: 'bhashanga: Ni3 visits in Pa Da2 Sa Ni3 Da2 Pa', pakad: 'Sa Ri2 Ga3 Ma Pa Da2 Sa · Ni2 Da2 Pa Ma Ga3 Ri2 Sa', guru: 'Ni2 only in descent, and Ni3 only in the Sa-Ni3-Da2-Pa phrase. Ga3 and Da2 take the characteristic Kambhoji sway.' }),
  J('kedaragowla', 'Kedaragowla', 28, "S R m P n S'", "S' n D P m G R S", { guru: 'Ga3 and Da2 only in descent. Ri2 and Ni2 are oscillated; the Pa-Ma-Ga3 fall is slow.' }),
  J('yadukulakambhoji', 'Yadukula Kambhoji', 28, "S R m P D S'", "S' D P m G R S", { guru: 'No Ni; Ga3 only in descent. Da2 and Ri2 sway, Ma is firm.' }),
  J('surutti', 'Surutti', 28, "S R m P n S'", "S' n D P m G P m R S", { note: 'vakra', guru: 'The Ga3-Pa-Ma-Ri2 turn in descent is the catch. Ri2 is sung with a kampita.' }),
  J('sahana', 'Sahana', 28, "S R G m P m D n S'", "S' n D P m G m R G R S", { note: 'vakra', pakad: 'Sa Ri2 Ga3 Ma Pa Ma Da2 Ni2 Sa · Ri2 Ga3 Ri2 Sa', guru: 'Everything moves in turns. Ga3 is oscillated from Ma, Da2 from Ni2; the Ri2-Ga3-Ri2-Sa close is the signature.' }),
  J('natakurinji', 'Natakurinji', 28, "S R G m n D n P D n S'", "S' n D m G S", { note: 'vakra', guru: 'No Pa in descent. The Ni2-Da2-Ni2 turn is the catch; Ga3 and Ni2 sway.' }),
  J('bahudari', 'Bahudari', 28, "S G m P D n S'", "S' n P m G S", { guru: 'No Ri. Da2 only in ascent. Ga3 is bright, Ni2 shaded.' }),
  J('khamas', 'Khamas', 28, "S m G m P D n S'", "S' n D P m G R S", { note: 'bhashanga: Ni3 visits', guru: 'Ri2 only in descent. The Sa-Ma-Ga3-Ma opening and the Ni2 are the colour.' }),
  J('kuntalavarali', 'Kuntalavarali', 28, "S m P D n D S'", "S' n D P m S", { guru: 'No Ri, no Ga. Sa to Ma directly; Da2-Ni2-Da2 turn at the top.' }),
  J('valaji', 'Valaji', 28, "S G P D n S'", "S' n D P G S", { guru: 'A pentatonic with Ga3 and Ni2. The Pa-Da2-Ni2 climb is bright; keep Ri and Ma out entirely.' }),
  J('nagaswaravali', 'Nagaswaravali', 28, "S G m P D S'", "S' D P m G S", { guru: 'No Ri, no Ni. Ga3 and Da2 are sung straight; a cheerful, open raga.' }),
  J('navarasakannada', 'Navarasa Kannada', 28, "S G m P S'", "S' n D m G R S", { note: 'vakra', guru: 'Only four notes going up, six coming down. Ri2 and Da2 belong to the descent alone.' }),
  // Mela 29 Sankarabharanam
  J('hamsadhwani_c', 'Hamsadhwani', 29, "S R G P N S'", "S' N P G R S", { pakad: 'Sa Ri2 Ga3 Pa Ni3 Sa · Ni3 Pa Ga3 Ri2 Sa', guru: 'No Ma, no Da. The Pa-Ni3 and Ni3-Sa leaps must land cleanly; Ga3 sways gently from Pa.' }),
  J('bilahari', 'Bilahari', 29, "S R G P D S'", "S' N D P m G R S", { pakad: 'Sa Ri2 Ga3 Pa Da2 Sa · Ni3 Da2 Pa Ma Ga3 Ri2 Sa', guru: 'Mohanam on the way up, Sankarabharanam on the way down. Ma and Ni3 are touches, never resting notes.' }),
  J('arabhi', 'Arabhi', 29, "S R m P D S'", "S' N D P m G R S", { pakad: 'Sa Ri2 Ma Pa Da2 Sa · Ni3 Da2 Pa Ma Ga3 Ri2 Sa', guru: 'Ga3 and Ni3 only in descent, each as a quick touch. Ri2 and Da2 are sung with a sway from the note above.' }),
  J('begada', 'Begada', 29, "S G R G m P D P S'", "S' N D P m G R S", { note: 'vakra; bhashanga: Ni2 visits', pakad: 'Sa Ga3 Ri2 Ga3 Ma Pa Da2 Pa Sa · Ni3 Da2 Pa Ma Ga3 Ri2 Sa', guru: 'The Ga3-Ri2-Ga3 and Da2-Pa-Sa turns are the shape of Begada. Ma is sung slightly high, pulled toward Pa.' }),
  J('kedaram', 'Kedaram', 29, "S m G m P N S'", "S' N P m G R S", { note: 'vakra', guru: 'No Da. The Sa-Ma-Ga3-Ma opening is the signature; Ni3 goes straight to Sa.' }),
  J('sama', 'Sama', 29, "S R m P D S'", "S' D P m G R S", { guru: 'No Ni. Ga3 only in descent. Da2 is held long; a raga of calm.' }),
  J('devagandhari', 'Devagandhari', 29, "S R m P D S'", "S' N D P m G R S", { guru: 'Arabhi with a slower gait. Ga3 and Ni3 are glides, not notes to hold.' }),
  J('atana', 'Atana', 29, "S R m P N S'", "S' N D P m P G R S", { note: 'vakra', guru: 'Ga3 only in the Pa-Ga3-Ri2 turn, and sung as a drop from Pa. Ni3 is sung with force.' }),
  J('behag', 'Behag', 29, "S G m P N S'", "S' N D P M G m G R S", { note: 'bhashanga: Ma2 as a touch between Pa and Ga3', guru: 'Ma2 is a brief touch between Pa and Ga3 on the way down; the main Ma is suddha. Ri2 and Da2 are light.' }),
  J('nilambari', 'Nilambari', 29, "S R G m P D P N S'", "S' N P m G R G S", { note: 'vakra', guru: 'A lullaby raga. The Ri2-Ga3-Sa close and the Da2-Pa-Ni3 turn are its marks.' }),
  J('kurinji', 'Kurinji', 29, "S .N S R G m P D", "D P m G R S .N S", { guru: 'Lives between the lower Ni3 and Da2; the upper Sa is not reached.' }),
  J('purnachandrika', 'Purnachandrika', 29, "S R G m P D P S'", "S' N P m R G m R S", { note: 'vakra', guru: 'The Ma-Ri2-Ga3-Ma-Ri2 turn in descent is the signature; Da2 is skipped coming down.' }),
  J('janaranjani', 'Janaranjani', 29, "S R G m P D P S'", "S' D P m R S", { guru: 'Ga3 and Ni are absent in descent; the Da2-Pa-Sa rise is the catch.' }),
  J('suddhasaveri', 'Suddha Saveri', 29, "S R m P D S'", "S' D P m R S", { pakad: 'Sa Ri2 Ma Pa Da2 Sa · Da2 Pa Ma Ri2 Sa', guru: 'The Carnatic Durga. Ri2 and Da2 take a sway from the note above; Ma is firm.' }),
  // Mela 36
  J('nata', 'Nata', 36, "S g G m P n N S'", "S' N P m g S", { note: 'Ri3 and Da3: the Ri and Da sit just under Ga3 and Ni3', pakad: 'Sa Ri3 Ga3 Ma Pa Ni3 Sa · Ni3 Pa Ma Ri3 Sa', guru: 'Ri3 is the highest Ri, a semitone under Ga3, and it must be sung as a Ri, approached from Sa with a jerk. Ga3 and Da3 are skipped in descent.' }),
  // Mela 39
  J('varali', 'Varali', 39, "S R r R M P d N S'", "S' N d P M R r S", { note: 'Ga1 shares its pitch with Ri2', pakad: 'Sa Ga1 Ri1 Ga1 Ma2 Pa · Da1 Pa Ma2 Ga1 Ri1 Sa', guru: 'Ga1 is the same pitch as Ri2 but it is a Ga, slid down from Ma2 with a heavy gamaka. Ma2 leans on Pa; Da1 and Ri1 sway.' }),
  // Mela 53
  J('hamsanandi', 'Hamsanandi', 53, "S r G M D N S'", "S' N D M G r S", { pakad: 'Sa Ri1 Ga3 Ma2 Da2 Ni3 Sa · Ni3 Da2 Ma2 Ga3 Ri1 Sa', guru: 'No Pa. Ma2 and Ni3 are bright; Ri1 is sung close to Sa with a kampita. The Carnatic Sohni.' }),
  J('purvikalyani', 'Purvikalyani', 53, "S r G M P D P S'", "S' N D P M G r S", { note: 'vakra', pakad: 'Sa Ri1 Ga3 Ma2 Pa Da2 Pa Sa · Ni3 Da2 Pa Ma2 Ga3 Ri1 Sa', guru: 'The Da2-Pa-Sa rise is the catch. Ma2 leans on Pa, Ri1 on Sa; Ga3 is held.' }),
  // Mela 59
  J('ranjani', 'Ranjani', 59, "S R g M D S'", "S' N D M g S", { note: 'vakra', guru: 'No Pa. Ga2 against Ma2 is the colour; Ri2 only in ascent, Ni3 only in descent.' }),
  J('madhuvanti_c', 'Madhuvanti', 59, "S g M P N S'", "S' N D P M g R S", { guru: 'Ri2 and Da2 only in descent. Ga2 sways from Ma2; Ni3 goes straight to Sa.' }),
  // Mela 60
  J('hamsanadam', 'Hamsanadam', 60, "S R M P N S'", "S' N P M R S", { guru: 'A pentatonic with prati Ma and no Ga or Da. Ma2 leans on Pa; Ri2 and Ni3 are bright.' }),
  // Mela 64
  J('saraswati', 'Saraswati', 64, "S R M P D S'", "S' n D P M R S", { guru: 'No Ga. Ni2 only in descent. Ma2 sits close to Pa; Da2 is held.' }),
  // Mela 65 Kalyani
  J('mohanakalyani', 'Mohanakalyani', 65, "S R G P D S'", "S' N D P M G R S", { guru: 'Mohanam going up, Kalyani coming down. Ma2 and Ni3 are glides in descent only.' }),
  J('saranga', 'Saranga', 65, "S R G M P D N S'", "S' N D P M R G m R S", { note: 'bhashanga: Ma1 in the Ri2 Ga3 Ma1 Ri2 turn', guru: 'Both Ma: Ma2 everywhere except the Ri2-Ga3-Ma1-Ri2 turn in descent. The Pa-Ma2 sway is the colour.' }),
  J('yamunakalyani', 'Yamunakalyani', 65, "S R G P M P D S'", "S' D P M G R S", { note: 'bhashanga: Ma1 visits', guru: 'Ni is skipped; the Pa-Ma2-Pa turn is the signature. Ma1 appears only as a light touch.' }),
  J('sunadavinodini', 'Sunadavinodini', 65, "S G M D N S'", "S' N D M G S", { guru: 'No Ri, no Pa. The Carnatic Hindol. Ma2 and Ni3 are bright; Ga3 and Da2 are held.' }),
  // Mela 66
  J('amritavarshini', 'Amritavarshini', 66, "S G M P N S'", "S' N P M G S", { pakad: 'Sa Ga3 Ma2 Pa Ni3 Sa · Ni3 Pa Ma2 Ga3 Sa', guru: 'The rain raga. Ma2 leans on Pa and Ni3 on Sa; Ga3 is held still. No Ri, no Da.' }),
];

export const CARNATIC_RAGAS = [...MELAKARTAS, ...JANYAS];
export const melaName = (n) => MELAKARTA_NAMES[n - 1];

// Sargam / alankar drills: the app shows a target swara per matra and scores what you sing.
import { tokens, swaraLabel } from './music.js';

// Carnatic beginners' exercises, written over the eight degrees s r g m p d n S (S = upper Sa; "," holds the previous
// note). They apply to any sampurna raga: the degrees are read from the raga's own arohana. As commonly taught;
// schools vary in a few of them.
const SARALI = [
  's r g m p d n S | S n d p m g r s',
  's r s r s r g m | s r g m p d n S | S n S n S n d p | S n d p m g r s',
  's r g s r g s r | s r g m p d n S | S n d S n d S n | S n d p m g r s',
  's r g m s r g m | s r g m p d n S | S n d p S n d p | S n d p m g r s',
  's r g m p , s r | s r g m p d n S | S n d p m , S n | S n d p m g r s',
  's r g m p d s r | s r g m p d n S | S n d p m g S n | S n d p m g r s',
  's r g m p d n S | s r g m p d n S | S n d p m g r s | S n d p m g r s',
  's r g m p m g r | s r g m p d n S | S n d p m p d n | S n d p m g r s',
];
const JANTA = [
  'ss rr gg mm pp dd nn SS | SS nn dd pp mm gg rr ss',
  'ss rr ss rr ss rr gg mm | ss rr gg mm pp dd nn SS | SS nn SS nn SS nn dd pp | SS nn dd pp mm gg rr ss',
  'ss rr gg ss rr gg ss rr | ss rr gg mm pp dd nn SS | SS nn dd SS nn dd SS nn | SS nn dd pp mm gg rr ss',
  'ss rr gg mm ss rr gg mm | ss rr gg mm pp dd nn SS | SS nn dd pp SS nn dd pp | SS nn dd pp mm gg rr ss',
];
// Alankaras: one phrase shape per tala, moved up the scale from Sa and back down from upper Sa.
const ALANKARA = [
  ['dhruva', 'Chatusra Dhruva (14)', [0, 1, 2, 3, 0, 1, 2, 3, 0, 1, 2, 0, 1, 2]],
  ['matya', 'Chatusra Matya (10)', [0, 1, 2, 3, 0, 1, 0, 1, 2, 3]],
  ['rupaka', 'Rupaka (6)', [0, 1, 0, 1, 2, 3]],
  ['jhampa', 'Misra Jhampa (10)', [0, 1, 2, 3, 4, 3, 2, 1, 0, 1]],
  ['tisra_triputa', 'Tisra Triputa (7)', [0, 1, 2, 0, 1, 0, 1]],
  ['ata', 'Khanda Ata (14)', [0, 1, 2, 3, 4, 0, 1, 2, 3, 4, 0, 1, 2, 3]],
  ['chatusra_eka', 'Chatusra Eka (4)', [0, 1, 2, 3]],
];
const DEG = 'srgmpdnS';
function degreeNotes(ar) {
  // the raga's arohana as eight degrees; a sampurna arohana S R G M P D N S' maps straight onto s..S
  const base = ar.filter((t) => t.oct === 0 && t.sw !== 'S');
  const sa = ar.find((t) => t.sw === 'S' && t.oct === 0) || { sw: 'S', oct: 0 };
  const list = [sa, ...base.slice(0, 6), { sw: 'S', oct: 1 }];
  return list.length === 8 && base.length >= 6 ? list : null;
}
function fromDegrees(str, deg) {
  const out = []; let last = deg[0];
  for (const ch of str.replace(/[|\s]/g, '')) {
    if (ch === ',') { out.push(last); continue; }
    const i = DEG.indexOf(ch); if (i < 0) continue;
    last = deg[i]; out.push(last);
  }
  return out;
}
function alankaraNotes(shape, deg) {
  const span = Math.max(...shape), notes = [];
  for (let start = 0; start + span <= 7; start++) for (const o of shape) notes.push(deg[start + o]);
  for (let start = 7; start - span >= 0; start--) for (const o of shape) notes.push(deg[start - o]);
  return notes;
}

export function buildPatterns(raga, tradition = 'hindustani') {
  const ar = tokens(raga.aroha), av = tokens(raga.avaroha);
  const seq = (a, k) => { const out = []; for (let i = 0; i + k <= a.length; i++) out.push(...a.slice(i, i + k)); return out; };
  const out = [
    { id: 'aroha', name: tradition === 'carnatic' ? 'Arohana – Avarohana' : 'Aroha – Avaroha', notes: [...ar, ...av.slice(1)], perNote: 1 },
    { id: 'hold', name: 'Long holds (2 per swara)', notes: [...ar, ...av.slice(1)], perNote: 2 },
    { id: 'pairs', name: 'Pairs: SR RG GM …', notes: [...seq(ar, 2), ...seq(av, 2)], perNote: 1 },
    { id: 'triples', name: 'Triples: SRG RGM …', notes: [...seq(ar, 3), ...seq(av, 3)], perNote: 1 },
    { id: 'sa', name: 'Sa – swara – Sa (return to Sa)', notes: ar.slice(1, -1).flatMap((n) => [{ sw: 'S', oct: 0 }, n]).concat([{ sw: 'S', oct: 0 }]), perNote: 2 },
  ];
  const deg = tradition === 'carnatic' ? degreeNotes(ar) : null;
  if (deg) {
    SARALI.forEach((p, i) => out.push({ id: `sarali${i + 1}`, name: `Sarali varisai ${i + 1}`, notes: fromDegrees(p, deg), perNote: 1, taal: 'adi' }));
    JANTA.forEach((p, i) => out.push({ id: `janta${i + 1}`, name: `Janta varisai ${i + 1}`, notes: fromDegrees(p, deg), perNote: 1, taal: 'adi' }));
    ALANKARA.forEach(([taal, tname, shape]) => out.push({ id: `alankara_${taal}`, name: `Alankara · ${tname}`, notes: alankaraNotes(shape, deg), perNote: 1, taal }));
  }
  return out;
}

export class Drill {
  constructor() { this.active = false; this.finished = false; this.notes = []; this.results = []; }
  start(noteToks, cmap, t0, noteDur) {
    this.notes = noteToks.map((n) => ({ ...n, label: swaraLabel(n.sw, n.oct), cents: cmap[n.sw] + n.oct * 1200 }));
    this.results = this.notes.map(() => ({ frames: 0, silent: 0, hits: 0, devSum: 0, wrong: {} }));
    this.t0 = t0; this.noteDur = noteDur; this.active = true; this.finished = false;
  }
  stop() { this.active = false; }
  indexAt(t) { return Math.floor((t - this.t0) / this.noteDur); }
  _slot(t) {
    if (!this.active) return -1;
    const i = this.indexAt(t);
    if (i < 0) return -1;
    if (i >= this.notes.length) { this.finished = true; this.active = false; return -1; }
    const frac = (t - this.t0) / this.noteDur - i;
    return frac < 0.2 ? -1 : i;   // ignore the first 20% of each note (transition time)
  }
  addFrame(t, cents, info) {
    const i = this._slot(t); if (i < 0) return;
    const r = this.results[i]; r.frames++;
    const d = cents - this.notes[i].cents;
    if (Math.abs(d) <= 40) { r.hits++; r.devSum += d; }
    else r.wrong[info.label] = (r.wrong[info.label] || 0) + 1;
  }
  addSilence(t) { const i = this._slot(t); if (i >= 0) this.results[i].silent++; }
  verdict(i) {
    const r = this.results[i]; const total = r.frames + r.silent;
    if (!total) return { cls: '', text: '' };
    if (r.silent > total * 0.6) return { cls: 'bad', text: 'no voice' };
    if (r.hits / total >= 0.5) {
      const md = r.devSum / r.hits;
      if (Math.abs(md) <= 15) return { cls: 'good', text: '✓' };
      return { cls: 'warn', text: md < 0 ? `flat ${Math.round(-md)}¢` : `sharp ${Math.round(md)}¢` };
    }
    const w = Object.entries(r.wrong).sort((a, b) => b[1] - a[1])[0];
    return { cls: 'bad', text: w ? `sang ${w[0]}` : 'off' };
  }
  summary() {
    let good = 0, warn = 0, bad = 0;
    const issues = [];
    this.notes.forEach((n, i) => {
      const v = this.verdict(i);
      if (v.cls === 'good') good++; else if (v.cls === 'warn') { warn++; issues.push(`${n.label} ${v.text}`); } else { bad++; issues.push(`${n.label}: ${v.text}`); }
    });
    return { good, warn, bad, total: this.notes.length, issues };
  }
}

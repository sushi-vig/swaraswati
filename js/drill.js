// Sargam / alankar drills: the app shows a target swara per matra and scores what you sing.
import { tokens, swaraLabel } from './music.js';

export function buildPatterns(raga) {
  const ar = tokens(raga.aroha), av = tokens(raga.avaroha);
  const seq = (a, k) => { const out = []; for (let i = 0; i + k <= a.length; i++) out.push(...a.slice(i, i + k)); return out; };
  return [
    { id: 'aroha', name: 'Aroha – Avaroha', notes: [...ar, ...av.slice(1)], perNote: 1 },
    { id: 'hold', name: 'Long holds (2 matras each)', notes: [...ar, ...av.slice(1)], perNote: 2 },
    { id: 'pairs', name: 'Pairs: SR RG GM …', notes: [...seq(ar, 2), ...seq(av, 2)], perNote: 1 },
    { id: 'triples', name: 'Triples: SRG RGM …', notes: [...seq(ar, 3), ...seq(av, 3)], perNote: 1 },
    { id: 'sa', name: 'Sa – swara – Sa (return to Sa)', notes: ar.slice(1, -1).flatMap((n) => [{ sw: 'S', oct: 0 }, n]).concat([{ sw: 'S', oct: 0 }]), perNote: 2 },
  ];
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

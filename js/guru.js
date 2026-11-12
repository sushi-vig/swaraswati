// The "guru": watches every pitch frame, tracks held notes per swara, gives live hints and a session report.
import { SWARA_LONG, SWARA_ORDER } from './music.js';

const avg = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std = (a) => { const m = avg(a); return Math.sqrt(avg(a.map((v) => (v - m) * (v - m)))); };

export class Guru {
  constructor() { this.reset(); }
  reset() {
    this.per = {};            // sw -> { holds, sumDev, sumSd, sumDur }
    this.voiced = 0; this.frames = 0; this.inTune = 0; this.near = 0;
    this.outRaga = [];        // { sw, t, dur, suggest }
    this.run = null; this.hint = null; this.hintT = 0;
    this.firstT = null; this.lastT = null;
  }

  _finishRun() {
    const r = this.run; if (!r) return; this.run = null;
    const dur = r.tEnd - r.tStart;
    if (dur < 0.25 || r.n < 4) return;
    const mean = r.sum / r.n, sd = Math.sqrt(Math.max(0, r.sq / r.n - mean * mean));
    const p = this.per[r.sw] || (this.per[r.sw] = { holds: 0, sumDev: 0, sumSd: 0, sumDur: 0 });
    p.holds++; p.sumDev += mean; p.sumSd += sd; p.sumDur += dur;
    if (!r.inRaga) this.outRaga.push({ sw: r.sw, t: r.tStart, dur, suggest: r.suggest });
  }

  // info: nearest of all 12 swaras; ragaInfo: nearest swara allowed in the raga.
  addFrame(t, info, ragaInfo, inRaga, ragaName) {
    this.frames++; this.voiced++;
    if (this.firstT == null) this.firstT = t; this.lastT = t;
    const dev = info.dev, ad = Math.abs(dev);
    if (ad <= 15) this.inTune++;
    if (ad <= 30) this.near++;
    const r = this.run;
    if (r && r.sw === info.sw && r.oct === info.oct && t - r.tEnd < 0.15) {
      r.n++; r.sum += dev; r.sq += dev * dev; r.tEnd = t;
      r.recent.push(dev); if (r.recent.length > 24) r.recent.shift();
    } else {
      this._finishRun();
      this.run = { sw: info.sw, oct: info.oct, inRaga, suggest: ragaInfo.sw, tStart: t, tEnd: t, n: 1, sum: dev, sq: dev * dev, recent: [dev] };
    }
    this._updateHint(t, ragaName);
  }

  addSilence(t) {
    this.frames++;
    if (this.run && t - this.run.tEnd > 0.15) this._finishRun();
    if (this.hint && t - this.hintT > 1.8) this.hint = null;
  }

  _updateHint(t, ragaName) {
    const r = this.run;
    if (!r || r.tEnd - r.tStart < 0.35 || t - this.hintT < 0.3) return;
    this.hintT = t;
    const mean = avg(r.recent), sd = std(r.recent), label = SWARA_LONG[r.sw];
    if (!r.inRaga) this.hint = { cls: 'bad', text: `${label} is not in ${ragaName}. Nearest raga swara: ${SWARA_LONG[r.suggest]}.` };
    else if (mean < -18) this.hint = { cls: 'warn', text: `${label} is flat by ${Math.round(-mean)}¢ — lift it a little.` };
    else if (mean > 18) this.hint = { cls: 'warn', text: `${label} is sharp by ${Math.round(mean)}¢ — ease it down.` };
    else if (sd > 22) this.hint = { cls: 'warn', text: `Hold ${label} steadier — it is wavering ±${Math.round(sd)}¢.` };
    else this.hint = { cls: 'good', text: `${label} — in tune.` };
  }

  report(ragaName) {
    this._finishRun();
    const lines = [];
    if (!this.voiced) { lines.push({ cls: '', text: 'No singing recorded yet. Start the mic and sing a few phrases.' }); return lines; }
    const dur = (this.lastT ?? 0) - (this.firstT ?? 0);
    const mm = Math.floor(dur / 60), ss = Math.round(dur % 60).toString().padStart(2, '0');
    lines.push({ cls: '', text: `Session: ${mm}:${ss} of singing analysed, ${Math.round((this.voiced / Math.max(1, this.frames)) * 100)}% of the time voiced.` });
    const inPct = Math.round((this.inTune / this.voiced) * 100), nearPct = Math.round((this.near / this.voiced) * 100);
    lines.push({ cls: inPct >= 60 ? 'good' : inPct >= 40 ? 'warn' : 'bad', text: `In tune (within 15¢): ${inPct}%. Close (within 30¢): ${nearPct}%.` });

    const rows = SWARA_ORDER.filter((s) => this.per[s] && this.per[s].holds >= 2)
      .map((s) => { const p = this.per[s]; return { sw: s, holds: p.holds, dev: p.sumDev / p.holds, sd: p.sumSd / p.holds }; });
    if (rows.length) {
      lines.push({ cls: '', text: 'Held notes by swara:' });
      for (const r of rows.sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev))) {
        const tend = Math.abs(r.dev) <= 10 ? 'centred' : r.dev > 0 ? `tends sharp (+${Math.round(r.dev)}¢)` : `tends flat (${Math.round(r.dev)}¢)`;
        const cls = Math.abs(r.dev) <= 10 ? 'good' : Math.abs(r.dev) <= 25 ? 'warn' : 'bad';
        lines.push({ cls, text: `• ${SWARA_LONG[r.sw]}: ${tend}, wobble ±${Math.round(r.sd)}¢, held ${r.holds}×` });
      }
      const worst = rows[0];
      if (Math.abs(worst.dev) > 12) lines.push({ cls: 'warn', text: `Focus: ${SWARA_LONG[worst.sw]}. Hold it against the tanpura and ${worst.dev > 0 ? 'relax it down' : 'lift it up'} until the trace sits on the line.` });
    }
    if (this.outRaga.length) {
      const counts = {};
      for (const o of this.outRaga) { const k = o.sw + '>' + o.suggest; counts[k] = (counts[k] || 0) + 1; }
      for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
        const [sw, sug] = k.split('>');
        lines.push({ cls: 'bad', text: `${SWARA_LONG[sw]} appeared ${n}× but is not in ${ragaName} — you probably wanted ${SWARA_LONG[sug]}.` });
      }
    } else if (ragaName) {
      lines.push({ cls: 'good', text: `No swaras outside ${ragaName}. Good raga discipline.` });
    }
    return lines;
  }
}

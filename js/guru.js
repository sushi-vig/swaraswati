// The "guru": watches every pitch frame, tracks held notes per swara, gives live hints and a session report
// written the way a teacher would speak, not as a table of numbers.
import { SWARA_LONG, SWARA_NAMES, SWARA_ORDER, swaraLabel } from './music.js';

const avg = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const std = (a) => { const m = avg(a); return Math.sqrt(avg(a.map((v) => (v - m) * (v - m)))); };
const KOMAL = new Set(['r', 'g', 'd', 'n']);
const idxOf = (sw, oct) => SWARA_ORDER.indexOf(sw) + oct * 12;

const times = (n) => (n === 1 ? 'once' : n === 2 ? 'twice' : `${n} times`);
const listWords = (arr) => (arr.length <= 1 ? arr.join('') : arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1]);
const amount = (c) => (c <= 20 ? 'a shade' : c <= 35 ? 'noticeably' : c <= 60 ? 'a lot, close to a quarter tone' : 'badly, almost a semitone');
const minutes = (sec) => (sec < 50 ? `${Math.round(sec)} seconds` : sec < 90 ? 'a minute or so' : `about ${Math.round(sec / 60)} minutes`);

export class Guru {
  constructor() { this.reset(); }
  reset() {
    this.per = {};            // sw -> { holds, sumDev, sumSd, sumDur, octs:Set }
    this.voiced = 0; this.frames = 0; this.inTune = 0; this.near = 0;
    this.outRaga = [];        // { sw, t, dur, suggest }
    this.runs = [];           // finished held notes in order: { sw, oct, idx, tStart, tEnd, dur, inRaga }
    this.run = null; this.hint = null; this.hintT = 0;
    this.firstT = null; this.lastT = null;
  }

  _finishRun() {
    const r = this.run; if (!r) return; this.run = null;
    const dur = r.tEnd - r.tStart;
    if (dur < 0.25 || r.n < 4) return;
    const mean = r.sum / r.n, sd = Math.sqrt(Math.max(0, r.sq / r.n - mean * mean));
    const p = this.per[r.sw] || (this.per[r.sw] = { holds: 0, sumDev: 0, sumSd: 0, sumDur: 0, octs: new Set() });
    p.holds++; p.sumDev += mean; p.sumSd += sd; p.sumDur += dur; p.octs.add(r.oct);
    if (!r.inRaga) this.outRaga.push({ sw: r.sw, t: r.tStart, dur, suggest: r.suggest });
    if (this.runs.length < 4000) this.runs.push({ sw: r.sw, oct: r.oct, idx: idxOf(r.sw, r.oct), tStart: r.tStart, tEnd: r.tEnd, dur, inRaga: r.inRaga });
  }

  // info: nearest of all 12 swaras; ragaInfo: nearest swara allowed in the raga; rctx: { name, raga, set, up, down } or null.
  addFrame(t, info, ragaInfo, inRaga, rctx) {
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
    this._updateHint(t, rctx);
  }

  addSilence(t) {
    this.frames++;
    if (this.run && t - this.run.tEnd > 0.15) this._finishRun();
    if (this.hint && t - this.hintT > 1.8) this.hint = null;
  }

  _updateHint(t, rctx) {
    const r = this.run;
    if (!r || r.tEnd - r.tStart < 0.35 || t - this.hintT < 0.3) return;
    this.hintT = t;
    const mean = avg(r.recent), sd = std(r.recent), label = SWARA_LONG[r.sw];
    if (!r.inRaga) this.hint = { cls: 'bad', text: `${label}? Not in ${rctx ? rctx.name : 'this raga'}. You want ${SWARA_LONG[r.suggest]}.` };
    else if (mean < -18) this.hint = { cls: 'warn', text: `${label} is flat by ${Math.round(-mean)}¢ — lift it a little.` };
    else if (mean > 18) this.hint = { cls: 'warn', text: `${label} is sharp by ${Math.round(mean)}¢ — ease it down.` };
    else if (sd > 22) this.hint = { cls: 'warn', text: `Hold ${label} steadier — it is wavering ±${Math.round(sd)}¢.` };
    else this.hint = { cls: 'good', text: `${label} — in tune.` };
  }

  // Count swaras used against the grain of the aroha/avaroha (e.g. Re while climbing in Bhimpalasi).
  _directionSlips(rctx) {
    const slips = {};
    if (!rctx || !rctx.up || !rctx.down) return slips;
    const R = this.runs;
    for (let i = 1; i < R.length - 1; i++) {
      const a = R[i - 1], b = R[i], c = R[i + 1];
      if (b.tStart - a.tEnd > 1.2 || c.tStart - b.tEnd > 1.2 || !b.inRaga) continue;
      const up = a.idx < b.idx && c.idx > b.idx, down = a.idx > b.idx && c.idx < b.idx;
      if (up && !rctx.up.has(b.sw) && rctx.down.has(b.sw)) (slips[b.sw] = slips[b.sw] || { up: 0, down: 0 }).up++;
      if (down && !rctx.down.has(b.sw) && rctx.up.has(b.sw)) (slips[b.sw] = slips[b.sw] || { up: 0, down: 0 }).down++;
    }
    return slips;
  }

  report(rctx) {
    this._finishRun();
    const L = [];
    const say = (cls, text) => L.push({ cls, text: text.charAt(0).toUpperCase() + text.slice(1) });
    const raga = rctx ? rctx.raga : null, rn = rctx ? rctx.name : null;
    if (!this.voiced) { say('', 'I have not heard you sing yet. Start the mic, settle on your Sa with the tanpura, and sing a few phrases. Then ask me again.'); return L; }

    const dur = (this.lastT ?? 0) - (this.firstT ?? 0);
    const inPct = Math.round((this.inTune / this.voiced) * 100), nearPct = Math.round((this.near / this.voiced) * 100);

    // --- opening ---
    if (dur < 30) say('', `That was only a short stretch, ${minutes(dur)}. Sing a little longer next time and I will have more to say. Still, here is what I heard.`);
    else if (rn) say('', `You sat with ${rn} for ${minutes(dur)}. Let me tell you what I heard.`);
    else say('', `You sang for ${minutes(dur)} with no raga chosen, so I listened only to the sur.`);

    // --- sur overall ---
    let surState;
    if (inPct >= 75) { surState = 'good'; say('good', `Your sur is sitting well. Most of the time you were right on the note, and when you drifted it was not far. Keep this.`); }
    else if (inPct >= 55) { surState = 'ok'; say('warn', `The sur is mostly there, but it slips. About ${100 - inPct} in every hundred moments you were noticeably off the note, though usually close (${nearPct}% within a comfortable margin). Sing a little slower and listen to the tanpura before each phrase, not after.`); }
    else if (inPct >= 35) { surState = 'weak'; say('warn', `The sur is wandering today. Nearly half the time the note was not quite where it should be. Turn the tanpura up, slow everything down, and hold each swara until it sits before moving to the next.`); }
    else { surState = 'poor'; say('bad', `Today the sur was not settling. Do not worry about the raga for now; go back to Sa. Sing Sa with the tanpura for two full minutes, then Sa Re Sa, Sa Ga Sa, until each note locks in before you take the next.`); }

    // --- per swara ---
    const rows = SWARA_ORDER.filter((s) => this.per[s] && this.per[s].holds >= 2)
      .map((s) => { const p = this.per[s]; return { sw: s, holds: p.holds, dev: p.sumDev / p.holds, sd: p.sumSd / p.holds, avgDur: p.sumDur / p.holds }; });
    const steady = rows.filter((r) => Math.abs(r.dev) <= 10 && r.sd <= 18);
    const off = rows.filter((r) => Math.abs(r.dev) > 12).sort((a, b) => Math.abs(b.dev) - Math.abs(a.dev));
    const wobbly = rows.filter((r) => Math.abs(r.dev) <= 12 && r.sd > 22);
    if (steady.length) {
      const names = steady.map((r) => SWARA_NAMES[r.sw]);
      say('good', steady.find((r) => r.sw === 'S')
        ? `Your Sa is firm, and that is the foundation of everything. ${names.length > 1 ? listWords(names.filter((n) => n !== 'Sa')) + (names.length > 2 ? ' are' : ' is') + ' steady too.' : ''}`
        : `${listWords(names)} ${names.length > 1 ? 'are' : 'is'} steady. Good.`);
    }
    for (const r of off.slice(0, 3)) {
      const long = SWARA_LONG[r.sw], dirn = r.dev > 0 ? 'sharp' : 'flat', c = Math.round(Math.abs(r.dev));
      let s = `Your ${long} leans ${dirn}, ${amount(c)} (around ${c} cents ${r.dev > 0 ? 'above' : 'below'}), and it did so over ${r.holds} held notes, so it is a habit rather than an accident.`;
      if (raga && r.sw === raga.vadi) s += ` ${SWARA_NAMES[r.sw]} is the vadi of ${rn}, the note the whole raga leans on. Until ${SWARA_NAMES[r.sw]} is sure, it will not sound like ${rn}.`;
      else if (raga && r.sw === raga.samvadi) s += ` ${SWARA_NAMES[r.sw]} is the samvadi, the partner of ${SWARA_NAMES[raga.vadi]}; sing the two against each other and the ear will find it.`;
      else if (KOMAL.has(r.sw) && r.dev > 0) s += ` Komal swaras are easy to push up. Think of ${SWARA_NAMES[r.sw]} as sitting a little lower than you expect, and let it rest there.`;
      else if (r.sw === 'P' || r.sw === 'S') s += ` ${SWARA_NAMES[r.sw]} is in the tanpura; listen for the string and match it rather than aiming from the previous note.`;
      else s += r.dev > 0 ? ' Ease it down from the breath, not by pinching the throat.' : ' Lift it with more breath behind it; a flat note is usually an under-supported note.';
      say(c > 35 ? 'bad' : 'warn', s);
    }
    for (const r of wobbly.slice(0, 2)) {
      say('warn', `Your ${SWARA_LONG[r.sw]} is centred but it wobbles. You are leaving it before it has settled. Take a fuller breath, hold ${SWARA_NAMES[r.sw]} until the line stands still, and only then move.`);
    }

    // --- raga discipline ---
    const dirSlips = this._directionSlips(rctx);
    let strayed = false;
    if (rn) {
      if (this.outRaga.length) {
        strayed = true;
        const counts = {};
        for (const o of this.outRaga) { const k = o.sw + '>' + o.suggest; counts[k] = (counts[k] || 0) + 1; }
        const top = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 2);
        for (const [k, n] of top) {
          const [sw, sug] = k.split('>');
          const sameDegree = SWARA_NAMES[sw].toLowerCase().replace('^', '') === SWARA_NAMES[sug].toLowerCase().replace('^', '');
          let s = `${SWARA_LONG[sw]} crept in ${times(n)}. There is no ${SWARA_LONG[sw]} in ${rn}; what you were reaching for was ${SWARA_LONG[sug]}.`;
          if (sameDegree) s += ` Same degree, wrong shade. Sing ${SWARA_LONG[sug]} against the tanpura slowly until the ear knows which one belongs.`;
          say('bad', s);
        }
        if (raga && raga.guru) say('', `Remember: ${raga.guru}`);
      } else {
        say('good', `You stayed inside ${rn}; not one stray swara. That discipline comes first, and you have it.`);
      }
      for (const [sw, c] of Object.entries(dirSlips)) {
        if (c.up) {
          const idx = SWARA_ORDER.indexOf(sw);
          const below = [...SWARA_ORDER].reverse().find((s) => rctx.up.has(s) && SWARA_ORDER.indexOf(s) < idx) || 'S';
          const above = SWARA_ORDER.find((s) => rctx.up.has(s) && SWARA_ORDER.indexOf(s) > idx) || 'S';
          say('warn', `In ${rn}, ${SWARA_NAMES[sw]} comes only on the way down, but you touched it while climbing ${times(c.up)}. Going up, step from ${SWARA_NAMES[below]} straight to ${SWARA_NAMES[above]}${above === 'S' ? "'" : ''}.`);
        }
        if (c.down) say('warn', `${SWARA_NAMES[sw]} belongs to the ascent in ${rn}; you used it coming down ${times(c.down)}. Follow the avaroha as written: ${raga.avaroha}.`);
      }

      // coverage: swaras of the raga never visited, the upper Sa, the vadi passed over quickly
      const never = [...rctx.set].filter((s) => !this.per[s]);
      const taarSa = this.per.S && this.per.S.octs.has(1);
      if (dur > 60 && never.length && never.length < rctx.set.size) say('', `You never went to ${listWords(never.map((s) => SWARA_LONG[s]))}. A raga needs its whole body; take the aroha and avaroha once through, slowly.`);
      if (dur > 90 && !taarSa) say('', `You stayed in the middle octave; the taar Sa was never touched. ${rn} opens up when you reach the upper Sa. Climb to it once, hold it, and come back down.`);
      if (raga && raga.vadi && this.per[raga.vadi] && this.per[raga.vadi].holds >= 3 && this.per[raga.vadi].sumDur / this.per[raga.vadi].holds < 0.6) {
        say('', `You passed over ${SWARA_LONG[raga.vadi]} quickly every time. It is the vadi of ${rn}; sit on it, let it ring, and the raga will show itself.`);
      }
    }

    // --- homework ---
    const worst = off[0];
    if (surState === 'poor') say('', 'Homework: nothing but Sa, Pa and Sa\' with the tanpura, one minute each, eyes on the line. The raga can wait a day.');
    else if (worst && Math.abs(worst.dev) > 20) say('', `Homework: hold ${SWARA_LONG[worst.sw]} against the tanpura for eight slow counts, ten times, ${worst.dev > 0 ? 'easing it down' : 'lifting it'} until the trace sits on the line. Then sing ${SWARA_NAMES[worst.sw]} inside the phrase ${raga && raga.pakad ? raga.pakad : 'of the aroha'}.`);
    else if (strayed && raga && raga.pakad) say('', `Homework: the pakad, slowly, ten times: ${raga.pakad}. Say the swara names aloud first, then sing them. That is how the raga's shape gets into the ear.`);
    else if (raga && raga.pakad) say('', `Hold on to the pakad: ${raga.pakad}. Begin and end every sitting with it, and let ${SWARA_LONG[raga.vadi]} ring a little longer than the rest.`);
    else if (!rn) say('', 'Pick a raga next time and I can tell you about more than the sur.');
    return L;
  }
}

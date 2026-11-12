// Synthesised tabla with a look-ahead scheduler. Dayan is tuned to Sa, bayan an octave or two below.
import { TAALS, matraMeta } from './taals.js';

const STROKES = {
  Dha: [{ at: 0, hits: ['na', 'ge'] }],
  Dhin: [{ at: 0, hits: ['tin', 'ge'] }],
  Dhi: [{ at: 0, hits: ['tin', 'ge'] }],
  Tin: [{ at: 0, hits: ['tin'] }],
  Ta: [{ at: 0, hits: ['na'] }],
  Na: [{ at: 0, hits: ['na'] }],
  Tu: [{ at: 0, hits: ['tun'] }],
  Tun: [{ at: 0, hits: ['tun'] }],
  Ti: [{ at: 0, hits: ['te'] }],
  Te: [{ at: 0, hits: ['te'] }],
  Ka: [{ at: 0, hits: ['ke'] }],
  Ke: [{ at: 0, hits: ['ke'] }],
  Kat: [{ at: 0, hits: ['kat'] }],
  Ge: [{ at: 0, hits: ['ge'] }],
  Dhage: [{ at: 0, hits: ['na', 'ge'] }, { at: 0.5, hits: ['ge'] }],
  Tirkit: [{ at: 0, hits: ['te'] }, { at: 0.25, hits: ['te'] }, { at: 0.5, hits: ['ke'] }, { at: 0.75, hits: ['te'] }],
  '-': [],
};

export class Tabla {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0.7; this.out.connect(dest);
    this.noise = this._noiseBuffer();
    this.dayan = 220; this.bayan = 90;
    this.taal = TAALS[0]; this.meta = matraMeta(this.taal);
    this.bpm = 80; this.running = false; this.events = [];
  }
  _noiseBuffer() {
    const b = this.ctx.createBuffer(1, this.ctx.sampleRate, this.ctx.sampleRate);
    const d = b.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    return b;
  }
  setSa(hz) {
    let f = hz; while (f < 165) f *= 2; while (f > 440) f /= 2; this.dayan = f;
    let b = hz; while (b > 125) b /= 2; while (b < 62) b *= 2; this.bayan = b;
  }
  setTaal(taal) { this.taal = taal; this.meta = matraMeta(taal); if (this.running) { this.nextIdx = 0; } }
  setVolume(v) { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  get matraDur() { return 60 / this.bpm; }
  get avartanDur() { return this.matraDur * this.taal.bols.length; }

  start(at) {
    if (this.running) return;
    this.running = true; this.nextIdx = 0; this.events = [];
    this.nextTime = at ?? this.ctx.currentTime + 0.12;
    this.timer = setInterval(() => this._tick(), 25); this._tick();
  }
  stop() { this.running = false; clearInterval(this.timer); }

  _tick() {
    const horizon = this.ctx.currentTime + 0.18;
    const n = this.taal.bols.length;
    while (this.running && this.nextTime < horizon) {
      const m = this.nextIdx % n;
      this._playMatra(m, this.nextTime);
      this.events.push({ idx: this.nextIdx, matra: m, t: this.nextTime });
      if (this.events.length > 400) this.events.splice(0, 200);
      this.nextIdx++; this.nextTime += this.matraDur;
    }
  }

  // Matra currently sounding at time t.
  positionAt(t) {
    const ev = this.events;
    for (let k = ev.length - 1; k >= 0; k--) if (ev[k].t <= t) return { ...ev[k], frac: (t - ev[k].t) / this.matraDur };
    return null;
  }
  // Closest matra boundary (past or scheduled) to t.
  nearestMatra(t) {
    let best = null;
    const consider = (ev) => { const d = t - ev.t; if (!best || Math.abs(d) < Math.abs(best.offset)) best = { offset: d, matra: ev.matra, idx: ev.idx, t: ev.t }; };
    for (const ev of this.events) consider(ev);
    if (this.running) consider({ idx: this.nextIdx, matra: this.nextIdx % this.taal.bols.length, t: this.nextTime });
    return best;
  }
  // Next sam at least `minAhead` seconds in the future.
  nextSamTime(minAhead = 0.8) {
    const n = this.taal.bols.length, now = this.ctx.currentTime;
    for (const ev of this.events) if (ev.matra === 0 && ev.t >= now + minAhead) return ev.t;
    let idx = this.nextIdx, t = this.nextTime;
    while (idx % n !== 0 || t < now + minAhead) { idx++; t += this.matraDur; }
    return t;
  }

  _playMatra(m, t) {
    const bol = this.taal.bols[m];
    const meta = this.meta[m];
    const vel = m === 0 ? 1.0 : meta.startsVibhag ? 0.9 : 0.78;
    const strokes = STROKES[bol] || STROKES.Na;
    for (const s of strokes) for (const h of s.hits) this[h](t + s.at * this.matraDur, vel);
  }

  // --- stroke synthesis ---
  _partials(t, f, parts, vel) {
    const ctx = this.ctx;
    for (const [r, a, d] of parts) {
      const o = ctx.createOscillator(); o.frequency.value = f * r;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(a * vel, t + 0.003); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
      o.connect(g).connect(this.out); o.start(t); o.stop(t + d + 0.05);
    }
  }
  _noise(t, dur, type, freq, q, vel) {
    const ctx = this.ctx;
    const s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = type; f.frequency.value = freq; f.Q.value = q;
    const g = ctx.createGain(); g.gain.setValueAtTime(vel, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(this.out); s.start(t, Math.random() * 0.8); s.stop(t + dur + 0.02);
  }
  na(t, v) {  // open rim stroke: bright, rings at Sa's harmonics
    this._noise(t, 0.02, 'highpass', 3000, 0.7, 0.22 * v);
    this._partials(t, this.dayan, [[1, 0.35, 0.55], [2, 0.55, 0.45], [3, 0.5, 0.5], [4, 0.3, 0.35], [5, 0.2, 0.25], [6.1, 0.1, 0.15]], 0.5 * v);
  }
  tin(t, v) { // ringing centre stroke, rounder
    this._noise(t, 0.012, 'highpass', 2500, 0.7, 0.1 * v);
    this._partials(t, this.dayan, [[1, 0.7, 0.6], [2, 0.35, 0.4], [3, 0.15, 0.25]], 0.5 * v);
  }
  tun(t, v) { // open, long ring
    this._partials(t, this.dayan, [[1, 0.9, 1.0], [2, 0.3, 0.6], [3, 0.12, 0.3]], 0.55 * v);
  }
  te(t, v) {  // closed dayan slap
    this._noise(t, 0.05, 'bandpass', 1800, 1.2, 0.7 * v);
    this._partials(t, this.dayan, [[1, 0.15, 0.06], [3, 0.1, 0.05]], v);
  }
  ke(t, v) {  // closed bayan slap
    this._noise(t, 0.07, 'lowpass', 500, 0.8, 0.9 * v);
    this._partials(t, this.bayan, [[1, 0.3, 0.08]], v);
  }
  kat(t, v) { this.ke(t, v * 1.1); this._noise(t, 0.04, 'bandpass', 1200, 1, 0.3 * v); }
  ge(t, v) {  // open bayan with pitch glide (gumki)
    const ctx = this.ctx, b = this.bayan;
    const o = ctx.createOscillator();
    o.frequency.setValueAtTime(b * 1.5, t);
    o.frequency.exponentialRampToValueAtTime(b, t + 0.06);
    o.frequency.linearRampToValueAtTime(b * 1.1, t + 0.45);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.9 * v, t + 0.005); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.55);
    o.connect(g).connect(this.out); o.start(t); o.stop(t + 0.6);
    this._noise(t, 0.03, 'lowpass', 250, 0.7, 0.5 * v);
  }
}

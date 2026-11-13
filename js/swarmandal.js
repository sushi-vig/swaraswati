// Swarmandal: a small harp whose strings are tuned to the raga's swaras. Strummed up or down.
export class Swarmandal {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0.5;
    this.body = ctx.createBiquadFilter(); this.body.type = 'peaking'; this.body.frequency.value = 1800; this.body.Q.value = 0.8; this.body.gain.value = 2.5;
    this.body.connect(this.out); this.out.connect(dest);
    this.wave = this._wave();
    this.hz = []; this.dir = 1; this.plucks = 0;
  }
  _wave() {
    const N = 24, real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) imag[n] = Math.pow(1 / n, 1.05) * (n === 1 ? 1 : 0.8);
    return this.ctx.createPeriodicWave(real, imag);
  }
  // cents: list of swara positions relative to Sa (may span several octaves), ascending.
  tune(saHz, cents) { this.hz = cents.map((c) => saHz * Math.pow(2, c / 1200)); }
  setVolume(v) { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  // Strum all strings starting at time t. gapMs between strings; dir 1 = up, -1 = down, 0 = alternate.
  strum(t = this.ctx.currentTime + 0.02, gapMs = 45, dir = 0) {
    if (!this.hz.length) return;
    const d = dir === 0 ? (this.dir = -this.dir) : dir;
    const order = d > 0 ? this.hz : [...this.hz].reverse();
    order.forEach((f, i) => this._pluck(f, t + (i * gapMs) / 1000, 0.55 + 0.25 * (i / order.length)));
    return t + (order.length * gapMs) / 1000;
  }
  _pluck(f, t, amp) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.setPeriodicWave(this.wave); o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 6;
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.8;
    lp.frequency.setValueAtTime(Math.min(9000, f * 12), t);
    lp.frequency.exponentialRampToValueAtTime(Math.min(2500, f * 3), t + 1.4);
    const g = ctx.createGain();
    const decay = Math.max(1.2, Math.min(3.2, 900 / f));
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.004);
    g.gain.exponentialRampToValueAtTime(0.0004, t + decay);
    o.connect(lp).connect(g).connect(this.body);
    o.start(t); o.stop(t + decay + 0.05);
    this.plucks++;
  }
}

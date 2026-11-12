// Synthesised 4-string tanpura: (Pa|Ma) Sa Sa Sa(kharaj), with a swelling jawari buzz.
export class Tanpura {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0.3;
    this.body = ctx.createBiquadFilter(); this.body.type = 'peaking'; this.body.frequency.value = 320; this.body.Q.value = 0.7; this.body.gain.value = 3;
    this.body.connect(this.out); this.out.connect(dest);
    this.wave = this._wave();
    this.sa = 220; this.fifth = 'P'; this.running = false; this.tempo = 1.0;
  }
  _wave() {
    const N = 40, real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) imag[n] = Math.pow(1 / n, 0.7) * (n % 2 ? 1 : 0.85);
    return this.ctx.createPeriodicWave(real, imag);
  }
  configure(saHz, fifth) { this.sa = saHz; this.fifth = fifth || 'P'; }
  setVolume(v) { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  start() {
    if (this.running) return;
    this.running = true; this.step = 0; this.next = this.ctx.currentTime + 0.05;
    this.timer = setInterval(() => this._tick(), 60); this._tick();
  }
  stop() { this.running = false; clearInterval(this.timer); }
  _tick() {
    const horizon = this.ctx.currentTime + 0.4;
    while (this.running && this.next < horizon) {
      const sa = this.sa;
      const low = this.fifth === 'm' ? sa * 2 / 3 : this.fifth === 'N' ? sa * 15 / 16 : sa * 3 / 4;
      const seq = [low, sa, sa, sa / 2];
      const gaps = [0.72, 0.72, 0.72, 1.15];
      const i = this.step % 4;
      this._pluck(seq[i], this.next, i === 3 ? 1.0 : i === 0 ? 0.8 : 0.9);
      this.next += gaps[i] / this.tempo;
      this.step++;
    }
  }
  _pluck(f, t, amp) {
    const ctx = this.ctx;
    const o = ctx.createOscillator(); o.setPeriodicWave(this.wave); o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 3;
    // Jawari: brightness swells after the pluck, then settles.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.2;
    lp.frequency.setValueAtTime(700, t);
    lp.frequency.linearRampToValueAtTime(Math.min(5000, f * 14), t + 0.6);
    lp.frequency.exponentialRampToValueAtTime(600, t + 3.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, t + 4.8);
    o.connect(lp).connect(g).connect(this.body);
    o.start(t); o.stop(t + 4.9);
  }
}

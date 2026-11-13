// Synthesised 4-string tanpura: (Pa|Ma|Ni|…) Sa Sa Sa(kharaj), with a swelling jawari buzz.
// Two voicings (male/female bodies) plus a low register; per-instance fine tune, pluck speed, pan and jawari.

// First-string choices, as ratios to Sa (string sits below the middle Sa).
export const FIRST_STRING = {
  P: { label: 'Pa', ratio: 3 / 4 }, m: { label: 'Ma', ratio: 2 / 3 }, N: { label: 'Ni', ratio: 15 / 16 }, n: { label: 'komal Ni', ratio: 9 / 10 },
  D: { label: 'Dha', ratio: 5 / 6 }, G: { label: 'Ga', ratio: 5 / 8 }, S: { label: 'Sa (no fifth)', ratio: 1 },
};
export const VOICES = {
  female: { label: 'Female', rolloff: 0.8, body: 420, bodyGain: 3, jawari: 16, decay: 4.2, octave: 0 },
  male: { label: 'Male', rolloff: 0.62, body: 230, bodyGain: 4.5, jawari: 12, decay: 5.4, octave: 0 },
  low: { label: 'Male, octave below', rolloff: 0.6, body: 160, bodyGain: 5, jawari: 10, decay: 6.0, octave: -1 },
};

export class Tanpura {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0.3;
    this.pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
    this.body = ctx.createBiquadFilter(); this.body.type = 'peaking'; this.body.frequency.value = 320; this.body.Q.value = 0.7; this.body.gain.value = 3;
    if (this.pan) { this.body.connect(this.pan).connect(this.out); } else this.body.connect(this.out);
    this.out.connect(dest);
    this.waves = {};
    this.sa = 220; this.fifth = 'P'; this.running = false; this.tempo = 1.0; this.fine = 0; this.jawariAmt = 0.6;
    this.setVoice('female');
  }
  _wave(rolloff) {
    const key = String(rolloff);
    if (this.waves[key]) return this.waves[key];
    const N = 40, real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) imag[n] = Math.pow(1 / n, rolloff) * (n % 2 ? 1 : 0.85);
    return (this.waves[key] = this.ctx.createPeriodicWave(real, imag));
  }
  setVoice(id) {
    this.voice = VOICES[id] || VOICES.female; this.voiceId = this.voice === VOICES[id] ? id : 'female';
    this.wave = this._wave(this.voice.rolloff);
    this.body.frequency.setTargetAtTime(this.voice.body, this.ctx.currentTime, 0.1);
    this.body.gain.setTargetAtTime(this.voice.bodyGain, this.ctx.currentTime, 0.1);
  }
  // opts: { fifth, fine (cents), tempo, pan (-1..1), jawari (0..1), voice }
  configure(saHz, fifth, opts = {}) {
    this.sa = saHz; this.fifth = fifth || 'P';
    if (opts.voice) this.setVoice(opts.voice);
    if (opts.fine != null) this.fine = opts.fine;
    if (opts.tempo != null) this.tempo = opts.tempo;
    if (opts.jawari != null) this.jawariAmt = opts.jawari;
    if (opts.pan != null && this.pan) this.pan.pan.setTargetAtTime(opts.pan, this.ctx.currentTime, 0.05);
  }
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
      const sa = this.sa * Math.pow(2, this.fine / 1200 + this.voice.octave);
      const low = sa * (FIRST_STRING[this.fifth] || FIRST_STRING.P).ratio;
      const seq = [low, sa, sa, sa / 2];
      const gaps = [0.72, 0.72, 0.72, 1.15];
      const i = this.step % 4;
      this._pluck(seq[i], this.next, i === 3 ? 1.0 : i === 0 ? 0.8 : 0.9);
      this.next += gaps[i] / this.tempo;
      this.step++;
    }
  }
  _pluck(f, t, amp) {
    const ctx = this.ctx, v = this.voice;
    const o = ctx.createOscillator(); o.setPeriodicWave(this.wave); o.frequency.value = f; o.detune.value = (Math.random() - 0.5) * 3;
    // Jawari: brightness swells after the pluck, then settles. jawariAmt scales how far it opens.
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 1.0 + this.jawariAmt * 0.6;
    const peak = Math.min(6000, f * (4 + v.jawari * this.jawariAmt));
    lp.frequency.setValueAtTime(Math.min(700, peak), t);
    lp.frequency.linearRampToValueAtTime(peak, t + 0.6);
    lp.frequency.exponentialRampToValueAtTime(Math.min(600, peak), t + 3.8);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0005, t + v.decay);
    o.connect(lp).connect(g).connect(this.body);
    o.start(t); o.stop(t + v.decay + 0.1);
  }
}

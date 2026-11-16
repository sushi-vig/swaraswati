// Shruti petti (sruti box): a continuous reed drone of Sa, Pa (or Ma) and the lower Sa, the sound Carnatic
// singers practise against. Synthesised: each note is three slightly detuned reed waves through a body filter,
// with a slow bellows tremolo and a breath of noise so it does not sound like a test tone.

// Which notes sound, as ratios to Sa.
export const SHRUTI_MODES = {
  SPl: { label: 'Sa · Pa · lower Sa', notes: [[1, 1], [1.5, 0.8], [0.5, 0.9]] },
  SMl: { label: 'Sa · Ma · lower Sa', notes: [[1, 1], [4 / 3, 0.8], [0.5, 0.9]] },
  SPu: { label: 'Sa · Pa · upper Sa', notes: [[1, 1], [1.5, 0.8], [2, 0.55]] },
  SP: { label: 'Sa · Pa', notes: [[1, 1], [1.5, 0.85]] },
  S: { label: 'Sa only', notes: [[1, 1], [0.5, 0.7]] },
};

export class ShrutiPetti {
  constructor(ctx, dest) {
    this.ctx = ctx;
    this.out = ctx.createGain(); this.out.gain.value = 0.35;
    this.body = ctx.createBiquadFilter(); this.body.type = 'lowpass'; this.body.Q.value = 0.7; this.body.frequency.value = 2200;
    this.formant = ctx.createBiquadFilter(); this.formant.type = 'peaking'; this.formant.frequency.value = 900; this.formant.Q.value = 1.2; this.formant.gain.value = 4;
    this.body.connect(this.formant).connect(this.out); this.out.connect(dest);
    // bellows: a slow, shallow tremolo on the whole box
    this.trem = ctx.createGain(); this.trem.gain.value = 1;
    this.lfo = ctx.createOscillator(); this.lfo.frequency.value = 5.3; this.lfoAmt = ctx.createGain(); this.lfoAmt.gain.value = 0.035;
    this.lfo.connect(this.lfoAmt).connect(this.trem.gain); this.lfo.start();
    this.trem.connect(this.body);
    this.voices = []; this.running = false;
    this.sa = 220; this.mode = 'SPl'; this.fine = 0; this.tone = 0.5;
    this.wave = this._reedWave();
  }
  _reedWave() {
    const N = 32, real = new Float32Array(N), imag = new Float32Array(N);
    for (let n = 1; n < N; n++) imag[n] = (1 / n) * (n % 2 ? 1 : 0.6) * Math.exp(-n / 14); // reed: all harmonics, odd ones stronger
    return this.ctx.createPeriodicWave(real, imag);
  }
  configure(saHz, opts = {}) {
    this.sa = saHz;
    if (opts.mode && SHRUTI_MODES[opts.mode]) this.mode = opts.mode;
    if (opts.fine != null) this.fine = opts.fine;
    if (opts.tone != null) this.tone = opts.tone;
    this.body.frequency.setTargetAtTime(900 + this.tone * 3600, this.ctx.currentTime, 0.1);
    this.formant.gain.setTargetAtTime(2 + this.tone * 4, this.ctx.currentTime, 0.1);
    if (this.running) this._retune();
  }
  setVolume(v) { this.out.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05); }
  _freqs() {
    const sa = this.sa * Math.pow(2, this.fine / 1200);
    return SHRUTI_MODES[this.mode].notes.map(([r, a]) => [sa * r, a]);
  }
  _retune() {
    const fs = this._freqs(), t = this.ctx.currentTime;
    if (fs.length !== this.voices.length) { this._stopVoices(0.2); this._startVoices(); return; }
    fs.forEach(([f], i) => this.voices[i].oscs.forEach((o, k) => o.frequency.setTargetAtTime(f * this.voices[i].det[k], t, 0.08)));
  }
  _startVoices() {
    const ctx = this.ctx, t = ctx.currentTime;
    this.voices = this._freqs().map(([f, amp]) => {
      const det = [1, Math.pow(2, 3.5 / 1200), Math.pow(2, -2.8 / 1200)];
      const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(amp * 0.33, t + 0.6);
      const oscs = det.map((d) => { const o = ctx.createOscillator(); o.setPeriodicWave(this.wave); o.frequency.value = f * d; o.connect(g); o.start(t); return o; });
      g.connect(this.trem);
      return { oscs, g, det };
    });
    // breath: a whisper of filtered noise under the reeds
    const len = ctx.sampleRate * 2, buf = ctx.createBuffer(1, len, ctx.sampleRate), d = buf.getChannelData(0);
    let b = 0; for (let i = 0; i < len; i++) { const w = Math.random() * 2 - 1; b = 0.985 * b + 0.015 * w; d[i] = b * 6; }
    const src = ctx.createBufferSource(); src.buffer = buf; src.loop = true;
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 1200; bp.Q.value = 0.5;
    const ng = ctx.createGain(); ng.gain.setValueAtTime(0, t); ng.gain.linearRampToValueAtTime(0.012, t + 0.8);
    src.connect(bp).connect(ng).connect(this.trem); src.start(t);
    this.breath = { src, g: ng };
  }
  _stopVoices(fade = 0.35) {
    const t = this.ctx.currentTime;
    for (const v of this.voices) { v.g.gain.cancelScheduledValues(t); v.g.gain.setTargetAtTime(0, t, fade / 3); v.oscs.forEach((o) => o.stop(t + fade + 0.1)); }
    if (this.breath) { this.breath.g.gain.setTargetAtTime(0, t, fade / 3); this.breath.src.stop(t + fade + 0.1); }
    this.voices = []; this.breath = null;
  }
  start() { if (this.running) return; this.running = true; this._startVoices(); }
  stop() { if (!this.running) return; this.running = false; this._stopVoices(); }
}

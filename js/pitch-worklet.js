// AudioWorklet: captures the mic, cancels the app's own sound from it, and ships chunks to the analysis worker.
//
// Input 0 is the microphone, input 1 is the app's master output (tanpura, shruti petti, swarmandal, drum). Both
// are low-passed and decimated to ~16 kHz, then an NLMS adaptive filter (128 ms of taps) learns the speaker-to-mic
// path and subtracts the estimated bleed from the mic. Unlike the browser's echo canceller it never mutes the mic:
// a loud drum stroke is subtracted, not gated, so the voice sung over it survives. Pitch detection downstream only
// needs the band below a few kHz, so 16 kHz costs nothing.
//
// Messages in: { port } (direct channel to the worker), { aec: bool }, { reset: true }.
// Messages out (main port): { type: 'aec', erle, mic, ref } about twice a second.

const TAPS = 2048;            // at 16 kHz: 128 ms, enough for output latency plus the first room reflections
const MU = 0.6;               // NLMS step; scaled down (to a quarter) while the voice dominates the error
const CHUNK = 512;            // samples per message to the worker (32 ms at 16 kHz)

class Biquad {                // 2nd-order lowpass, used as the anti-alias filter before decimation
  constructor(fc, sr) {
    const w = 2 * Math.PI * fc / sr, c = Math.cos(w), s = Math.sin(w), a = s / (2 * 0.707), a0 = 1 + a;
    this.b0 = (1 - c) / 2 / a0; this.b1 = (1 - c) / a0; this.b2 = this.b0; this.a1 = -2 * c / a0; this.a2 = (1 - a) / a0;
    this.z1 = 0; this.z2 = 0;
  }
  run(x) { const y = this.b0 * x + this.z1; this.z1 = this.b1 * x - this.a1 * y + this.z2; this.z2 = this.b2 * x - this.a2 * y; return y; }
}

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.D = Math.max(1, Math.round(sampleRate / 16000));
    this.rate = sampleRate / this.D;
    this.lpM = [new Biquad(5500, sampleRate), new Biquad(5500, sampleRate)];
    this.lpR = [new Biquad(5500, sampleRate), new Biquad(5500, sampleRate)];
    this.phase = 0;
    this.aec = true; this.mu = MU; this.floor = 0.25;
    this.w = new Float32Array(TAPS);
    this.xb = new Float32Array(TAPS * 2); // reference history, written twice so the last TAPS samples are contiguous
    this.xi = 0; this.xpow = 0;
    this.em = 0; this.ey = 0; this.ee = 0; this.er = 0; // smoothed energies: mic, echo estimate, error, reference
    this.chunk = new Float32Array(CHUNK); this.idx = 0;
    this.workerPort = null; this.statCount = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.port) this.workerPort = d.port;
      if (typeof d.aec === 'boolean') { this.aec = d.aec; if (!d.aec) this.w.fill(0); }
      if (d.mu) this.mu = d.mu; if (d.floor != null) this.floor = d.floor;
      if (d.reset) { this.w.fill(0); this.xb.fill(0); this.xpow = 0; this.em = this.ey = this.ee = this.er = 0; }
    };
  }
  _push(x, endTimeOfSample) {
    this.chunk[this.idx++] = x;
    if (this.idx === CHUNK) {
      (this.workerPort || this.port).postMessage({ type: 'samples', samples: this.chunk, endTime: endTimeOfSample }, [this.chunk.buffer]);
      this.chunk = new Float32Array(CHUNK); this.idx = 0;
    }
  }
  process(inputs) {
    const mic = inputs[0] && inputs[0][0], ref = inputs[1] && inputs[1][0];
    if (!mic) return true;
    const n = mic.length, w = this.w, xb = this.xb;
    for (let i = 0; i < n; i++) {
      // anti-alias both signals, decimate by D
      let m = this.lpM[1].run(this.lpM[0].run(mic[i]));
      let r = ref ? this.lpR[1].run(this.lpR[0].run(ref[i])) : 0;
      if (++this.phase < this.D) continue;
      this.phase = 0;
      // reference history: newest sample at xb[xi] and xb[xi + TAPS]; the window xb[xi .. xi + TAPS) is contiguous
      this.xi = this.xi === 0 ? TAPS - 1 : this.xi - 1;
      const old = xb[this.xi + TAPS]; // sample leaving the window (it sat at xi+TAPS before the overwrite below shifts the window)
      xb[this.xi] = r; xb[this.xi + TAPS] = r;
      this.xpow += r * r - old * old; if (this.xpow < 0) this.xpow = 0;
      let out = m;
      if (this.aec && ref) {
        const xi = this.xi;
        let y = 0;
        for (let k = 0; k < TAPS; k++) y += w[k] * xb[xi + k];
        const e = m - y;
        // smoothed energies for the step-size control and the readout
        const a = 0.002;
        this.em += a * (m * m - this.em); this.ey += a * (y * y - this.ey); this.ee += a * (e * e - this.ee); this.er += a * (r * r - this.er);
        // adapt: full step when the echo estimate explains the mic, a tenth of it when the voice dominates the error
        if (this.xpow > 1e-7) {
          const ratio = this.ey / (this.ey + this.ee + 1e-12);
          const g = this.mu * Math.max(this.floor, ratio) * e / (this.xpow + 1e-6);
          if (g !== 0) for (let k = 0; k < TAPS; k++) w[k] += g * xb[xi + k];
        }
        out = e;
      }
      this._push(out, currentTime + (i + 1) / sampleRate);
    }
    if (++this.statCount >= 190) { // ~0.5 s at 48 kHz / 128-frame blocks
      this.statCount = 0;
      const erle = this.em > 1e-10 && this.ee > 1e-12 ? 10 * Math.log10(this.em / this.ee) : 0;
      this.port.postMessage({ type: 'aec', on: this.aec && !!ref, erle, mic: Math.sqrt(this.em), ref: Math.sqrt(this.er), rate: this.rate });
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);

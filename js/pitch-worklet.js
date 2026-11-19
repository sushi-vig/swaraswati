// AudioWorklet: captures the mic, cancels the app's own sound from it, and ships chunks to the analysis worker.
//
// Input 0 is the microphone, input 1 is the app's master output (tanpura, shruti petti, swarmandal, drum). Both
// are low-passed and decimated to ~16 kHz, then an NLMS adaptive filter (128 ms of taps) learns the speaker-to-mic
// path and subtracts the estimated bleed from the mic. Unlike the browser's echo canceller it never mutes the mic:
// a loud drum stroke is subtracted, not gated, so the voice sung over it survives. Pitch detection downstream only
// needs the band below a few kHz, so 16 kHz costs nothing.
//
// Messages in: { port } (direct channel to the worker), { aec: bool }, { reset: true }, { diag: bool } (also stream the
// decimated mic, reference and cleaned signal to the main thread, for the diagnostic capture).
// Messages out (main port): { type: 'aec', on, active, converged, erle, mic, ref, rate } about twice a second.
// `active` says whether the cancelled signal is actually in use: it is, only while it proves to carry less energy
// than the raw mic. Otherwise the raw mic goes to the detector untouched.

const TAPS = 2048;            // at 16 kHz: 128 ms, enough for output latency plus the first room reflections
const MU = 0.6;               // NLMS step; scaled by how much of the mic the echo estimate explains (see process)
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
    this.aec = true; this.mu = MU; this.floor = 0.1;
    this.w = new Float32Array(TAPS);
    this.xb = new Float32Array(TAPS * 2); // reference history, written twice so the last TAPS samples are contiguous
    this.xi = 0; this.xpow = 0;
    this.em = 0; this.ey = 0; this.ee = 0; this.er = 0; // fast energies (~30 ms): mic, echo estimate, error, reference
    this.sm = 0; this.se = 0;                           // slow energies (~1 s): mic and error, for the proof-of-benefit test
    this.converged = false;                             // has the filter ever removed 3 dB over a second?
    this.mix = 0;                                       // 0 = raw mic goes out, 1 = cancelled signal goes out; ramps
    this.chunk = new Float32Array(CHUNK); this.idx = 0;
    this.workerPort = null; this.statCount = 0;
    this.diag = false; this.dm = null; this.dr = null; this.de = null; this.di = 0;
    this.port.onmessage = (e) => {
      const d = e.data || {};
      if (d.port) this.workerPort = d.port;
      if (typeof d.aec === 'boolean') { this.aec = d.aec; if (!d.aec) this._reset(); }
      if (d.mu) this.mu = d.mu; if (d.floor != null) this.floor = d.floor;
      if (typeof d.diag === 'boolean') { this.diag = d.diag; this.di = 0; if (d.diag) { this.dm = new Float32Array(CHUNK); this.dr = new Float32Array(CHUNK); this.de = new Float32Array(CHUNK); } }
      if (d.reset) this._reset();
    };
  }
  _reset() { this.w.fill(0); this.xb.fill(0); this.xpow = 0; this.em = this.ey = this.ee = this.er = 0; this.sm = this.se = 0; this.converged = false; this.mix = 0; }
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
      const old = xb[this.xi + TAPS];
      xb[this.xi] = r; xb[this.xi + TAPS] = r;
      this.xpow += r * r - old * old; if (this.xpow < 0) this.xpow = 0;
      let out = m;
      if (this.aec && ref) {
        const xi = this.xi;
        let y = 0;
        for (let k = 0; k < TAPS; k++) y += w[k] * xb[xi + k];
        const e = m - y;
        const a = 0.002, b = 0.00006;
        this.em += a * (m * m - this.em); this.ey += a * (y * y - this.ey); this.ee += a * (e * e - this.ee); this.er += a * (r * r - this.er);
        this.sm += b * (m * m - this.sm); this.se += b * (e * e - this.se);
        // Proof of benefit: the cancelled signal is used only while it carries at least 1 dB less energy than the raw
        // mic over the last second. A filter with nothing to cancel (headphones, a far mic) is then bypassed, so its
        // adaptation noise never reaches the detector. The two are crossfaded over ~60 ms to avoid clicks.
        const helping = this.sm > 1e-9 && this.se < this.sm * 0.79;
        if (helping && this.se < this.sm * 0.5) this.converged = true;
        this.mix += ((helping ? 1 : 0) - this.mix) * 0.001;
        // Adaptation. ratio = how much of the mic the echo estimate explains. Before convergence adapt at a tenth of
        // full speed even when the voice dominates, so a real echo path is found within seconds. Once converged, freeze
        // while the voice dominates (double talk) so a sustained note on a drone's pitch is not learned as "echo".
        if (this.xpow > 1e-7) {
          const ratio = this.ey / (this.ey + this.ee + 1e-12);
          let step = this.converged ? (ratio < 0.2 ? 0 : ratio) : Math.max(this.floor, ratio);
          if (step > 0) {
            const g = this.mu * step * e / (this.xpow + 1e-6);
            for (let k = 0; k < TAPS; k++) w[k] += g * xb[xi + k];
          }
        }
        out = m + this.mix * (e - m);
      }
      this._push(out, currentTime + (i + 1) / sampleRate);
      if (this.diag) {
        this.dm[this.di] = m; this.dr[this.di] = r; this.de[this.di] = out;
        if (++this.di === CHUNK) {
          this.port.postMessage({ type: 'diag', m: this.dm, r: this.dr, e: this.de, endTime: currentTime + (i + 1) / sampleRate }, [this.dm.buffer, this.dr.buffer, this.de.buffer]);
          this.dm = new Float32Array(CHUNK); this.dr = new Float32Array(CHUNK); this.de = new Float32Array(CHUNK); this.di = 0;
        }
      }
    }
    if (++this.statCount >= 190) { // ~0.5 s at 48 kHz / 128-frame blocks
      this.statCount = 0;
      // A real speaker-to-mic path is compact: most of the filter's energy sits in a few blocks of taps around the
      // delay. A filter that is quietly cancelling a sung note on the drone's own pitch is a long sinusoid spread evenly
      // over every tap. If the "helping" filter is that diffuse, it is eating the voice: throw it away.
      let total = 0, peak = 0;
      for (let b0 = 0; b0 < TAPS; b0 += 64) { let bsum = 0; for (let k = b0; k < b0 + 64; k++) bsum += w[k] * w[k]; total += bsum; if (bsum > peak) peak = bsum; }
      this.compact = total > 0 ? peak / total : 1;
      if (this.mix > 0.5 && total > 0 && this.compact < 0.12) { this.w.fill(0); this.sm = this.se = 0; this.mix = 0; this.converged = false; this.discarded = (this.discarded || 0) + 1; }
      const erle = this.sm > 1e-10 && this.se > 1e-12 ? 10 * Math.log10(this.sm / this.se) : 0;
      this.port.postMessage({ type: 'aec', on: this.aec && !!ref, active: this.mix > 0.5, converged: this.converged, compact: this.compact, discarded: this.discarded || 0, erle, mic: Math.sqrt(this.em), ref: Math.sqrt(this.er), rate: this.rate });
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);

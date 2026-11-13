// Recorded tanpura strings. Loads single-string plucks from samples/tanpura/, measures each file's
// actual pitch, and plays the nearest string pitch-shifted to the frequency asked for.
// Files are optional: if none are present the tanpuras keep using their synthesised voices.

// Each role lists the names it may be saved under: the file as Freesound downloads it (tried first), or a short name.
// `pc` is the pitch class (semitones above C) printed in the recording's title; the octave is measured.
const STRINGS = [
  { role: 'sa', pc: 1, names: ['416605__luckylittleraven__tanpura-note-c-sharp.wav', 'sa.wav'] },
  { role: 'pa', pc: 8, names: ['416598__luckylittleraven__tanpura-note-g-sharp.wav', 'pa.wav'] },
  { role: 'dha', pc: 10, names: ['416606__luckylittleraven__tanpura-note-a-sharp.wav', 'dha.wav'] },
  { role: 'kharaj', pc: 1, names: ['416597__luckylittleraven__tanpura-note-low-c-sharp.wav', 'kharaj.wav'] },
];

const kits = new WeakMap();
export function tanpuraKit(ctx, baseUrl) { let k = kits.get(ctx); if (!k) { k = new TanpuraKit(ctx, baseUrl); kits.set(ctx, k); } return k; }

export class TanpuraKit {
  constructor(ctx, baseUrl = 'samples/tanpura/') {
    this.ctx = ctx; this.baseUrl = baseUrl;
    this.strings = []; this.ready = false; this.failed = null; this.played = 0; this.promise = null;
  }
  // Resolves to true when at least one string loaded. Safe to call repeatedly.
  load() {
    if (this.promise) return this.promise;
    this.promise = Promise.all(STRINGS.map((s) => this._loadOne(s))).then((res) => {
      this.strings = res.filter(Boolean);
      this.ready = this.strings.length > 0;
      if (!this.ready) this.failed = `no files in ${this.baseUrl}`;
      return this.ready;
    });
    return this.promise;
  }
  async _loadOne(spec) {
    for (const name of spec.names) {
      try {
        const r = await fetch(this.baseUrl + name, { cache: 'force-cache' });
        if (!r.ok) continue;
        const buf = await this.ctx.decodeAudioData(await r.arrayBuffer());
        const hz = this._measure(buf, spec.pc);
        const { peak, onset } = this._level(buf);
        // The Freesound takes peak around -24 dBFS and start ~0.1 s late: normalise to -6 dBFS and skip the silence.
        return { role: spec.role, name, buffer: buf, hz, gain: Math.min(16, 0.5 / Math.max(peak, 0.01)), onset };
      } catch (e) { this.failed = String(e && e.message || e); }
    }
    return null;
  }
  _level(buf) {
    let peak = 0;
    const chans = []; for (let c = 0; c < buf.numberOfChannels; c++) chans.push(buf.getChannelData(c));
    for (const d of chans) for (let i = 0; i < d.length; i++) { const a = Math.abs(d[i]); if (a > peak) peak = a; }
    let onset = 0;
    outer: for (let i = 0; i < buf.length; i++) for (const d of chans) if (Math.abs(d[i]) > peak * 0.1) { onset = i; break outer; }
    return { peak, onset: Math.max(0, onset / buf.sampleRate - 0.005) };
  }
  // Autocorrelation on a mono slice after the pluck settles, then snap to the octave of the printed note.
  _measure(buf, pc) {
    const sr = buf.sampleRate, N = Math.min(buf.length, Math.floor(sr * 0.6));
    const start = Math.min(Math.floor(sr * 0.4), Math.max(0, buf.length - N));
    const x = new Float32Array(N);
    for (let c = 0; c < buf.numberOfChannels; c++) { const d = buf.getChannelData(c); for (let i = 0; i < N; i++) x[i] += d[start + i] / buf.numberOfChannels; }
    let best = 0, bestLag = 0;
    const minLag = Math.floor(sr / 1000), maxLag = Math.floor(sr / 40);
    for (let lag = minLag; lag <= maxLag; lag++) {
      let s = 0, e = 0;
      for (let i = 0; i + lag < N; i++) { s += x[i] * x[i + lag]; e += x[i + lag] * x[i + lag]; }
      const v = e ? s / Math.sqrt(e) : 0;
      if (v > best) { best = v; bestLag = lag; }
    }
    const nominalPc = 440 * Math.pow(2, (pc - 9) / 12); // the printed note in octave 4
    if (!bestLag) return nominalPc / 2;
    const f0 = sr / bestLag;
    // Snap to the printed pitch class; the recording's octave (or an octave error of the estimate) is whatever is nearest.
    const k = Math.round(Math.log2(f0 / nominalPc));
    return nominalPc * Math.pow(2, k);
  }
  pick(targetHz) {
    let best = null, bestD = Infinity;
    for (const s of this.strings) { const d = Math.abs(Math.log2(targetHz / s.hz)); if (d < bestD) { bestD = d; best = s; } }
    return best;
  }
  // Plays the nearest string at targetHz into `dest`. opts: { amp, tone (0..1 brightness), decay (s) }
  play(targetHz, t, dest, opts = {}) {
    const s = this.pick(targetHz);
    if (!s) return false;
    const ctx = this.ctx, rate = targetHz / s.hz;
    const src = ctx.createBufferSource(); src.buffer = s.buffer; src.playbackRate.value = rate;
    const natural = (s.buffer.duration - s.onset) / rate;
    const decay = Math.min(opts.decay || 7, natural);
    const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 0.5;
    lp.frequency.value = 1800 + (opts.tone == null ? 0.6 : opts.tone) * 9000;
    const g = ctx.createGain();
    const amp = (opts.amp == null ? 1 : opts.amp) * s.gain;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(amp, t + 0.006);
    g.gain.setValueAtTime(amp, t + decay * 0.55);
    g.gain.linearRampToValueAtTime(0, t + decay);
    src.connect(lp).connect(g).connect(dest);
    src.start(t, s.onset); src.stop(t + decay + 0.05);
    this.played++;
    return true;
  }
}

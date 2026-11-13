// Sampled tabla kit: loads the CC0 recordings in samples/tabla/ and plays them pitch-shifted to the singer's Sa.
// Stroke names match the synth methods in tabla.js (na, tin, tun, te, ke, kat, ge) so the scheduler needs no changes.

// Nominal Sa of the recorded dayan: the ringing "na" stroke measures ~416 Hz (G#4).
export const KIT_SA = 416;
const FILES = ['dhec', 'ghe1', 'ghe2', 'ghe3', 'ghe4', 'ghe5', 'ghe6', 'ghe7', 'ghe8', 'ke1', 'ke2', 'ke3', 'na', 'na_o', 'na_s', 're', 'tas1', 'tas2', 'tas3', 'te1', 'te2', 'te_m', 'te_ne', 'tun1', 'tun2', 'tun3'];

// Which recordings answer each stroke, with a level. `short` variants are used when the slot is brief.
const MAP = {
  na: { files: ['na', 'na'], short: ['na_s'], gain: 0.75 },
  tin: { files: ['na_o'], short: ['na_s'], gain: 0.7 },
  tun: { files: ['tun1', 'tun2', 'tun3'], gain: 0.6 },
  te: { files: ['te1', 'te2', 'te_m'], gain: 0.55 },
  ne: { files: ['te_ne'], gain: 0.5 },
  re: { files: ['re'], gain: 0.5 },
  tas: { files: ['tas2', 'tas3'], gain: 0.5 },
  ke: { files: ['ke1', 'ke2', 'ke3'], gain: 0.7 },
  ge: { files: ['ghe2', 'ghe3', 'ghe5', 'ghe6', 'ghe7'], short: ['ghe1', 'ghe4', 'ghe8'], gain: 0.95 },
  dhe: { files: ['dhec'], gain: 0.7 },
};

export class SampleKit {
  constructor(ctx, dest, baseUrl = 'samples/tabla/') {
    this.ctx = ctx; this.out = ctx.createGain(); this.out.connect(dest);
    this.baseUrl = baseUrl; this.buffers = {}; this.ready = false; this.failed = null; this.rr = {};
    this.dayanRate = 1; this.bayanRate = 1; this.played = 0;
  }
  async load() {
    try {
      await Promise.all(FILES.map(async (n) => {
        const res = await fetch(`${this.baseUrl}tabla_${n}.flac`);
        if (!res.ok) throw new Error(`${res.status} for tabla_${n}.flac`);
        const data = await res.arrayBuffer();
        this.buffers[n] = await new Promise((ok, err) => this.ctx.decodeAudioData(data, ok, err));
      }));
      this.ready = true;
    } catch (e) { this.failed = e.message || String(e); this.ready = false; }
    return this.ready;
  }
  // Pick the playback rate so the drum sits in a natural dayan register for this Sa (within ~4 semitones up, more down).
  setSa(saHz) {
    let best = null;
    for (let k = -1; k <= 3; k++) {
      const target = saHz * Math.pow(2, k), ratio = target / KIT_SA;
      const score = Math.abs(Math.log2(ratio)) + (ratio > 1.26 ? 1 : 0) + (ratio < 0.5 ? 1 : 0);
      if (!best || score < best.score) best = { ratio, score };
    }
    this.dayanRate = best.ratio;
    this.bayanRate = Math.min(1.12, Math.max(0.85, best.ratio)); // the bayan is not pitched precisely
  }
  _pick(name, slot) {
    const m = MAP[name]; if (!m) return null;
    const list = slot != null && slot < 0.3 && m.short ? m.short : m.files;
    const i = (this.rr[name] = ((this.rr[name] || 0) + 1) % list.length);
    const b = this.buffers[list[i]];
    return b ? { buffer: b, gain: m.gain } : null;
  }
  // Play one stroke. slot = how long until the next bol (seconds), used to choose short takes and to tame rings.
  play(name, t, vel = 1, slot = null, opts = {}) {
    if (!this.ready) return false;
    const p = this._pick(name, slot); if (!p) return false;
    const ctx = this.ctx, s = ctx.createBufferSource(); s.buffer = p.buffer;
    const bayan = name === 'ge' || name === 'ke' || name === 'dhe';
    s.playbackRate.value = (bayan ? this.bayanRate : this.dayanRate) * (opts.rate || 1) * (1 + (Math.random() - 0.5) * 0.01);
    const g = ctx.createGain();
    const amp = p.gain * vel * (opts.gain || 1);
    g.gain.setValueAtTime(amp, t);
    const cut = opts.cut; // seconds after which the sample is faded out
    if (cut) g.gain.setTargetAtTime(0, t + cut, 0.02);
    let node = s;
    if (opts.lowpass) { const f = ctx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = opts.lowpass; s.connect(f); node = f; }
    node.connect(g).connect(this.out);
    s.start(t); s.stop(t + (cut ? cut + 0.15 : p.buffer.duration / s.playbackRate.value + 0.05));
    this.played++;
    return true;
  }
}

// Gamaka tracker. Carnatic (and much Hindustani) singing oscillates on purpose: a kampita on Ga2 swings between
// Ri2 and Ma1 and is heard as Ga2. Scoring every frame against the nearest swara calls that "wavering" and "Ri2".
// This watches the last ~0.7 s of pitch; when it sees a real oscillation it reports the note's anchor, the pitch the
// swing is organised around, so the display, guru and drill can judge that instead of each frame.
//
// Anchor rule: candidates are the most-dwelt pitch (histogram mode), the mean, and the two turning points, in that
// order of trust; each is scored by its distance to the nearest allowed swara plus a small handicap for the less
// trusted kinds, and the best wins. If it is not within 45¢ of a swara the mean is used and the oscillation is
// reported as unanchored (it is then scored like any off note).

const WINDOW = 0.7, MIN_SPAN = 55, MAX_SPAN = 700, TURN_HYST = 18, MIN_TURNS = 2;

export class GamakaTracker {
  constructor() { this.buf = []; this.state = null; this.active = true; }
  reset() { this.buf.length = 0; this.state = null; }
  // Break the window at an onset or silence so one note's swing never bleeds into the next.
  cut() { this.reset(); }
  // cents: pitch relative to Sa. swaraCents: array of allowed swara positions (cents, any octave) to anchor to.
  push(t, cents, swaraCents) {
    const b = this.buf;
    b.push({ t, c: cents });
    while (b.length && t - b[0].t > WINDOW) b.shift();
    if (!this.active || b.length < 10) return (this.state = null);
    let lo = Infinity, hi = -Infinity, sum = 0;
    for (const p of b) { if (p.c < lo) lo = p.c; if (p.c > hi) hi = p.c; sum += p.c; }
    const span = hi - lo;
    if (span < MIN_SPAN || span > MAX_SPAN) return (this.state = null);
    // turning points with hysteresis: a reversal counts once the pitch has come back TURN_HYST from the extreme
    let dir = 0, mx = b[0].c, mnv = b[0].c, ext = b[0].c, turns = 0, firstTurnT = null, lastTurnT = null;
    for (const p of b) {
      if (dir === 0) {
        // establish the first direction once the pitch has moved TURN_HYST from where it started
        if (p.c > mx) mx = p.c; if (p.c < mnv) mnv = p.c;
        if (p.c - mnv > TURN_HYST) { dir = 1; ext = p.c; } else if (mx - p.c > TURN_HYST) { dir = -1; ext = p.c; }
        continue;
      }
      if (dir === 1) {
        if (p.c > ext) ext = p.c;
        else if (ext - p.c > TURN_HYST) { turns++; lastTurnT = p.t; if (firstTurnT == null) firstTurnT = p.t; dir = -1; ext = p.c; }
      } else {
        if (p.c < ext) ext = p.c;
        else if (p.c - ext > TURN_HYST) { turns++; lastTurnT = p.t; if (firstTurnT == null) firstTurnT = p.t; dir = 1; ext = p.c; }
      }
    }
    if (turns < MIN_TURNS) return (this.state = null);
    const rate = turns > 1 && lastTurnT > firstTurnT ? (turns - 1) / 2 / (lastTurnT - firstTurnT) : 0;
    // most-dwelt pitch: 15¢ bins, refined by the mean of the samples in and beside the mode bin
    const bins = new Map();
    for (const p of b) { const k = Math.round(p.c / 15); bins.set(k, (bins.get(k) || 0) + 1); }
    let modeK = 0, modeN = -1; for (const [k, n] of bins) if (n > modeN) { modeN = n; modeK = k; }
    let ms = 0, mn = 0; for (const p of b) if (Math.abs(p.c - modeK * 15) <= 22) { ms += p.c; mn++; }
    const mode = mn ? ms / mn : modeK * 15, mean = sum / b.length;
    const cands = [['dwell', mode, 0], ['mean', mean, 8], ['low', lo, 15], ['high', hi, 20]];
    let best = null;
    if (swaraCents && swaraCents.length) {
      for (const [kind, c, handicap] of cands) {
        let near = Infinity; for (const s of swaraCents) { const d = Math.abs(c - s); if (d < near) near = d; }
        const score = near + handicap;
        if (!best || score < best.score - 1e-6) best = { kind, c, near, score };
      }
    }
    const anchored = best && best.near <= 45;
    this.state = { anchor: anchored ? best.c : mean, basis: anchored ? best.kind : 'mean', anchored, span, lo, hi, rate, turns };
    return this.state;
  }
}

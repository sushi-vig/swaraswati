// Pitch analysis worker: McLeod Pitch Method (NSDF) with adaptive voicing gate.
// Receives sample chunks (from the worklet directly, or forwarded by the main thread),
// posts { t, f0, clarity, rms } frames back to the main thread.

let sr = 16000;
let W = 1024;            // analysis window (64 ms at 16 kHz); the worklet decimates to ~16 kHz before sending
let HOP = 512;           // ~31 frames/s
const MIN_HZ = 65, MAX_HZ = 1300;
const RING = 16384;
let ring = new Float32Array(RING), wpos = 0, total = 0, sinceLast = 0;
let x = new Float32Array(W);
let cum = new Float64Array(W + 1);
let nsdf, maxLag, minLag;

const params = { absRms: 0.006, floorMult: 1.8, clarityOn: 0.80, clarityOff: 0.62, keyThresh: 0.8 };
let floor = 0.003, voiced = false;
// Noise floor = minimum RMS over the last 10-20 s (two 10 s buckets): breaths reset it, a steady drone or fan is absorbed.
let bucketLen = 470, bucketPos = 0, curMin = Infinity, prevMin = Infinity;
let frameNo = 0, runStart = 0, longRun = 2110; // frames (~45 s): a "note" held longer than this is treated as background

function setup() {
  x = new Float32Array(W); cum = new Float64Array(W + 1);
  maxLag = Math.min(Math.floor(sr / MIN_HZ), W >> 1);
  bucketLen = Math.round((sr / HOP) * 10);
  longRun = Math.round((sr / HOP) * 45);
  minLag = Math.max(2, Math.floor(sr / MAX_HZ));
  nsdf = new Float32Array(maxLag + 1);
}
setup();

self.onmessage = (e) => {
  const d = e.data;
  if (d.type === 'init') {
    sr = d.sampleRate || sr; if (d.window) W = d.window; if (d.hop) HOP = d.hop; setup();
    if (d.port) { d.port.onmessage = (ev) => onSamples(ev.data); }
  } else if (d.type === 'samples') {
    onSamples(d);
  } else if (d.type === 'params') {
    Object.assign(params, d.params);
  } else if (d.type === 'reset') {
    total = 0; sinceLast = 0; wpos = 0; voiced = false; floor = 0.003; curMin = prevMin = Infinity; bucketPos = 0;
  }
};

function onSamples(d) {
  const s = d.samples;
  for (let i = 0; i < s.length; i++) { ring[wpos] = s[i]; wpos = (wpos + 1) % RING; }
  total += s.length; sinceLast += s.length;
  while (sinceLast >= HOP && total >= W) {
    sinceLast -= HOP;
    const frameEnd = total - sinceLast;                 // absolute sample index of frame end
    let start = (wpos - (total - frameEnd) - W) % RING; if (start < 0) start += RING;
    for (let i = 0; i < W; i++) x[i] = ring[(start + i) % RING];
    const r = analyze(x);
    const tCenter = d.endTime - (total - frameEnd) / sr - W / (2 * sr);
    self.postMessage({ t: tCenter, f0: r.f0, clarity: r.clarity, rms: r.rms, floor });
  }
}

function analyze(x) {
  cum[0] = 0;
  for (let i = 0; i < W; i++) cum[i + 1] = cum[i] + x[i] * x[i];
  const rms = Math.sqrt(cum[W] / W);

  frameNo++;
  // Only quiet frames (or a very long unbroken "note", i.e. a drone) feed the floor estimate.
  if ((!voiced || frameNo - runStart > longRun) && rms < curMin) curMin = rms;
  if (++bucketPos >= bucketLen) { prevMin = curMin; curMin = Infinity; bucketPos = 0; }
  const winMin = Math.min(prevMin, curMin);
  if (winMin !== Infinity) floor = Math.max(1e-5, winMin);   // no quiet frames lately: keep the last floor
  // Starting a note needs to clear the floor comfortably; sustaining one needs less, so soft tails are kept.
  const gate = voiced ? Math.max(params.absRms * 0.6, floor * 1.2) : Math.max(params.absRms, floor * params.floorMult);
  if (rms < gate) { voiced = false; return { f0: 0, clarity: 0, rms }; }

  // NSDF. m(tau) via cumulative sums; only the autocorrelation is O(W * maxLag).
  const totalSq = cum[W];
  for (let tau = 0; tau <= maxLag; tau++) {
    let acf = 0;
    for (let j = 0, k = tau; k < W; j++, k++) acf += x[j] * x[k];
    const m = cum[W - tau] + (totalSq - cum[tau]);
    nsdf[tau] = m > 0 ? (2 * acf) / m : 0;
  }

  // Peak picking: skip the lag-0 lobe, then take the max of each positive region.
  let tau = 1;
  while (tau < maxLag && nsdf[tau] > 0) tau++;
  const peaks = [];
  let best = 0;
  while (tau < maxLag) {
    while (tau < maxLag && nsdf[tau] <= 0) tau++;
    let mi = -1, mv = 0;
    while (tau < maxLag && nsdf[tau] > 0) { if (nsdf[tau] > mv) { mv = nsdf[tau]; mi = tau; } tau++; }
    if (mi > 0) { peaks.push(mi); if (mv > best) best = mv; }
  }
  if (!peaks.length) { voiced = false; return { f0: 0, clarity: 0, rms }; }

  const thr = params.keyThresh * best;
  let sel = -1;
  for (const p of peaks) { if (p >= minLag && nsdf[p] >= thr) { sel = p; break; } }
  if (sel < 0) { voiced = false; return { f0: 0, clarity: 0, rms }; }

  // Parabolic interpolation around the chosen peak.
  let T = sel, clarity = nsdf[sel];
  if (sel > 0 && sel < maxLag) {
    const a = nsdf[sel - 1], b = nsdf[sel], c = nsdf[sel + 1];
    const den = a - 2 * b + c;
    if (den !== 0) {
      const delta = 0.5 * (a - c) / den;
      T = sel + delta;
      clarity = b - 0.25 * (a - c) * delta;
    }
  }
  const f0 = sr / T;
  const need = voiced ? params.clarityOff : params.clarityOn;
  if (clarity < need || f0 < MIN_HZ || f0 > MAX_HZ) { voiced = false; return { f0: 0, clarity, rms }; }
  if (!voiced) runStart = frameNo;
  voiced = true;
  return { f0, clarity: Math.min(1, clarity), rms };
}

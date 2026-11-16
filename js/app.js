import { SWARA_ORDER, SWARA_NAMES, SWARA_LONG, OCT_NAMES, CENTS_JI, CENTS_ET, NOTE_NAMES, midiToHz, hzToMidi, noteName, nearestSwara, swaraLabel, tokens, setNaming, kattaiOf, harmoniumKeyOf } from './music.js';
import { ShrutiPetti, SHRUTI_MODES } from './shruti.js';
import { GamakaTracker } from './gamaka.js';
import { RAGAS, ragaSwaraSet, ragaDirectionSets, melaName } from './ragas.js';
import { TAALS, matraMeta, thekaOf, bolLabel } from './taals.js';
import { Tanpura, VOICES, FIRST_STRING } from './tanpura.js';
import { Swarmandal } from './swarmandal.js';
import { Tabla } from './tabla.js';
import { PitchTracker } from './pitch.js';
import { Guru } from './guru.js';
import { Drill, buildPatterns } from './drill.js';

const $ = (id) => document.getElementById(id);
const LS = 'swaraswati-settings-v1';
const TP_DEFAULT = (pan) => ({ voice: 'female', string: 'auto', vol: 0.3, tempo: 1, jawari: 0.6, fine: 0, pan });
const defaults = { saMidi: 57, tuning: 'ji', raga: 'yaman', taal: 'teentaal', bpm: 80, tanpuraVol: 0.3, tablaVol: 0.7,
  tanpuras: [TP_DEFAULT(-0.3), Object.assign(TP_DEFAULT(0.3), { voice: 'male', tempo: 0.9, fine: 3 })],
  sm: { auto: 0, range: 2, dir: 0, gap: 45, vol: 0.5 }, sensitivity: 0.6, latencyMs: 40, drone: 'auto', showAll: false, pattern: 'aroha', perNote: 1, zoom: 2, zoomScale: 3, saCents: 0, tradition: 'hindustani', shruti: { mode: 'SPl', vol: 0.35, tone: 0.5, fine: 0 }, gamaka: { hindustani: false, carnatic: true }, echoCancel: true, theka: 0, layakari: 1, tablaEngine: 'samples', rampStep: 0, rampMax: 160 };
const settings = Object.assign({}, defaults, load());
// migrate pre-tanpura-pair settings
if (!Array.isArray(settings.tanpuras) || settings.tanpuras.length !== 2) settings.tanpuras = defaults.tanpuras.map((t) => ({ ...t }));
settings.tanpuras = settings.tanpuras.map((t, i) => Object.assign({}, defaults.tanpuras[i], t));
if (settings.drone && settings.drone !== 'auto' && !settings.tanpurasMigrated) { settings.tanpuras[0].string = settings.drone; settings.tanpuras[0].vol = settings.tanpuraVol; }
settings.tanpurasMigrated = true;
settings.sm = Object.assign({}, defaults.sm, settings.sm || {});
settings.shruti = Object.assign({}, defaults.shruti, settings.shruti || {});
settings.gamaka = Object.assign({}, defaults.gamaka, settings.gamaka || {});
// Zoom scale 3 (2026-11): octaves visible = 6 - 2×zoom, default 2× = two octaves around Sa..Sa'. Older saved zooms reset.
if (settings.zoomScale !== 3) { settings.zoom = 2; settings.zoomScale = 3; }
function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(LS, JSON.stringify(settings)); } catch { /* private mode */ } }

// ---------- audio graph ----------
let lastKitInfo = '';
let ctx = null, master = null, tanpura = null, tanpuras = [], swarmandal = null, shruti = null, tabla = null, tracker = null, micStream = null, micSource = null, testTone = null;
const guru = new Guru();
const drill = new Drill();
const gamaka = new GamakaTracker();
const gamakaOn = () => !!settings.gamaka[settings.tradition];
let anchorCents = [];   // allowed swara positions (cents) the gamaka tracker may anchor to
let micOn = false;

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    tanpuras = [new Tanpura(ctx, master), new Tanpura(ctx, master)];
    tanpura = tanpuras[0];
    const onTpKit = (ok, kit) => { $('tpKitInfo').textContent = ok ? `Recorded strings: ${kit.strings.map((s) => s.role).join(', ')} loaded (${kit.strings.length}/4).` : 'Recorded strings not found in samples/tanpura/; the recorded voices use the synth until the WAVs are added.'; };
    tanpuras.forEach((t) => { t.onKit = onTpKit; });
    swarmandal = new Swarmandal(ctx, master);
    shruti = new ShrutiPetti(ctx, master);
    tabla = new Tabla(ctx, master);
    tabla.onKit = (ok, why) => { lastKitInfo = ok ? '26 strokes loaded' : `recordings unavailable (${why}); using the synth`; if (!ok) { $('tablaEngine').value = 'synth'; } if (taal().tradition !== 'carnatic') $('kitInfo').textContent = lastKitInfo; };
    lastKitInfo = 'loading…'; if (taal().tradition !== 'carnatic') $('kitInfo').textContent = lastKitInfo;
    applyAudioSettings();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const saHz = () => midiToHz(settings.saMidi + (settings.saCents || 0) / 100);
const cmap = () => (settings.tuning === 'et' ? CENTS_ET : CENTS_JI);
const raga = () => RAGAS.find((r) => r.id === settings.raga) || RAGAS[0];
const taal = () => TAALS.find((t) => t.id === settings.taal) || TAALS[0];
const droneString = (k = 0) => { const v = settings.tanpuras[k].string; return v === 'auto' ? raga().drone || 'P' : v; };
let ragaSet = null, ragaCtx = null;

function applyAudioSettings() {
  if (!ctx) return;
  settings.tanpuras.forEach((tp, k) => { tanpuras[k].configure(saHz(), droneString(k), tp); tanpuras[k].setVolume(tp.vol); });
  tuneSwarmandal();
  swarmandal.setVolume(settings.sm.vol);
  shruti.configure(saHz(), settings.shruti); shruti.setVolume(settings.shruti.vol);
  tabla.setSa(saHz());
  tabla.setTaal(taal(), settings.theka);
  tabla.engine = settings.tablaEngine;
  tabla.bpm = settings.bpm;
  tabla.layakari = settings.layakari;
  tabla.ramp = { step: settings.rampStep, max: settings.rampMax };
  tabla.onTempo = (b) => { settings.bpm = b; $('bpm').value = b; $('bpmNum').value = b; save(); setLayaWord(); setStatus(); };
  tabla.setVolume(settings.tablaVol);
}

async function ensureTracker() {
  audio();
  if (!tracker) {
    tracker = new PitchTracker(ctx);
    await tracker.init();
    tracker.onFrame = onFrame;
    tracker.setSensitivity(settings.sensitivity);
  }
  return tracker;
}

async function toggleMic() {
  if (micOn) {
    micStream.getTracks().forEach((t) => t.stop());
    tracker.setInput(null); micSource = null; micOn = false;
    $('btnMic').textContent = 'Start mic'; $('btnMic').classList.remove('on'); $('micInfo').textContent = '';
    setStatus(); return;
  }
  try {
    $('btnMic').textContent = 'Starting…';
    await ensureTracker();
    // Echo cancellation lets the browser subtract what this page plays (drones, drum) from the mic. Noise suppression
    // and gain control stay off: the first eats long held notes, the second moves the level the gate depends on.
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: !!settings.echoCancel, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    micSource = ctx.createMediaStreamSource(micStream);
    const got = micStream.getAudioTracks()[0].getSettings ? micStream.getAudioTracks()[0].getSettings() : {};
    $('micInfo').textContent = settings.echoCancel ? (got.echoCancellation === false ? 'browser did not apply it; use headphones' : got.echoCancellation ? 'on' : 'requested') : 'off';
    if (testTone) stopTestTone();
    tracker.setInput(micSource);
    micOn = true;
    connectMicToRec();
    $('btnMic').textContent = 'Stop mic'; $('btnMic').classList.add('on');
    setStatus();
  } catch (err) {
    $('btnMic').textContent = 'Start mic';
    setStatus(`Mic error: ${err.name === 'NotAllowedError' ? 'permission denied' : err.message}`);
  }
}

function setStatus(extra) {
  const parts = [];
  if (ctx) parts.push(`${(ctx.sampleRate / 1000).toFixed(1)} kHz`);
  parts.push(micOn ? 'mic on' : testTone ? 'test tone' : 'mic off');
  if (tabla && tabla.running) parts.push(`${taal().name.split(' ')[0]} @ ${settings.bpm}${settings.layakari > 1 ? ' ×' + settings.layakari : ''}`);
  $('status').textContent = extra ? extra : parts.join(' · ');
}

// ---------- pitch history (ring buffers; no per-frame allocation) ----------
const N = 8192;
const hT = new Float64Array(N), hC = new Float32Array(N), hD = new Float32Array(N), hM = new Uint8Array(N); // hM: frame masked by a drum stroke
let hHead = 0, hCount = 0, lastFrame = null;
function pushHist(t, c, d, masked = 0) { hT[hHead] = t; hC[hHead] = c; hD[hHead] = d; hM[hHead] = masked; hHead = (hHead + 1) % N; if (hCount < N) hCount++; }

const onsets = [];        // { t, offsetMs|null }
const med = [];
let lastVoicedT = -1, lastCents = NaN, current = null, detectSa = null, maskedFrames = 0;
// Does f0 sit within 60 cents of hz, or of its octave above or below (a ringing head is often read an octave off)?
const pitchLike = (f0, hz) => [0.5, 1, 2].some((m) => Math.abs(1200 * Math.log2(f0 / (hz * m))) < 60);

function onFrame(fr) {
  lastFrame = fr;
  const t = fr.t;
  if (fr.f0 > 0) {
    const raw = 1200 * Math.log2(fr.f0 / saHz());
    med.push(raw); if (med.length > 3) med.shift();
    const sorted = med.slice().sort((a, b) => a - b);
    const c = sorted[sorted.length >> 1];
    // A drum stroke is sounding. Its attack (first 80 ms) is masked outright; while it rings, a frame is masked only
    // if its pitch matches the drum head, so the voice on another swara is still heard. Masked frames are drawn
    // faint and never start a note, move the hint, or get scored.
    const st = (micOn || testTone) && tabla ? tabla.strokeAt(t, (ctx.outputLatency || settings.latencyMs / 1000) + 0.005) : null;
    if (st && (st.since < 0.08 || (st.hz && pitchLike(fr.f0, st.hz)))) { maskedFrames++; pushHist(t, c, 0, 1); guru.hold(t); lastVoicedT = t; return; }
    const gap = lastVoicedT < 0 ? 1 : t - lastVoicedT;
    if (gap > 0.12) gamaka.cut();
    // Gamaka-aware: when the note is oscillating on purpose, score the pitch the swing is anchored on.
    const gam = gamakaOn() ? gamaka.push(t, c, anchorCents) : null;
    const sc = gam ? gam.anchor : c;
    const info = nearestSwara(sc, cmap());
    const rInfo = ragaSet ? nearestSwara(sc, cmap(), ragaSet) : info;
    const inRaga = !ragaSet || ragaSet.has(info.sw);
    pushHist(t, c, rInfo.dev);
    if (gap > 0.12 || Math.abs(c - lastCents) > (gam ? gam.span + 70 : 70)) registerOnset(t);
    lastVoicedT = t; lastCents = c;
    current = { t, cents: c, scored: sc, gam, hz: fr.f0, info, rInfo, inRaga, clarity: fr.clarity };
    guru.addFrame(t, info, rInfo, inRaga, ragaCtx, gam);
    drill.addFrame(t, sc, info);
    if (detectSa) detectSa.push(fr.f0);
  } else {
    med.length = 0; gamaka.cut();
    pushHist(t, NaN, 0);
    current = null;
    guru.addSilence(t);
    drill.addSilence(t);
  }
}

function registerOnset(t) {
  let offsetMs = null, matra = null;
  if (tabla && tabla.running) {
    const tc = t - settings.latencyMs / 1000;
    const nm = tabla.nearestMatra(tc);
    if (nm) { offsetMs = Math.round((tc - nm.t) * 1000); matra = nm.matra + 1; }
  }
  onsets.push({ t, offsetMs, matra });
  if (onsets.length > 60) onsets.splice(0, 30);
}

// ---------- canvas ----------
const cv = $('pitchCanvas');
const g = cv.getContext('2d', { alpha: false });
let cw = 0, chh = 0, dpr = 1;
const LABEL_W = 54;
// Zoom scale: octaves visible = 6 - 2×zoom, so 0.5× shows five octaves, 1× four, 1.5× three, 2× (default) two
// (the main octave with half an octave above and below), 2.5× exactly one. Past 2.5× the span halves every
// 0.5 step (3× half an octave, 4× an eighth) and the view follows the note so single cents can be read.
const ZOOM_MIN = 0.5, ZOOM_MAX = 4, ZOOM_STEP = 0.5, ZOOM_DEFAULT = 2, OCT_CENTRE = 600;
const view = { lo: -600, hi: 1800 };
let viewCentre = OCT_CENTRE;
const zoom = () => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, settings.zoom || ZOOM_DEFAULT));
const octavesFor = (z) => (z <= 2.5 ? 6 - 2 * z : Math.pow(2, -(z - 2.5) * 2));
const spanCents = () => octavesFor(zoom()) * 1200;
// Time window: 12 s at two octaves, longer when zoomed out, shorter when reading cents.
const windowSec = () => Math.min(24, Math.max(4, 12 * Math.sqrt(octavesFor(zoom()) / 2)));
const octLabel = (o) => (o >= 1 ? `${o % 1 ? o.toFixed(1) : o} oct` : o >= 0.5 ? '½ oct' : o >= 0.25 ? '¼ oct' : '⅛ oct');
function setZoom(z) {
  settings.zoom = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100; save();
  const t = settings.zoom;
  $('zoomText').textContent = `${t % 1 ? t.toFixed(t * 10 % 1 ? 2 : 1) : t}× · ${octLabel(octavesFor(t))}`;
}

function resize() {
  const r = cv.getBoundingClientRect();
  dpr = Math.min(2, window.devicePixelRatio || 1);
  const w = Math.round(r.width * dpr), h = Math.round(r.height * dpr);
  if (cv.width !== w || cv.height !== h) { cv.width = w; cv.height = h; }
  cw = r.width; chh = r.height;
  g.setTransform(dpr, 0, 0, dpr, 0, 0);
}
const yOf = (c) => chh - ((c - view.lo) / (view.hi - view.lo)) * chh;
const devColor = (d) => (Math.abs(d) <= 15 ? '#3e7a4f' : Math.abs(d) <= 35 ? '#b07a1f' : '#a5301f');

function draw() {
  resize();
  const now = ctx ? ctx.currentTime : 0;
  const WINDOW_SEC = windowSec(), z = zoom();
  const pxPerSec = (cw - LABEL_W) / WINDOW_SEC;
  const xOf = (t) => cw - (now - t) * pxPerSec;
  const tMin = now - WINDOW_SEC;

  // Vertical frame. Zoomed out (a full octave or more): a fixed frame centred on the main octave, nudged only
  // when the sung note leaves it; it drifts back to Sa..Sa' after a few seconds of silence.
  // Zoomed in (under an octave): the frame follows the note being sung.
  const span = spanCents();
  if (span < 1200) {
    if (current) viewCentre = current.cents;
  } else {
    // ease home to Sa..Sa', then nudge only as far as the sung note needs
    viewCentre += (OCT_CENTRE - viewCentre) * 0.02;
    if (current) {
      const margin = Math.min(300, span * 0.12);
      const lo = viewCentre - span / 2 + margin, hi = viewCentre + span / 2 - margin;
      if (current.cents < lo) viewCentre -= lo - current.cents;
      else if (current.cents > hi) viewCentre += current.cents - hi;
    }
  }
  view.lo += (viewCentre - span / 2 - view.lo) * 0.08; view.hi += (viewCentre + span / 2 - view.hi) * 0.08;

  g.fillStyle = '#f6eedb'; g.fillRect(0, 0, cw, chh);

  // beat grid
  if (tabla && tabla.running) {
    for (const ev of tabla.events) {
      const x = xOf(ev.t); if (x < LABEL_W || x > cw) continue;
      const meta = tabla.meta[ev.matra]; if (!meta) continue;
      g.strokeStyle = ev.matra === 0 ? 'rgba(125,42,30,0.55)' : meta.startsVibhag ? 'rgba(60,40,20,0.28)' : 'rgba(60,40,20,0.12)';
      g.lineWidth = ev.matra === 0 ? 2 : 1;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, chh); g.stroke();
      if (ev.matra === 0) { g.fillStyle = 'rgba(125,42,30,0.9)'; g.font = 'italic 11px "Crimson Pro", Georgia, serif'; g.fillText('sam', x + 4, 12); }
    }
  }

  // swara lines
  const cm = cmap();
  // When swara lines sit closer than ~13 px, label only Sa and Pa so the names stay readable.
  const pxPer100 = chh / ((view.hi - view.lo) / 100);
  const sparseLabels = pxPer100 < 13;
  g.font = '600 13px "Cormorant Garamond", Georgia, serif'; g.textBaseline = 'middle';
  for (let oct = -4; oct <= 4; oct++) {
    for (const sw of SWARA_ORDER) {
      const c = cm[sw] + oct * 1200;
      if (c < view.lo || c > view.hi) continue;
      const inRaga = !ragaSet || ragaSet.has(sw);
      if (!inRaga && !settings.showAll) continue;
      const y = yOf(c), isS = sw === 'S';
      g.setLineDash(inRaga ? [] : [3, 5]);
      g.strokeStyle = isS ? 'rgba(139,90,26,0.75)' : inRaga ? 'rgba(60,40,20,0.32)' : 'rgba(60,40,20,0.13)';
      g.lineWidth = isS ? 1.5 : 1;
      g.beginPath(); g.moveTo(LABEL_W, y); g.lineTo(cw, y); g.stroke();
      g.fillStyle = isS ? '#8b5a1a' : inRaga ? '#2a1f17' : '#a08f74';
      if (!sparseLabels || isS || (sw === 'P' && inRaga)) g.fillText(swaraLabel(sw, oct), 6, y);
      if (inRaga && (view.hi - view.lo) < 700) {
        // zoomed in enough to read cents: faint guides at ±15¢ (in tune) and ±35¢ (close)
        g.setLineDash([2, 6]); g.lineWidth = 1;
        for (const d of [15, 35]) {
          g.strokeStyle = d === 15 ? 'rgba(62,122,79,0.35)' : 'rgba(176,122,31,0.3)';
          for (const sgn of [-1, 1]) { const yy = yOf(c + sgn * d); g.beginPath(); g.moveTo(LABEL_W, yy); g.lineTo(cw, yy); g.stroke(); }
        }
        g.setLineDash([]);
      }
    }
  }
  g.setLineDash([]);

  // drill target band
  if (drill.active && ctx) {
    const i = drill.indexAt(now);
    if (i >= 0 && i < drill.notes.length) {
      const y = yOf(drill.notes[i].cents), h = Math.abs(yOf(0) - yOf(40));
      g.fillStyle = 'rgba(180,138,60,0.2)'; g.fillRect(LABEL_W, y - h / 2, cw - LABEL_W, h);
    }
  }

  // trace: neutral path, then colour-coded squares
  g.strokeStyle = 'rgba(42,31,23,0.45)'; g.lineWidth = 1.5; g.beginPath();
  let pen = false, prevT = 0;
  for (let k = 0; k < hCount; k++) {
    const i = (hHead - 1 - k + N) % N;
    const t = hT[i]; if (t < tMin) break;
    const c = hC[i];
    if (c !== c) { pen = false; continue; }
    const x = xOf(t), y = yOf(c);
    if (pen && prevT - t < 0.12) g.lineTo(x, y); else g.moveTo(x, y);
    pen = true; prevT = t;
  }
  g.stroke();
  for (let k = 0; k < hCount; k++) {
    const i = (hHead - 1 - k + N) % N;
    const t = hT[i]; if (t < tMin) break;
    const c = hC[i]; if (c !== c) continue;
    g.fillStyle = hM[i] ? 'rgba(123,106,85,0.35)' : devColor(hD[i]);
    g.fillRect(xOf(t) - 1.5, yOf(c) - 1.5, 3, 3);
  }

  // onset markers along the bottom
  for (const o of onsets) {
    const x = xOf(o.t); if (x < LABEL_W) continue;
    g.fillStyle = o.offsetMs == null ? 'rgba(42,31,23,0.35)' : Math.abs(o.offsetMs) <= 60 ? '#3e7a4f' : Math.abs(o.offsetMs) <= 120 ? '#b07a1f' : 'rgba(165,48,31,0.8)';
    g.beginPath(); g.moveTo(x, chh); g.lineTo(x - 4, chh - 7); g.lineTo(x + 4, chh - 7); g.fill();
  }

  // scale legend
  g.fillStyle = 'rgba(42,31,23,0.55)'; g.font = 'italic 11px "Crimson Pro", Georgia, serif'; g.textBaseline = 'alphabetic';
  g.fillText(`${Math.round(WINDOW_SEC)} s · ${Math.round(view.hi - view.lo)}¢ tall`, LABEL_W + 6, chh - 12);
  g.textBaseline = 'middle';

  // current pitch marker
  if (current && now - current.t < 0.3) {
    const y = yOf(current.cents);
    g.fillStyle = devColor(current.rInfo.dev);
    g.beginPath(); g.arc(cw - 6, y, 5, 0, Math.PI * 2); g.fill();
  }
}

// ---------- DOM updates ----------
let lastMatraIdx = -1, lastDrillIdx = -2, drillBuilt = false;

function updateMicMeter() {
  const fr = lastFrame; if (!fr) return;
  const db = (v) => 20 * Math.log10(Math.max(v, 1e-5));
  const pos = (v) => Math.max(0, Math.min(100, (db(v) + 60) / 60 * 100));
  const lv = $('micLevel'), live = (micOn || testTone) && ctx && ctx.currentTime - fr.t < 0.5;
  lv.style.width = `${live ? pos(fr.rms) : 0}%`; lv.classList.toggle('voiced', live && fr.f0 > 0);
  if (fr.floor != null) $('micFloor').style.left = `${pos(fr.floor * 1.8)}%`;
  $('micText').textContent = live ? `${Math.round(db(fr.rms))} dB${fr.f0 > 0 ? ' · voice' : fr.rms > (fr.floor || 0) * 1.8 ? ' · unclear' : ' · quiet'}` : '—';
}
function updateNow() {
  updateMicMeter();
  if (current && ctx && ctx.currentTime - current.t < 0.35) {
    const { info, rInfo, inRaga, hz, gam } = current;
    $('swaraBig').textContent = SWARA_NAMES[info.sw] + (gam ? '~' : '');
    $('swaraOct').textContent = OCT_NAMES[String(info.oct)] || '';
    $('swaraBig').style.color = inRaga ? '' : 'var(--bad)';
    const gtxt = gam ? ` · ${settings.tradition === 'carnatic' ? 'kampita' : 'andolan'} swinging ${Math.round(gam.span)}¢${gam.rate ? ' at ' + gam.rate.toFixed(1) + '/s' : ''}${gam.anchored ? '' : ', no clear anchor'}` : '';
    $('swaraSub').textContent = (inRaga ? `${SWARA_LONG[info.sw]}${ragaSet ? ' · in ' + raga().name : ''}` : `${SWARA_LONG[info.sw]} — not in ${raga().name} (nearest: ${SWARA_LONG[rInfo.sw]})`) + gtxt;
    const d = Math.max(-50, Math.min(50, info.dev));
    $('needle').style.left = `${50 + d}%`;
    $('needle').style.background = devColor(info.dev);
    $('centsText').textContent = `${info.dev > 0 ? '+' : ''}${Math.round(info.dev)} ¢`;
    $('hzText').textContent = `${hz.toFixed(1)} Hz`;
    $('westernText').textContent = noteName(hzToMidi(hz));
  } else {
    $('swaraBig').textContent = '—'; $('swaraOct').textContent = ''; $('swaraBig').style.color = '';
    $('hzText').textContent = ''; $('westernText').textContent = '';
    if (!detectSa) $('swaraSub').textContent = micOn ? 'Listening…' : testTone ? 'Test tone running' : 'Start the mic, pick your Sa, and sing.';
  }
  const h = guru.hint;
  const el = $('liveHint');
  if (h) { el.textContent = h.text; el.className = `hint ${h.cls}`; } else if (el.textContent) { el.textContent = ''; el.className = 'hint'; }
}

function buildTaalStrip() {
  const t = taal(), meta = matraMeta(t), strip = $('taalStrip');
  if (settings.theka >= t.thekas.length) settings.theka = 0;
  const th = thekaOf(t, settings.theka);
  fillSelect($('thekaSel'), t.thekas.map((x, i) => ({ value: i, label: x.name })), settings.theka);
  $('taalNote').textContent = `${t.vibhags.join(' + ')}${t.kriya ? ' · ' + t.marks.join(' ') : ''} · ${t.note || ''}`;
  const car = t.tradition === 'carnatic';
  $('tablaEngine').disabled = car;
  $('kitInfo').textContent = car ? 'mridangam, synthesised (tuned to Sa)' : lastKitInfo;
  strip.innerHTML = '';
  let group = null;
  th.bols.forEach((bol, i) => {
    if (meta[i].startsVibhag) { group = document.createElement('div'); group.className = 'vibhag'; strip.appendChild(group); }
    const m = document.createElement('div');
    m.className = 'matra' + (i === 0 ? ' sam' : ''); m.dataset.i = i;
    const k = meta[i].kriya, kriya = k === 'clap' || k === 'wave' ? k : k ? 'count ' + k : '';
    m.innerHTML = `<span class="mark">${meta[i].mark}</span>${bolLabel(bol)}<span class="num">${t.kriya ? kriya || '&nbsp;' : i + 1}</span>`;
    group.appendChild(m);
  });
  lastMatraIdx = -1;
}
const layaWord = (b) => (b < 40 ? 'ati vilambit' : b < 80 ? 'vilambit' : b < 160 ? 'madhya' : b < 300 ? 'drut' : 'ati drut');
function setLayaWord() { $('layaWord').textContent = `bpm · ${layaWord(settings.bpm)}`; }
let taps = [];
function tapTempo() {
  const now = performance.now();
  if (taps.length && now - taps[taps.length - 1] > 2500) taps = [];
  taps.push(now); if (taps.length > 8) taps.shift();
  if (taps.length >= 2) {
    const iv = (taps[taps.length - 1] - taps[0]) / (taps.length - 1);
    onBpm(Math.round(60000 / iv));
    $('btnTapTempo').textContent = taps.length < 4 ? `Tap… (${taps.length})` : `Tap tempo · ${settings.bpm}`;
    clearTimeout(tapTempo.t); tapTempo.t = setTimeout(() => { $('btnTapTempo').textContent = 'Tap tempo'; taps = []; }, 2500);
  } else $('btnTapTempo').textContent = 'Tap… (1)';
}

function updateTaal() {
  if (!tabla || !tabla.running) { if (lastMatraIdx !== -1) { document.querySelectorAll('.matra.on').forEach((e) => e.classList.remove('on')); lastMatraIdx = -1; } return; }
  const pos = tabla.positionAt(ctx.currentTime);
  if (!pos || pos.idx === lastMatraIdx) return;
  lastMatraIdx = pos.idx;
  document.querySelectorAll('.matra.on').forEach((e) => e.classList.remove('on'));
  const el = document.querySelector(`.matra[data-i="${pos.matra}"]`); if (el) el.classList.add('on');
  const recent = onsets.filter((o) => o.offsetMs != null).slice(-6);
  if (recent.length) {
    const txt = recent.map((o) => `${o.offsetMs > 0 ? '+' : ''}${o.offsetMs}`).join(', ');
    const mean = Math.round(recent.reduce((s, o) => s + o.offsetMs, 0) / recent.length);
    $('taalFb').textContent = `Your note onsets vs the nearest matra (ms): ${txt} · average ${mean > 0 ? mean + ' ms late' : mean < 0 ? -mean + ' ms early' : 'on the beat'}`;
  }
}

function updateDrill() {
  const tgt = $('drillTarget'), list = $('drillNotes');
  if (!drill.active && !drill.finished) return;
  if (!drillBuilt) {
    list.innerHTML = '';
    drill.notes.forEach((n, i) => { const s = document.createElement('span'); s.className = 'dn'; s.dataset.i = i; s.textContent = n.label; list.appendChild(s); });
    drillBuilt = true; lastDrillIdx = -2;
  }
  const now = ctx.currentTime;
  const i = drill.finished ? drill.notes.length : drill.indexAt(now);
  if (i !== lastDrillIdx) {
    // settle verdicts for everything before i
    for (let k = Math.max(0, lastDrillIdx); k < Math.min(i, drill.notes.length); k++) {
      const v = drill.verdict(k), el = list.querySelector(`.dn[data-i="${k}"]`);
      if (el) { el.className = `dn ${v.cls}`; el.innerHTML = `${drill.notes[k].label}<small>${v.text}</small>`; }
    }
    list.querySelectorAll('.dn.cur').forEach((e) => e.classList.remove('cur'));
    if (i < 0) tgt.innerHTML = `<small>Starting on the next sam… ${Math.max(0, Math.ceil(-(now - drill.t0)))}</small>`;
    else if (i < drill.notes.length) {
      const n = drill.notes[i], nx = drill.notes[i + 1];
      tgt.innerHTML = `${n.label}<small>${SWARA_LONG[n.sw]} · ${OCT_NAMES[String(n.oct)]}${nx ? ' · next: ' + nx.label : ''}</small>`;
      const el = list.querySelector(`.dn[data-i="${i}"]`); if (el) el.classList.add('cur');
    } else {
      const s = drill.summary();
      tgt.innerHTML = `${s.good}/${s.total}<small>in tune · ${s.warn} slightly off · ${s.bad} missed</small>`;
      $('drillSummary').textContent = s.issues.length ? 'Work on: ' + s.issues.slice(0, 6).join('; ') : 'Clean run. Try a faster laya or the next pattern.';
      $('btnDrill').textContent = 'Start'; $('btnDrill').classList.remove('on');
      drill.finished = false;
    }
    lastDrillIdx = i;
  }
}

function loop() {
  draw();
  updateNow();
  updateTaal();
  updateDrill();
  autoStrum();
  requestAnimationFrame(loop);
}

// ---------- controls ----------
// Raga picker: the active tradition's ragas in groups (thaat, or melakarta / janya), or every raga matching a search.
const DEFAULT_RAGA = { hindustani: 'yaman', carnatic: 'mela15' };
function ragaLabel(r) {
  if (r.tradition === 'carnatic') return r.id.startsWith('mela') ? `${r.mela} · ${r.name}` : `${r.name} (${r.mela})`;
  return r.name;
}
function fillRagaSelect(query = '') {
  const sel = $('ragaSel'); sel.innerHTML = '';
  const q = query.trim().toLowerCase();
  let list = RAGAS.filter((r) => (q ? (r.name.toLowerCase().includes(q) || (r.thaat || '').toLowerCase().includes(q) || String(r.mela || '').startsWith(q) || (r.mela && melaName(r.mela).toLowerCase().includes(q))) : (r.tradition === settings.tradition || r.tradition === 'any')));
  if (!list.length) list = RAGAS.filter((r) => r.tradition === settings.tradition || r.tradition === 'any');
  const THAAT_ORDER = ['Bilawal', 'Kalyan', 'Khamaj', 'Bhairav', 'Purvi', 'Marwa', 'Kafi', 'Asavari', 'Bhairavi', 'Todi'];
  if (!q && settings.tradition === 'hindustani') list = list.slice().sort((a, b) => (THAAT_ORDER.indexOf(a.thaat) + 1 || 99) - (THAAT_ORDER.indexOf(b.thaat) + 1 || 99));
  const groups = new Map();
  const groupOf = (r) => r.tradition === 'any' ? 'Open' : r.tradition === 'carnatic' ? (r.id.startsWith('mela') ? 'Melakarta (72)' : 'Janya') : (r.thaat && r.thaat !== '—' ? `${r.thaat} thaat` : 'Other');
  for (const r of list) { const g = groupOf(r); if (!groups.has(g)) groups.set(g, []); groups.get(g).push(r); }
  for (const [g, rs] of groups) {
    const og = document.createElement('optgroup'); og.label = q ? `${g}${rs[0].tradition === 'carnatic' ? ' · Carnatic' : rs[0].tradition === 'hindustani' ? ' · Hindustani' : ''}` : g;
    for (const r of rs) { const o = document.createElement('option'); o.value = r.id; o.textContent = ragaLabel(r); og.appendChild(o); }
    sel.appendChild(og);
  }
  if (!list.find((r) => r.id === settings.raga)) {
    // keep the current raga selectable (last, so Enter in the search box still picks the first match)
    const r = raga(); const og = document.createElement('optgroup'); og.label = 'Current'; const o = document.createElement('option'); o.value = r.id; o.textContent = ragaLabel(r); og.appendChild(o); sel.appendChild(og);
  }
  sel.value = settings.raga;
}
const SCHEME_RE = /^(tisra|chatusra|khanda|misra|sankeerna)_(dhruva|matya|rupaka|jhampa|triputa|ata|eka)$/;
const SCHEME_COMMON = ['tisra_eka', 'chatusra_eka', 'khanda_eka', 'tisra_triputa'];
function fillTaalSelect() {
  const sel = $('taalSel'); sel.innerHTML = '';
  const isScheme = (t) => SCHEME_RE.test(t.id) && !SCHEME_COMMON.includes(t.id);
  const groups = [
    ['Hindustani taals', TAALS.filter((t) => t.tradition !== 'carnatic')],
    ['Carnatic talas', TAALS.filter((t) => t.tradition === 'carnatic' && !isScheme(t))],
    ['35-tala scheme, the rest', TAALS.filter((t) => t.tradition === 'carnatic' && isScheme(t))],
  ];
  const order = settings.tradition === 'carnatic' ? [groups[1], groups[2], groups[0]] : groups;
  for (const [label, list] of order) { const og = document.createElement('optgroup'); og.label = label; for (const t of list) { const o = document.createElement('option'); o.value = t.id; o.textContent = t.name; og.appendChild(o); } sel.appendChild(og); }
  sel.value = settings.taal;
}
const DEFAULT_TAAL = { hindustani: 'teentaal', carnatic: 'adi' };
function setTradition(t) {
  settings.tradition = t === 'carnatic' ? 'carnatic' : 'hindustani';
  const r = raga();
  if (r.tradition !== 'any' && r.tradition !== settings.tradition) settings.raga = DEFAULT_RAGA[settings.tradition];
  if ((taal().tradition === 'carnatic') !== (settings.tradition === 'carnatic')) { settings.taal = DEFAULT_TAAL[settings.tradition]; settings.theka = 0; }
  save(); $('ragaFind').value = ''; fillRagaSelect(); fillTaalSelect(); refreshSa(); refreshRaga(); buildTaalStrip(); applyAudioSettings(); $('gamakaAware').checked = gamakaOn(); gamaka.reset();
}
function fillSelect(sel, items, value) {
  sel.innerHTML = '';
  for (const it of items) { const o = document.createElement('option'); o.value = it.value; o.textContent = it.label; sel.appendChild(o); }
  sel.value = value;
}

function onBpm(v) { settings.bpm = Math.max(20, Math.min(400, Number(v) || 80)); $('bpm').value = settings.bpm; $('bpmNum').value = settings.bpm; save(); applyAudioSettings(); setLayaWord(); setStatus(); }

function refreshSa() {
  const hz = saHz();
  const fine = settings.saCents ? ` ${settings.saCents > 0 ? '+' : ''}${settings.saCents}¢` : '';
  const car = settings.tradition === 'carnatic';
  $('saInfo').textContent = `Sa = ${noteName(settings.saMidi)}${fine} ≈ ${hz.toFixed(1)} Hz · ${kattaiOf(settings.saMidi)} kattai · ${harmoniumKeyOf(settings.saMidi)} · Pa ≈ ${(hz * 1.5).toFixed(1)} Hz · ${car ? 'tara' : 'taar'} Sa ≈ ${(hz * 2).toFixed(1)} Hz`;
  $('saFine').value = settings.saCents; $('saFineText').textContent = `${settings.saCents > 0 ? '+' : ''}${settings.saCents} ¢`;
  $('saNote').value = ((settings.saMidi % 12) + 12) % 12;
  $('saOct').value = Math.floor(settings.saMidi / 12) - 1;
  applyAudioSettings();
}

const swaraLine = (str) => tokens(str).map((t) => swaraLabel(t.sw, t.oct)).join(' ');
function refreshRaga() {
  const r = raga();
  ragaSet = r.id === 'chromatic' ? null : ragaSwaraSet(r);
  setNaming(settings.tradition, ragaSet);
  { const cm = cmap(), set = ragaSet || new Set(SWARA_ORDER); anchorCents = []; for (let oct = -2; oct <= 2; oct++) for (const sw of SWARA_ORDER) if (set.has(sw)) anchorCents.push(cm[sw] + oct * 1200); }
  ragaCtx = ragaSet ? { name: r.name, raga: r, set: ragaSet, ...ragaDirectionSets(r) } : null;
  const car = r.tradition === 'carnatic';
  const origin = car ? (r.mela && !r.id.startsWith('mela') ? `janya of mela ${r.mela} ${melaName(r.mela)}` : r.chakra ? `melakarta ${r.mela} · ${r.chakra} chakra` : '')
    : (r.thaat && r.thaat !== '—' ? `${r.thaat} thaat` : '');
  const lines = [`↑ ${swaraLine(r.aroha)}    ↓ ${swaraLine(r.avaroha)}`];
  const meta = [origin, r.time, r.note].filter(Boolean).join(' · ');
  if (meta) lines.push(meta);
  if (r.vadi) lines.push(`vadi ${SWARA_NAMES[r.vadi]} · samvadi ${SWARA_NAMES[r.samvadi]}${r.pakad ? ' · pakad: ' + r.pakad : ''}`);
  else if (r.pakad) lines.push(`phrases: ${r.pakad}`);
  $('ragaInfo').textContent = lines.join('\n');
  const pats = buildPatterns(r, settings.tradition);
  fillSelect($('patternSel'), pats.map((p) => ({ value: p.id, label: p.name })), settings.pattern);
  if (!pats.find((p) => p.id === settings.pattern)) { settings.pattern = pats[0].id; $('patternSel').value = settings.pattern; }
  applyAudioSettings();
}

function toggleShruti() {
  audio();
  const btn = $('btnShruti');
  if (shruti.running) { shruti.stop(); btn.textContent = 'Off'; btn.classList.remove('on'); }
  else { applyAudioSettings(); shruti.start(); btn.textContent = 'On'; btn.classList.add('on'); }
}
function toggleTanpura(k = 0) {
  audio();
  const tp = tanpuras[k], btn = $('btnTanpura' + k);
  if (tp.running) { tp.stop(); btn.textContent = 'Off'; btn.classList.remove('on'); }
  else { applyAudioSettings(); tp.start(); btn.textContent = 'On'; btn.classList.add('on'); }
}

// ---------- swarmandal ----------
function tuneSwarmandal() {
  if (!swarmandal) return;
  const cm = cmap(), set = ragaSet || new Set(SWARA_ORDER);
  const r = Number(settings.sm.range);
  const lo = r === 2 ? -500 : r === 3 ? -1200 : 0, hi = r === 2 ? 1900 : r === 3 ? 2400 : 1200;
  const cents = [];
  for (let oct = -1; oct <= 2; oct++) for (const sw of SWARA_ORDER) { const c = cm[sw] + oct * 1200; if (set.has(sw) && c >= lo - 1 && c <= hi + 1) cents.push(c); }
  swarmandal.tune(saHz(), cents);
  $('smInfo').textContent = `${cents.length} strings tuned to ${ragaSet ? raga().name : 'all 12 swaras'}${settings.sm.auto > 0 ? ' · strums on the sam' + (settings.sm.auto > 1 ? ' every ' + settings.sm.auto + ' avartans' : '') + (tabla && tabla.running ? '' : ' once the tabla runs, else every ' + settings.sm.auto * 8 + ' s') : ''}`;
}
let lastAutoStrum = { avartan: -1, t: 0 };
function strum(at) {
  audio(); if (!swarmandal.hz.length) tuneSwarmandal();
  swarmandal.strum(at ?? ctx.currentTime + 0.02, settings.sm.gap, Number(settings.sm.dir));
}
function autoStrum() {
  const every = Number(settings.sm.auto); if (!every || !ctx || !swarmandal) return;
  const now = ctx.currentTime;
  if (tabla && tabla.running) {
    const ns = tabla.nextSam(0.25);
    if (ns.avartan % every === 0 && ns.avartan !== lastAutoStrum.avartan && ns.t - now < 0.6) {
      lastAutoStrum = { avartan: ns.avartan, t: ns.t };
      // start early so the strum lands across the sam
      strum(Math.max(now + 0.02, ns.t - (swarmandal.hz.length * settings.sm.gap) / 2000));
    }
  } else if (now - lastAutoStrum.t > every * 8) { lastAutoStrum = { avartan: -1, t: now }; strum(); }
}

function toggleTabla() {
  audio();
  if (tabla.running) { tabla.stop(); $('btnTabla').textContent = 'Off'; $('btnTabla').classList.remove('on'); $('taalFb').textContent = 'Tabla off.'; if (drill.active) stopDrill(); }
  else { applyAudioSettings(); tabla.start(); $('btnTabla').textContent = 'On'; $('btnTabla').classList.add('on'); $('taalFb').textContent = 'Sing along. Note onsets are marked under the graph; press Space on the beat to check your own taal.'; }
  setStatus();
}

function startDrill() {
  audio();
  const pat = buildPatterns(raga(), settings.tradition).find((p) => p.id === settings.pattern);
  if (pat.taal && settings.taal !== pat.taal && TAALS.find((t) => t.id === pat.taal)) { settings.taal = pat.taal; settings.theka = 0; save(); $('taalSel').value = pat.taal; buildTaalStrip(); applyAudioSettings(); }
  if (!tabla.running) toggleTabla();
  const perNote = Number(settings.perNote) || pat.perNote || 1;
  const noteDur = perNote * tabla.matraDur;
  const t0 = tabla.nextSamTime(1.5);
  drill.start(pat.notes, cmap(), t0, noteDur);
  drillBuilt = false; $('drillSummary').textContent = '';
  $('btnDrill').textContent = 'Stop'; $('btnDrill').classList.add('on');
}
function stopDrill() {
  drill.stop(); drill.finished = false;
  $('btnDrill').textContent = 'Start'; $('btnDrill').classList.remove('on');
  $('drillTarget').innerHTML = '<small>Drill stopped.</small>';
}

function tap() {
  if (!tabla || !tabla.running) { $('tapFb').textContent = 'Start the tabla first.'; return; }
  const t = ctx.currentTime - (ctx.outputLatency || 0);
  const nm = tabla.nearestMatra(t);
  if (!nm) return;
  const ms = Math.round(nm.offset * 1000);
  tapHistory.push(ms); if (tapHistory.length > 8) tapHistory.shift();
  const mean = Math.round(tapHistory.reduce((s, v) => s + v, 0) / tapHistory.length);
  const cls = Math.abs(ms) <= 50 ? 'good' : Math.abs(ms) <= 110 ? 'warn' : 'bad';
  $('tapFb').innerHTML = `<span class="${cls}">matra ${nm.matra + 1}: ${ms > 0 ? '+' + ms + ' ms late' : ms < 0 ? ms + ' ms early' : 'spot on'}</span> · avg of last ${tapHistory.length}: ${mean > 0 ? '+' : ''}${mean} ms`;
}
const tapHistory = [];

function startDetectSa() {
  if (!micOn) { $('swaraSub').textContent = 'Start the mic first, then press Detect and hold your Sa.'; return; }
  detectSa = [];
  $('swaraSub').textContent = 'Sing and hold your Sa… (3 s)';
  $('btnDetectSa').disabled = true;
  setTimeout(() => {
    const arr = detectSa.slice().sort((a, b) => a - b); detectSa = null; $('btnDetectSa').disabled = false;
    if (arr.length < 20) { $('swaraSub').textContent = 'Could not hear a steady note. Try again, a little louder.'; return; }
    const hz = arr[arr.length >> 1];
    settings.saMidi = Math.round(hzToMidi(hz)); save(); refreshSa();
    $('swaraSub').textContent = `Sa set to ${noteName(settings.saMidi)} (you sang ${hz.toFixed(1)} Hz).`;
  }, 3000);
}

async function toggleTestTone() {
  if (testTone) { stopTestTone(); return; }
  await ensureTracker();
  if (micOn) toggleMic();
  const o = ctx.createOscillator(); o.type = 'sawtooth';
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 1500;
  const deep = /[?&]gamaka/.test(location.search);   // ?gamaka: a kampita-sized swing, for checking gamaka-aware scoring
  const lfo = ctx.createOscillator(); lfo.frequency.value = deep ? 5 : 5.5; const lfoG = ctx.createGain(); lfoG.gain.value = deep ? 110 : 5; lfo.connect(lfoG).connect(o.detune);
  const g = ctx.createGain(); g.gain.value = 0.12;
  const monitor = ctx.createGain(); monitor.gain.value = 0.25;
  o.connect(lp).connect(g); g.connect(monitor).connect(master);
  tracker.setInput(g);
  o.start(); lfo.start();
  const seq = buildPatterns(raga(), settings.tradition)[0].notes;
  let i = 0;
  const step = () => {
    const n = seq[i % seq.length]; i++;
    const wobble = (Math.random() - 0.5) * 40;              // deliberately imperfect, like a learner
    const hz = saHz() * Math.pow(2, (cmap()[n.sw] + n.oct * 1200 + wobble) / 1200);
    const now = ctx.currentTime;
    g.gain.setTargetAtTime(0, now, 0.02);                          // breathe
    o.frequency.setTargetAtTime(hz, now + 0.12, 0.02);
    g.gain.setTargetAtTime(0.12, now + 0.18, 0.02);
  };
  step();
  testTone = { o, lfo, g, timer: setInterval(step, 900) };
  $('btnTest').textContent = 'Stop tone'; $('btnTest').classList.add('on');
  setStatus();
}
function stopTestTone() {
  if (!testTone) return;
  clearInterval(testTone.timer); testTone.o.stop(); testTone.lfo.stop();
  tracker.setInput(null); testTone = null;
  $('btnTest').textContent = 'Test tone'; $('btnTest').classList.remove('on');
  setStatus();
}

function showReport() {
  const box = $('reportBox'); box.innerHTML = '';
  for (const l of guru.report(ragaCtx)) { const li = document.createElement('li'); li.className = l.cls; li.textContent = l.text; box.appendChild(li); }
}


// ---------- presets ----------
const PRESETS_KEY = 'swaraswati-presets-v1';
const PRESET_FIELDS = ['saMidi', 'saCents', 'tuning', 'raga', 'taal', 'theka', 'bpm', 'layakari', 'rampStep', 'rampMax', 'tablaVol', 'tablaEngine', 'latencyMs', 'sensitivity', 'showAll', 'pattern', 'perNote', 'zoom', 'zoomScale', 'tanpuras', 'sm', 'tradition', 'shruti', 'gamaka', 'echoCancel'];
let presets = [];
function loadPresets() { try { presets = JSON.parse(localStorage.getItem(PRESETS_KEY)) || []; } catch { presets = []; } if (!Array.isArray(presets)) presets = []; }
function savePresets() { try { localStorage.setItem(PRESETS_KEY, JSON.stringify(presets)); } catch { /* full or private */ } }
const snapshot = () => { const o = {}; for (const k of PRESET_FIELDS) o[k] = JSON.parse(JSON.stringify(settings[k])); return o; };
const presetDefaultName = () => `${raga().name} · Sa ${noteName(settings.saMidi)} · ${taal().name.replace(/ \(\d+\)/, '')} ${settings.bpm}`;
function refreshPresetList(selectName) {
  fillSelect($('presetSel'), presets.length ? presets.map((p) => ({ value: p.name, label: p.name })) : [{ value: '', label: 'no presets saved yet' }], selectName ?? (presets[0] && presets[0].name) ?? '');
  $('btnPresetLoad').disabled = $('btnPresetDelete').disabled = !presets.length;
  $('presetName').placeholder = presetDefaultName();
}
function applyPreset(p) {
  const v = p.settings || {};
  for (const k of PRESET_FIELDS) {
    if (!(k in v)) continue;
    if (k === 'zoom' && v.zoomScale !== 3) continue; // zoom saved on the old scale: keep the current one
    if (k === 'tanpuras' && Array.isArray(v.tanpuras)) v.tanpuras.forEach((t, i) => { if (settings.tanpuras[i]) Object.assign(settings.tanpuras[i], t); });
    else if (k === 'sm') Object.assign(settings.sm, v.sm);
    else if (k === 'shruti') Object.assign(settings.shruti, v.shruti);
    else if (k === 'gamaka') Object.assign(settings.gamaka, v.gamaka);
    else settings[k] = v[k];
  }
  save();
  if (drill.active) stopDrill();
  syncUI();
  $('presetInfo').textContent = `Loaded “${p.name}”.`;
}
function initPresets() {
  loadPresets(); refreshPresetList();
  $('btnPresetSave').onclick = () => {
    const name = ($('presetName').value.trim() || presetDefaultName()).slice(0, 80);
    const existing = presets.findIndex((p) => p.name === name);
    const p = { name, savedAt: new Date().toISOString(), settings: snapshot() };
    if (existing >= 0) presets[existing] = p; else presets.unshift(p);
    savePresets(); refreshPresetList(name); $('presetName').value = '';
    $('presetInfo').textContent = `${existing >= 0 ? 'Updated' : 'Saved'} “${name}”.`;
  };
  $('btnPresetLoad').onclick = () => { const p = presets.find((x) => x.name === $('presetSel').value); if (p) applyPreset(p); };
  $('presetSel').ondblclick = $('btnPresetLoad').onclick;
  $('btnPresetDelete').onclick = () => {
    const i = presets.findIndex((x) => x.name === $('presetSel').value); if (i < 0) return;
    const [gone] = presets.splice(i, 1); savePresets(); refreshPresetList();
    $('presetInfo').textContent = `Deleted “${gone.name}”.`;
  };
  $('btnPresetExport').onclick = () => {
    const data = { app: 'swaraswati', version: 1, exported: new Date().toISOString(), presets: presets.length ? presets : [{ name: presetDefaultName(), savedAt: new Date().toISOString(), settings: snapshot() }] };
    downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `swaraswati-presets-${stamp()}.json`);
    $('presetInfo').textContent = presets.length ? `Exported ${presets.length} preset${presets.length > 1 ? 's' : ''}.` : 'Exported the current setup as a preset file.';
  };
  $('btnPresetImport').onclick = () => $('presetFile').click();
  $('presetFile').onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = ''; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      const list = Array.isArray(data) ? data : Array.isArray(data.presets) ? data.presets : data.settings ? [data] : null;
      if (!list) throw new Error('not a Swaraswati preset file');
      let added = 0, updated = 0;
      for (const p of list) {
        if (!p || typeof p.name !== 'string' || typeof p.settings !== 'object') continue;
        const clean = { name: p.name.slice(0, 80), savedAt: p.savedAt || new Date().toISOString(), settings: {} };
        for (const k of PRESET_FIELDS) if (k in p.settings) clean.settings[k] = p.settings[k];
        const i = presets.findIndex((x) => x.name === clean.name);
        if (i >= 0) { presets[i] = clean; updated++; } else { presets.push(clean); added++; }
      }
      savePresets(); refreshPresetList();
      $('presetInfo').textContent = `Imported ${added} new, ${updated} updated.`;
    } catch (err) { $('presetInfo').textContent = `Could not import: ${err.message}`; }
  };
}
const stamp = () => { const d = new Date(), p = (n) => String(n).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`; };
function downloadBlob(blob, name) {
  const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 2000);
}

// ---------- recording ----------
let recDest = null, recMicGain = null, recorder = null, recChunks = [], recStart = 0, recTimer = null, recCount = 0;
function recGraph() {
  if (recDest) return;
  recDest = ctx.createMediaStreamDestination();
  master.connect(recDest);
  recMicGain = ctx.createGain(); recMicGain.gain.value = 1.0; recMicGain.connect(recDest);
}
function connectMicToRec() {
  if (!recorder || !micSource || !recMicGain || !$('recMic').checked) return;
  try { micSource.connect(recMicGain); } catch { /* already connected */ }
}
const recMime = () => ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus'].find((m) => window.MediaRecorder && MediaRecorder.isTypeSupported(m)) || '';
function toggleRecording() {
  if (recorder) { recorder.stop(); return; }
  if (!window.MediaRecorder) { $('recInfo').textContent = 'This browser cannot record audio (no MediaRecorder).'; return; }
  audio(); recGraph();
  const mimeType = recMime();
  try { recorder = new MediaRecorder(recDest.stream, mimeType ? { mimeType } : undefined); }
  catch (err) { $('recInfo').textContent = `Could not start recording: ${err.message}`; recorder = null; return; }
  recChunks = []; recStart = ctx.currentTime;
  const includeMic = $('recMic').checked;
  recorder.ondataavailable = (e) => { if (e.data && e.data.size) recChunks.push(e.data); };
  recorder.onstop = () => {
    const type = recorder.mimeType || mimeType || 'audio/webm';
    const blob = new Blob(recChunks, { type });
    const dur = ctx.currentTime - recStart;
    clearInterval(recTimer); recorder = null;
    if (micSource && recMicGain) { try { micSource.disconnect(recMicGain); } catch { /* not connected */ } }
    $('btnRec').textContent = '● Record'; $('btnRec').classList.remove('rec');
    addRecording(blob, dur, type, includeMic);
    setStatus();
  };
  connectMicToRec();
  recorder.start(1000);
  $('btnRec').textContent = '■ 0:00'; $('btnRec').classList.add('rec');
  recTimer = setInterval(() => { const sec = Math.floor(ctx.currentTime - recStart); $('btnRec').textContent = `■ ${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`; }, 500);
  $('recInfo').textContent = includeMic ? (micOn ? 'Recording the mix and your voice.' : 'Recording the mix. Start the mic to add your voice.') : 'Recording the accompaniment mix only.';
}
function addRecording(blob, dur, type, withMic) {
  recCount++;
  const ext = type.includes('mp4') ? 'm4a' : type.includes('ogg') ? 'ogg' : 'webm';
  const name = `swaraswati-${stamp()}-${raga().name.toLowerCase().replace(/[^a-z0-9]+/g, '-')}.${ext}`;
  const url = URL.createObjectURL(blob);
  const li = document.createElement('li');
  const mm = Math.floor(dur / 60), ss = String(Math.round(dur % 60)).padStart(2, '0');
  li.innerHTML = `<span>Take ${recCount} · ${mm}:${ss} · ${raga().name}${withMic ? '' : ' · mix only'} · ${(blob.size / 1048576).toFixed(1)} MB</span><a href="${url}" download="${name}">Download</a><audio controls preload="metadata" src="${url}"></audio>`;
  $('recList').prepend(li);
  $('recInfo').textContent = `Saved take ${recCount}. Press Download to keep it; recordings are lost when the page closes.`;
}
function saveReport() {
  const lines = guru.report(ragaCtx);
  const text = [`Swaraswati guru report · ${new Date().toLocaleString()}`, `Sa ${noteName(settings.saMidi)}${settings.saCents ? ` ${settings.saCents > 0 ? '+' : ''}${settings.saCents}¢` : ''} · ${raga().name} · ${taal().name} @ ${settings.bpm}`, ''].concat(lines.map((l) => l.text)).join('\n') + '\n';
  showReport();
  downloadBlob(new Blob([text], { type: 'text/plain;charset=utf-8' }), `swaraswati-report-${stamp()}.txt`);
}

// Push every setting into its control. Called at start and after a preset loads.
function syncUI() {
  $('traditionSel').value = settings.tradition; fillRagaSelect($('ragaFind').value); $('taalSel').value = settings.taal; $('tuningSel').value = settings.tuning;
  $('shrutiMode').value = settings.shruti.mode; $('shrutiVol').value = settings.shruti.vol; $('shrutiTone').value = settings.shruti.tone; $('shrutiFine').value = settings.shruti.fine;
  $('shrutiFineText').textContent = `${settings.shruti.fine > 0 ? '+' : ''}${settings.shruti.fine} ¢`;
  settings.tanpuras.forEach((tp, k) => {
    $('tpVoice' + k).value = tp.voice; $('tpString' + k).value = tp.string;
    $('tpVol' + k).value = tp.vol; $('tpTempo' + k).value = tp.tempo; $('tpJawari' + k).value = tp.jawari; $('tpFine' + k).value = tp.fine; $('tpPan' + k).value = tp.pan;
    $('tpFineText' + k).textContent = `${tp.fine > 0 ? '+' : ''}${tp.fine} ¢`;
  });
  $('smAuto').value = settings.sm.auto; $('smRange').value = settings.sm.range; $('smDir').value = settings.sm.dir; $('smGap').value = settings.sm.gap; $('smVol').value = settings.sm.vol;
  $('smGapText').textContent = `${settings.sm.gap} ms`;
  $('sens').value = settings.sensitivity; if (tracker) tracker.setSensitivity(settings.sensitivity);
  $('showAll').checked = settings.showAll; $('gamakaAware').checked = gamakaOn(); $('echoCancel').checked = !!settings.echoCancel;
  $('tablaVol').value = settings.tablaVol;
  $('bpm').value = settings.bpm; $('bpmNum').value = settings.bpm; setLayaWord();
  $('layakariSel').value = settings.layakari; $('rampStep').value = settings.rampStep; $('rampMax').value = settings.rampMax;
  $('tablaEngine').value = settings.tablaEngine;
  $('latency').value = settings.latencyMs; $('latencyText').textContent = `${settings.latencyMs} ms`;
  $('perNoteSel').value = settings.perNote;
  setZoom(settings.zoom);
  refreshSa(); refreshRaga(); buildTaalStrip(); setStatus();
}

function init() {
  fillSelect($('saNote'), NOTE_NAMES.map((n, i) => ({ value: i, label: n })), 0);
  fillSelect($('saOct'), [2, 3, 4, 5].map((o) => ({ value: o, label: `octave ${o}` })), 3);
  fillSelect($('shrutiMode'), Object.entries(SHRUTI_MODES).map(([v, o]) => ({ value: v, label: o.label })), settings.shruti.mode);
  fillTaalSelect();
  settings.tanpuras.forEach((tp, k) => {
    fillSelect($('tpVoice' + k), Object.entries(VOICES).map(([v, o]) => ({ value: v, label: o.label })), tp.voice);
    fillSelect($('tpString' + k), [{ value: 'auto', label: 'Follow raga' }].concat(Object.entries(FIRST_STRING).map(([v, o]) => ({ value: v, label: `${o.label} – Sa – Sa – Sa` }))), tp.string);
    const upd = (key, parse = Number) => (e) => { tp[key] = parse(e.target.value); save(); if (key === 'fine') $('tpFineText' + k).textContent = `${tp.fine > 0 ? '+' : ''}${tp.fine} ¢`; applyAudioSettings(); };
    $('tpVoice' + k).onchange = upd('voice', String); $('tpString' + k).onchange = upd('string', String);
    $('tpVol' + k).oninput = upd('vol'); $('tpTempo' + k).oninput = upd('tempo'); $('tpJawari' + k).oninput = upd('jawari'); $('tpFine' + k).oninput = upd('fine'); $('tpPan' + k).oninput = upd('pan');
    $('btnTanpura' + k).onclick = () => toggleTanpura(k);
  });
  const smUpd = (key) => (e) => { settings.sm[key] = Number(e.target.value); save(); if (key === 'gap') $('smGapText').textContent = `${settings.sm.gap} ms`; if (ctx) applyAudioSettings(); else if (key === 'auto' || key === 'range') $('smInfo').textContent = ''; };
  $('smAuto').onchange = smUpd('auto'); $('smRange').onchange = smUpd('range'); $('smDir').onchange = smUpd('dir'); $('smGap').oninput = smUpd('gap'); $('smVol').oninput = smUpd('vol');
  $('btnStrum').onclick = () => strum();
  syncUI();
  initPresets();
  $('btnRec').onclick = toggleRecording;
  $('recMic').onchange = (e) => { if (!recorder) return; if (e.target.checked) connectMicToRec(); else if (micSource && recMicGain) { try { micSource.disconnect(recMicGain); } catch { /* not connected */ } } };
  $('btnSaveReport').onclick = saveReport;

  const onSa = () => { settings.saMidi = (Number($('saOct').value) + 1) * 12 + Number($('saNote').value); save(); refreshSa(); };
  $('saNote').onchange = onSa; $('saOct').onchange = onSa;
  $('btnDetectSa').onclick = startDetectSa;
  $('ragaSel').onchange = (e) => { settings.raga = e.target.value; const r = raga(); if (r.tradition !== 'any' && r.tradition !== settings.tradition) { settings.tradition = r.tradition; $('traditionSel').value = r.tradition; refreshSa(); } save(); refreshRaga(); };
  $('traditionSel').onchange = (e) => setTradition(e.target.value);
  $('ragaFind').oninput = (e) => fillRagaSelect(e.target.value);
  $('ragaFind').onkeydown = (e) => { if (e.key === 'Enter') { const first = $('ragaSel').querySelector('option'); if (first) { settings.raga = first.value; $('ragaSel').onchange({ target: { value: first.value } }); } } if (e.key === 'Escape') { e.target.value = ''; fillRagaSelect(); } };
  const shUpd = (key) => (e) => { settings.shruti[key] = key === 'mode' ? e.target.value : Number(e.target.value); save(); if (key === 'fine') $('shrutiFineText').textContent = `${settings.shruti.fine > 0 ? '+' : ''}${settings.shruti.fine} ¢`; if (ctx) applyAudioSettings(); };
  $('shrutiMode').onchange = shUpd('mode'); $('shrutiVol').oninput = shUpd('vol'); $('shrutiTone').oninput = shUpd('tone'); $('shrutiFine').oninput = shUpd('fine');
  $('btnShruti').onclick = toggleShruti;
  $('tuningSel').onchange = (e) => { settings.tuning = e.target.value; save(); refreshRaga(); };
  $('echoCancel').onchange = async (e) => { settings.echoCancel = e.target.checked; save(); if (micOn) { await toggleMic(); await toggleMic(); } };
  $('gamakaAware').onchange = (e) => { settings.gamaka[settings.tradition] = e.target.checked; save(); gamaka.reset(); };
  $('sens').oninput = (e) => { settings.sensitivity = Number(e.target.value); save(); if (tracker) tracker.setSensitivity(settings.sensitivity); };
  $('showAll').onchange = (e) => { settings.showAll = e.target.checked; save(); };
  $('btnTest').onclick = toggleTestTone;
  $('btnMic').onclick = toggleMic;
  $('btnTabla').onclick = toggleTabla;
  $('taalSel').onchange = (e) => { settings.taal = e.target.value; save(); buildTaalStrip(); applyAudioSettings(); if (drill.active) stopDrill(); };
  $('bpm').oninput = (e) => onBpm(e.target.value); $('bpmNum').onchange = (e) => onBpm(e.target.value);
  $('btnTapTempo').onclick = tapTempo;
  $('thekaSel').onchange = (e) => { settings.theka = Number(e.target.value); save(); buildTaalStrip(); applyAudioSettings(); };
  $('tablaEngine').onchange = (e) => { settings.tablaEngine = e.target.value; save(); applyAudioSettings(); };
  $('layakariSel').onchange = (e) => { settings.layakari = Number(e.target.value); save(); applyAudioSettings(); setStatus(); };
  $('rampStep').onchange = (e) => { settings.rampStep = Number(e.target.value); save(); applyAudioSettings(); };
  $('rampMax').onchange = (e) => { settings.rampMax = Math.max(20, Math.min(400, Number(e.target.value) || 160)); $('rampMax').value = settings.rampMax; save(); applyAudioSettings(); };
  $('saFine').oninput = (e) => { settings.saCents = Number(e.target.value); save(); refreshSa(); };
  $('tablaVol').oninput = (e) => { settings.tablaVol = Number(e.target.value); save(); if (tabla) tabla.setVolume(settings.tablaVol); };
  $('latency').oninput = (e) => { settings.latencyMs = Number(e.target.value); $('latencyText').textContent = `${settings.latencyMs} ms`; save(); };
  $('btnTap').onclick = tap;
  $('patternSel').onchange = (e) => { settings.pattern = e.target.value; save(); };
  $('perNoteSel').onchange = (e) => { settings.perNote = Number(e.target.value); save(); };
  $('btnDrill').onclick = () => (drill.active ? stopDrill() : startDrill());
  $('btnReport').onclick = showReport;
  $('btnResetReport').onclick = () => { guru.reset(); $('reportBox').innerHTML = ''; };

  // zoom: buttons, ⌘/Ctrl+wheel or trackpad pinch over the trace, keyboard + / - / 0
  $('zoomIn').onclick = () => setZoom(zoom() + ZOOM_STEP);
  $('zoomOut').onclick = () => setZoom(zoom() - ZOOM_STEP);
  $('zoomReset').onclick = () => setZoom(ZOOM_DEFAULT);
  cv.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(zoom() - e.deltaY * 0.004);
  }, { passive: false });
  let pinch = null;
  cv.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: zoom() }; }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    setZoom(pinch.z + Math.log2(d / pinch.d) * 1.5);
  }, { passive: false });
  cv.addEventListener('touchend', () => { pinch = null; });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); tap(); }
    else if (e.key === 't' || e.key === 'T') toggleTabla();
    else if (e.key === 'd' || e.key === 'D') toggleTanpura(0);
    else if (e.key === 's' || e.key === 'S') strum();
    else if (e.key === 'p' || e.key === 'P') toggleShruti();
    else if (e.key === 'r' || e.key === 'R') toggleRecording();
    else if (e.key === 'm' || e.key === 'M') toggleMic();
    else if (e.key === '+' || e.key === '=') setZoom(zoom() + ZOOM_STEP);
    else if (e.key === '-' || e.key === '_') setZoom(zoom() - ZOOM_STEP);
    else if (e.key === '0') setZoom(ZOOM_DEFAULT);
  });

  requestAnimationFrame(loop);
}
init();

// Debug hook (harmless in production): inspect live state from the console.
window.swaraswatiDebug = () => ({ now: ctx ? ctx.currentTime : null, lastFrame, current, hCount, micOn, testTone: !!testTone, tablaEvents: tabla ? tabla.events.length : 0, kit: tabla ? { ready: tabla.kit.ready, failed: tabla.kit.failed, played: tabla.kit.played, rate: tabla.kit.dayanRate } : null, tanpuras: tanpuras.map((t) => t.running), shruti: shruti ? { running: shruti.running, voices: shruti.voices.length, mode: shruti.mode } : null, naming: SWARA_NAMES.g + '/' + SWARA_NAMES.n, gam: current && current.gam ? { anchor: Math.round(current.gam.anchor), basis: current.gam.basis, span: Math.round(current.gam.span), rate: Math.round(current.gam.rate * 10) / 10, anchored: current.gam.anchored } : null, gamakaOn: gamakaOn(), maskedFrames, strokeTimes: tabla ? tabla.strokeTimes.length : 0, outputLatency: ctx ? ctx.outputLatency : null, lastStroke: tabla && tabla.strokeTimes.length ? tabla.strokeTimes[tabla.strokeTimes.length - 1] : null, echoCancel: settings.echoCancel, micInfo: $('micInfo').textContent, tpKit: tanpuras[0] ? { ready: tanpuras[0].kit.ready, failed: tanpuras[0].kit.failed, strings: tanpuras[0].kit.strings.map((x) => ({ role: x.role, name: x.name, hz: Math.round(x.hz * 10) / 10, gain: Math.round(x.gain * 100) / 100, onset: Math.round(x.onset * 1000) })), played: tanpuras[0].kit.played, sampledPlucks: tanpuras.map((t) => t.sampledPlucks), voices: tanpuras.map((t) => t.voiceId) } : null, strings: swarmandal ? swarmandal.hz.length : 0, plucks: swarmandal ? swarmandal.plucks : 0 });

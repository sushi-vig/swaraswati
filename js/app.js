import { SWARA_ORDER, SWARA_NAMES, SWARA_LONG, OCT_NAMES, CENTS_JI, CENTS_ET, NOTE_NAMES, midiToHz, hzToMidi, noteName, nearestSwara, swaraLabel } from './music.js';
import { RAGAS, ragaSwaraSet, ragaDirectionSets } from './ragas.js';
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
  sm: { auto: 0, range: 2, dir: 0, gap: 45, vol: 0.5 }, sensitivity: 0.6, latencyMs: 40, drone: 'auto', showAll: false, pattern: 'aroha', perNote: 1, zoom: 1, saCents: 0, theka: 0, layakari: 1, rampStep: 0, rampMax: 160 };
const settings = Object.assign({}, defaults, load());
// migrate pre-tanpura-pair settings
if (!Array.isArray(settings.tanpuras) || settings.tanpuras.length !== 2) settings.tanpuras = defaults.tanpuras.map((t) => ({ ...t }));
settings.tanpuras = settings.tanpuras.map((t, i) => Object.assign({}, defaults.tanpuras[i], t));
if (settings.drone && settings.drone !== 'auto' && !settings.tanpurasMigrated) { settings.tanpuras[0].string = settings.drone; settings.tanpuras[0].vol = settings.tanpuraVol; }
settings.tanpurasMigrated = true;
settings.sm = Object.assign({}, defaults.sm, settings.sm || {});
function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(LS, JSON.stringify(settings)); } catch { /* private mode */ } }

// ---------- audio graph ----------
let ctx = null, master = null, tanpura = null, tanpuras = [], swarmandal = null, tabla = null, tracker = null, micStream = null, micSource = null, testTone = null;
const guru = new Guru();
const drill = new Drill();
let micOn = false;

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    tanpuras = [new Tanpura(ctx, master), new Tanpura(ctx, master)];
    tanpura = tanpuras[0];
    swarmandal = new Swarmandal(ctx, master);
    tabla = new Tabla(ctx, master);
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
  tabla.setSa(saHz());
  tabla.setTaal(taal(), settings.theka);
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
    $('btnMic').textContent = 'Start mic'; $('btnMic').classList.remove('on');
    setStatus(); return;
  }
  try {
    $('btnMic').textContent = 'Starting…';
    await ensureTracker();
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false, channelCount: 1 } });
    micSource = ctx.createMediaStreamSource(micStream);
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
const hT = new Float64Array(N), hC = new Float32Array(N), hD = new Float32Array(N);
let hHead = 0, hCount = 0, lastFrame = null;
function pushHist(t, c, d) { hT[hHead] = t; hC[hHead] = c; hD[hHead] = d; hHead = (hHead + 1) % N; if (hCount < N) hCount++; }

const onsets = [];        // { t, offsetMs|null }
const med = [];
let lastVoicedT = -1, lastCents = NaN, current = null, detectSa = null;

function onFrame(fr) {
  lastFrame = fr;
  const t = fr.t;
  if (fr.f0 > 0) {
    const raw = 1200 * Math.log2(fr.f0 / saHz());
    med.push(raw); if (med.length > 3) med.shift();
    const sorted = med.slice().sort((a, b) => a - b);
    const c = sorted[sorted.length >> 1];
    const info = nearestSwara(c, cmap());
    const rInfo = ragaSet ? nearestSwara(c, cmap(), ragaSet) : info;
    const inRaga = !ragaSet || ragaSet.has(info.sw);
    pushHist(t, c, rInfo.dev);
    const gap = lastVoicedT < 0 ? 1 : t - lastVoicedT;
    if (gap > 0.12 || Math.abs(c - lastCents) > 70) registerOnset(t);
    lastVoicedT = t; lastCents = c;
    current = { t, cents: c, hz: fr.f0, info, rInfo, inRaga, clarity: fr.clarity };
    guru.addFrame(t, info, rInfo, inRaga, ragaCtx);
    drill.addFrame(t, c, info);
    if (detectSa) detectSa.push(fr.f0);
  } else {
    med.length = 0;
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
const LABEL_W = 54, BASE_WINDOW_SEC = 12;
const ZOOM_MIN = 0.5, ZOOM_MAX = 6;
const view = { lo: -400, hi: 1500 };
// Zoom: vertical span shrinks with the zoom factor; the time window shrinks more gently.
const zoom = () => Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, settings.zoom || 1));
const windowSec = () => Math.min(24, Math.max(4, BASE_WINDOW_SEC / Math.sqrt(zoom())));
function setZoom(z) {
  settings.zoom = Math.round(Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) * 100) / 100; save();
  $('zoomText').textContent = `${settings.zoom.toFixed(settings.zoom < 1 || settings.zoom % 1 ? 1 : 0)}×`;
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

  // auto-range on visible voiced points
  let mn = Infinity, mx = -Infinity;
  for (let k = 0; k < hCount; k++) {
    const i = (hHead - 1 - k + N) % N;
    if (hT[i] < tMin) break;
    const c = hC[i]; if (c !== c) continue; // NaN check
    if (c < mn) mn = c; if (c > mx) mx = c;
  }
  if (mn !== Infinity) {
    // Zoomed in: follow the latest pitch tightly; zoomed out: fit every visible point.
    const pad = 250 / z, minSpan = 1100 / z;
    let lo, hi;
    if (z > 1.5 && current) { const span = Math.max(minSpan, (mx - mn) / z + pad); lo = current.cents - span / 2; hi = current.cents + span / 2; }
    else { lo = mn - pad; hi = mx + pad; if (hi - lo < minSpan) { const mid = (lo + hi) / 2; lo = mid - minSpan / 2; hi = mid + minSpan / 2; } }
    view.lo += (lo - view.lo) * 0.05; view.hi += (hi - view.hi) * 0.05;
  } else if (Math.abs((view.hi - view.lo) - 1100 / z) > 1) {
    // nothing sung yet: settle on the default span for this zoom level around Sa..Sa'
    const mid = (view.lo + view.hi) / 2, span = 1100 / z;
    view.lo += (mid - span / 2 - view.lo) * 0.05; view.hi += (mid + span / 2 - view.hi) * 0.05;
  }

  g.fillStyle = '#f6eedb'; g.fillRect(0, 0, cw, chh);

  // beat grid
  if (tabla && tabla.running) {
    for (const ev of tabla.events) {
      const x = xOf(ev.t); if (x < LABEL_W || x > cw) continue;
      const meta = tabla.meta[ev.matra];
      g.strokeStyle = ev.matra === 0 ? 'rgba(125,42,30,0.55)' : meta.startsVibhag ? 'rgba(60,40,20,0.28)' : 'rgba(60,40,20,0.12)';
      g.lineWidth = ev.matra === 0 ? 2 : 1;
      g.beginPath(); g.moveTo(x, 0); g.lineTo(x, chh); g.stroke();
      if (ev.matra === 0) { g.fillStyle = 'rgba(125,42,30,0.9)'; g.font = 'italic 11px "Crimson Pro", Georgia, serif'; g.fillText('sam', x + 4, 12); }
    }
  }

  // swara lines
  const cm = cmap();
  g.font = '600 13px "Cormorant Garamond", Georgia, serif'; g.textBaseline = 'middle';
  for (let oct = -2; oct <= 2; oct++) {
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
      g.fillText(swaraLabel(sw, oct), 6, y);
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
    g.fillStyle = devColor(hD[i]);
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

function updateNow() {
  if (current && ctx && ctx.currentTime - current.t < 0.35) {
    const { info, rInfo, inRaga, hz } = current;
    $('swaraBig').textContent = SWARA_NAMES[info.sw];
    $('swaraOct').textContent = OCT_NAMES[String(info.oct)] || '';
    $('swaraBig').style.color = inRaga ? '' : 'var(--bad)';
    $('swaraSub').textContent = inRaga ? `${SWARA_LONG[info.sw]}${ragaSet ? ' · in ' + raga().name : ''}` : `${SWARA_LONG[info.sw]} — not in ${raga().name} (nearest: ${SWARA_LONG[rInfo.sw]})`;
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
  $('taalNote').textContent = `${t.vibhags.join(' + ')} · ${t.note || ''}`;
  strip.innerHTML = '';
  let group = null;
  th.bols.forEach((bol, i) => {
    if (meta[i].startsVibhag) { group = document.createElement('div'); group.className = 'vibhag'; strip.appendChild(group); }
    const m = document.createElement('div');
    m.className = 'matra' + (i === 0 ? ' sam' : ''); m.dataset.i = i;
    m.innerHTML = `<span class="mark">${meta[i].mark}</span>${bolLabel(bol)}<span class="num">${i + 1}</span>`;
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
function fillSelect(sel, items, value) {
  sel.innerHTML = '';
  for (const it of items) { const o = document.createElement('option'); o.value = it.value; o.textContent = it.label; sel.appendChild(o); }
  sel.value = value;
}

function onBpm(v) { settings.bpm = Math.max(20, Math.min(400, Number(v) || 80)); $('bpm').value = settings.bpm; $('bpmNum').value = settings.bpm; save(); applyAudioSettings(); setLayaWord(); setStatus(); }

function refreshSa() {
  const hz = saHz();
  const fine = settings.saCents ? ` ${settings.saCents > 0 ? '+' : ''}${settings.saCents}¢` : '';
  $('saInfo').textContent = `Sa = ${noteName(settings.saMidi)}${fine} ≈ ${hz.toFixed(1)} Hz · Pa ≈ ${(hz * 1.5).toFixed(1)} Hz · taar Sa ≈ ${(hz * 2).toFixed(1)} Hz`;
  $('saFine').value = settings.saCents; $('saFineText').textContent = `${settings.saCents > 0 ? '+' : ''}${settings.saCents} ¢`;
  $('saNote').value = ((settings.saMidi % 12) + 12) % 12;
  $('saOct').value = Math.floor(settings.saMidi / 12) - 1;
  applyAudioSettings();
}

function refreshRaga() {
  const r = raga();
  ragaSet = r.id === 'chromatic' ? null : ragaSwaraSet(r);
  ragaCtx = ragaSet ? { name: r.name, raga: r, set: ragaSet, ...ragaDirectionSets(r) } : null;
  $('ragaInfo').textContent = `↑ ${r.aroha}    ↓ ${r.avaroha}${r.time ? '    (' + r.time + ')' : ''}`
    + (r.vadi ? `\nvadi ${SWARA_NAMES[r.vadi]} · samvadi ${SWARA_NAMES[r.samvadi]} · pakad: ${r.pakad}` : '');
  const pats = buildPatterns(r);
  fillSelect($('patternSel'), pats.map((p) => ({ value: p.id, label: p.name })), settings.pattern);
  if (!pats.find((p) => p.id === settings.pattern)) { settings.pattern = pats[0].id; $('patternSel').value = settings.pattern; }
  applyAudioSettings();
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
  if (!tabla.running) toggleTabla();
  const pat = buildPatterns(raga()).find((p) => p.id === settings.pattern);
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
  const lfo = ctx.createOscillator(); lfo.frequency.value = 5.5; const lfoG = ctx.createGain(); lfoG.gain.value = 5; lfo.connect(lfoG).connect(o.detune);
  const g = ctx.createGain(); g.gain.value = 0.12;
  const monitor = ctx.createGain(); monitor.gain.value = 0.25;
  o.connect(lp).connect(g); g.connect(monitor).connect(master);
  tracker.setInput(g);
  o.start(); lfo.start();
  const seq = buildPatterns(raga())[0].notes;
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
const PRESET_FIELDS = ['saMidi', 'saCents', 'tuning', 'raga', 'taal', 'theka', 'bpm', 'layakari', 'rampStep', 'rampMax', 'tablaVol', 'latencyMs', 'sensitivity', 'showAll', 'pattern', 'perNote', 'zoom', 'tanpuras', 'sm'];
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
    if (k === 'tanpuras' && Array.isArray(v.tanpuras)) v.tanpuras.forEach((t, i) => { if (settings.tanpuras[i]) Object.assign(settings.tanpuras[i], t); });
    else if (k === 'sm') Object.assign(settings.sm, v.sm);
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
  $('ragaSel').value = settings.raga; $('taalSel').value = settings.taal; $('tuningSel').value = settings.tuning;
  settings.tanpuras.forEach((tp, k) => {
    $('tpVoice' + k).value = tp.voice; $('tpString' + k).value = tp.string;
    $('tpVol' + k).value = tp.vol; $('tpTempo' + k).value = tp.tempo; $('tpJawari' + k).value = tp.jawari; $('tpFine' + k).value = tp.fine; $('tpPan' + k).value = tp.pan;
    $('tpFineText' + k).textContent = `${tp.fine > 0 ? '+' : ''}${tp.fine} ¢`;
  });
  $('smAuto').value = settings.sm.auto; $('smRange').value = settings.sm.range; $('smDir').value = settings.sm.dir; $('smGap').value = settings.sm.gap; $('smVol').value = settings.sm.vol;
  $('smGapText').textContent = `${settings.sm.gap} ms`;
  $('sens').value = settings.sensitivity; if (tracker) tracker.setSensitivity(settings.sensitivity);
  $('showAll').checked = settings.showAll;
  $('tablaVol').value = settings.tablaVol;
  $('bpm').value = settings.bpm; $('bpmNum').value = settings.bpm; setLayaWord();
  $('layakariSel').value = settings.layakari; $('rampStep').value = settings.rampStep; $('rampMax').value = settings.rampMax;
  $('latency').value = settings.latencyMs; $('latencyText').textContent = `${settings.latencyMs} ms`;
  $('perNoteSel').value = settings.perNote;
  setZoom(settings.zoom);
  refreshSa(); refreshRaga(); buildTaalStrip(); setStatus();
}

function init() {
  fillSelect($('saNote'), NOTE_NAMES.map((n, i) => ({ value: i, label: n })), 0);
  fillSelect($('saOct'), [2, 3, 4, 5].map((o) => ({ value: o, label: `octave ${o}` })), 3);
  fillSelect($('ragaSel'), RAGAS.map((r) => ({ value: r.id, label: r.thaat && r.thaat !== '—' ? `${r.name} (${r.thaat})` : r.name })), settings.raga);
  fillSelect($('taalSel'), TAALS.map((t) => ({ value: t.id, label: t.name })), settings.taal);
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
  $('ragaSel').onchange = (e) => { settings.raga = e.target.value; save(); refreshRaga(); };
  $('tuningSel').onchange = (e) => { settings.tuning = e.target.value; save(); applyAudioSettings(); };
  $('sens').oninput = (e) => { settings.sensitivity = Number(e.target.value); save(); if (tracker) tracker.setSensitivity(settings.sensitivity); };
  $('showAll').onchange = (e) => { settings.showAll = e.target.checked; save(); };
  $('btnTest').onclick = toggleTestTone;
  $('btnMic').onclick = toggleMic;
  $('btnTabla').onclick = toggleTabla;
  $('taalSel').onchange = (e) => { settings.taal = e.target.value; save(); buildTaalStrip(); applyAudioSettings(); if (drill.active) stopDrill(); };
  $('bpm').oninput = (e) => onBpm(e.target.value); $('bpmNum').onchange = (e) => onBpm(e.target.value);
  $('btnTapTempo').onclick = tapTempo;
  $('thekaSel').onchange = (e) => { settings.theka = Number(e.target.value); save(); buildTaalStrip(); applyAudioSettings(); };
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
  $('zoomIn').onclick = () => setZoom(zoom() * 1.25);
  $('zoomOut').onclick = () => setZoom(zoom() / 1.25);
  $('zoomReset').onclick = () => setZoom(1);
  cv.addEventListener('wheel', (e) => {
    if (!(e.ctrlKey || e.metaKey)) return;
    e.preventDefault();
    setZoom(zoom() * Math.exp(-e.deltaY * 0.01));
  }, { passive: false });
  let pinch = null;
  cv.addEventListener('touchstart', (e) => { if (e.touches.length === 2) pinch = { d: Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY), z: zoom() }; }, { passive: true });
  cv.addEventListener('touchmove', (e) => {
    if (!pinch || e.touches.length !== 2) return;
    e.preventDefault();
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    setZoom(pinch.z * (d / pinch.d));
  }, { passive: false });
  cv.addEventListener('touchend', () => { pinch = null; });

  window.addEventListener('keydown', (e) => {
    if (e.target.matches('input, select, textarea')) return;
    if (e.code === 'Space') { e.preventDefault(); tap(); }
    else if (e.key === 't' || e.key === 'T') toggleTabla();
    else if (e.key === 'd' || e.key === 'D') toggleTanpura(0);
    else if (e.key === 's' || e.key === 'S') strum();
    else if (e.key === 'r' || e.key === 'R') toggleRecording();
    else if (e.key === 'm' || e.key === 'M') toggleMic();
    else if (e.key === '+' || e.key === '=') setZoom(zoom() * 1.25);
    else if (e.key === '-' || e.key === '_') setZoom(zoom() / 1.25);
    else if (e.key === '0') setZoom(1);
  });

  requestAnimationFrame(loop);
}
init();

// Debug hook (harmless in production): inspect live state from the console.
window.swaraswatiDebug = () => ({ now: ctx ? ctx.currentTime : null, lastFrame, current, hCount, micOn, testTone: !!testTone, tablaEvents: tabla ? tabla.events.length : 0, tanpuras: tanpuras.map((t) => t.running), strings: swarmandal ? swarmandal.hz.length : 0, plucks: swarmandal ? swarmandal.plucks : 0 });

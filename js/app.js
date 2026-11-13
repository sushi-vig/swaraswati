import { SWARA_ORDER, SWARA_NAMES, SWARA_LONG, OCT_NAMES, CENTS_JI, CENTS_ET, NOTE_NAMES, midiToHz, hzToMidi, noteName, nearestSwara, swaraLabel } from './music.js';
import { RAGAS, ragaSwaraSet, ragaDirectionSets } from './ragas.js';
import { TAALS, matraMeta } from './taals.js';
import { Tanpura } from './tanpura.js';
import { Tabla } from './tabla.js';
import { PitchTracker } from './pitch.js';
import { Guru } from './guru.js';
import { Drill, buildPatterns } from './drill.js';

const $ = (id) => document.getElementById(id);
const LS = 'swaraswati-settings-v1';
const defaults = { saMidi: 57, tuning: 'ji', raga: 'yaman', taal: 'teentaal', bpm: 80, tanpuraVol: 0.3, tablaVol: 0.7, sensitivity: 0.6, latencyMs: 40, drone: 'auto', showAll: false, pattern: 'aroha', perNote: 1, zoom: 1 };
const settings = Object.assign({}, defaults, load());
function load() { try { return JSON.parse(localStorage.getItem(LS)) || {}; } catch { return {}; } }
function save() { try { localStorage.setItem(LS, JSON.stringify(settings)); } catch { /* private mode */ } }

// ---------- audio graph ----------
let ctx = null, master = null, tanpura = null, tabla = null, tracker = null, micStream = null, micSource = null, testTone = null;
const guru = new Guru();
const drill = new Drill();
let micOn = false;

function audio() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)({ latencyHint: 'interactive' });
    master = ctx.createGain(); master.gain.value = 0.9; master.connect(ctx.destination);
    tanpura = new Tanpura(ctx, master);
    tabla = new Tabla(ctx, master);
    applyAudioSettings();
  }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}
const saHz = () => midiToHz(settings.saMidi);
const cmap = () => (settings.tuning === 'et' ? CENTS_ET : CENTS_JI);
const raga = () => RAGAS.find((r) => r.id === settings.raga) || RAGAS[0];
const taal = () => TAALS.find((t) => t.id === settings.taal) || TAALS[0];
const droneString = () => (settings.drone === 'auto' ? raga().drone || 'P' : settings.drone);
let ragaSet = null, ragaCtx = null;

function applyAudioSettings() {
  if (!ctx) return;
  tanpura.configure(saHz(), droneString());
  tanpura.setVolume(settings.tanpuraVol);
  tabla.setSa(saHz());
  tabla.setTaal(taal());
  tabla.bpm = settings.bpm;
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
  if (tabla && tabla.running) parts.push(`${taal().name.split(' ')[0]} @ ${settings.bpm}`);
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
  strip.innerHTML = '';
  let group = null;
  t.bols.forEach((bol, i) => {
    if (meta[i].startsVibhag) { group = document.createElement('div'); group.className = 'vibhag'; strip.appendChild(group); }
    const m = document.createElement('div');
    m.className = 'matra' + (i === 0 ? ' sam' : ''); m.dataset.i = i;
    m.innerHTML = `<span class="mark">${meta[i].mark}</span>${bol}<span class="num">${i + 1}</span>`;
    group.appendChild(m);
  });
  lastMatraIdx = -1;
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
  requestAnimationFrame(loop);
}

// ---------- controls ----------
function fillSelect(sel, items, value) {
  sel.innerHTML = '';
  for (const it of items) { const o = document.createElement('option'); o.value = it.value; o.textContent = it.label; sel.appendChild(o); }
  sel.value = value;
}

function refreshSa() {
  const hz = saHz();
  $('saInfo').textContent = `Sa = ${noteName(settings.saMidi)} ≈ ${hz.toFixed(1)} Hz · Pa ≈ ${(hz * 1.5).toFixed(1)} Hz · taar Sa ≈ ${(hz * 2).toFixed(1)} Hz`;
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

function toggleTanpura() {
  audio();
  if (tanpura.running) { tanpura.stop(); $('btnTanpura').textContent = 'Off'; $('btnTanpura').classList.remove('on'); }
  else { applyAudioSettings(); tanpura.start(); $('btnTanpura').textContent = 'On'; $('btnTanpura').classList.add('on'); }
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

function init() {
  fillSelect($('saNote'), NOTE_NAMES.map((n, i) => ({ value: i, label: n })), 0);
  fillSelect($('saOct'), [2, 3, 4, 5].map((o) => ({ value: o, label: `octave ${o}` })), 3);
  fillSelect($('ragaSel'), RAGAS.map((r) => ({ value: r.id, label: r.thaat && r.thaat !== '—' ? `${r.name} (${r.thaat})` : r.name })), settings.raga);
  fillSelect($('taalSel'), TAALS.map((t) => ({ value: t.id, label: t.name })), settings.taal);
  $('tuningSel').value = settings.tuning;
  $('droneSel').value = settings.drone;
  $('sens').value = settings.sensitivity;
  $('showAll').checked = settings.showAll;
  $('tanpuraVol').value = settings.tanpuraVol;
  $('tablaVol').value = settings.tablaVol;
  $('bpm').value = settings.bpm; $('bpmNum').value = settings.bpm;
  $('latency').value = settings.latencyMs; $('latencyText').textContent = `${settings.latencyMs} ms`;
  $('perNoteSel').value = settings.perNote;
  refreshSa(); refreshRaga(); buildTaalStrip();

  const onSa = () => { settings.saMidi = (Number($('saOct').value) + 1) * 12 + Number($('saNote').value); save(); refreshSa(); };
  $('saNote').onchange = onSa; $('saOct').onchange = onSa;
  $('btnDetectSa').onclick = startDetectSa;
  $('ragaSel').onchange = (e) => { settings.raga = e.target.value; save(); refreshRaga(); };
  $('tuningSel').onchange = (e) => { settings.tuning = e.target.value; save(); };
  $('sens').oninput = (e) => { settings.sensitivity = Number(e.target.value); save(); if (tracker) tracker.setSensitivity(settings.sensitivity); };
  $('showAll').onchange = (e) => { settings.showAll = e.target.checked; save(); };
  $('btnTest').onclick = toggleTestTone;
  $('btnMic').onclick = toggleMic;
  $('btnTanpura').onclick = toggleTanpura;
  $('droneSel').onchange = (e) => { settings.drone = e.target.value; save(); applyAudioSettings(); };
  $('tanpuraVol').oninput = (e) => { settings.tanpuraVol = Number(e.target.value); save(); if (tanpura) tanpura.setVolume(settings.tanpuraVol); };
  $('btnTabla').onclick = toggleTabla;
  $('taalSel').onchange = (e) => { settings.taal = e.target.value; save(); buildTaalStrip(); applyAudioSettings(); if (drill.active) stopDrill(); };
  const onBpm = (v) => { settings.bpm = Math.max(30, Math.min(300, Number(v) || 80)); $('bpm').value = settings.bpm; $('bpmNum').value = settings.bpm; save(); applyAudioSettings(); setStatus(); };
  $('bpm').oninput = (e) => onBpm(e.target.value); $('bpmNum').onchange = (e) => onBpm(e.target.value);
  $('tablaVol').oninput = (e) => { settings.tablaVol = Number(e.target.value); save(); if (tabla) tabla.setVolume(settings.tablaVol); };
  $('latency').oninput = (e) => { settings.latencyMs = Number(e.target.value); $('latencyText').textContent = `${settings.latencyMs} ms`; save(); };
  $('btnTap').onclick = tap;
  $('patternSel').onchange = (e) => { settings.pattern = e.target.value; save(); };
  $('perNoteSel').onchange = (e) => { settings.perNote = Number(e.target.value); save(); };
  $('btnDrill').onclick = () => (drill.active ? stopDrill() : startDrill());
  $('btnReport').onclick = showReport;
  $('btnResetReport').onclick = () => { guru.reset(); $('reportBox').innerHTML = ''; };

  // zoom: buttons, ⌘/Ctrl+wheel or trackpad pinch over the trace, keyboard + / - / 0
  setZoom(settings.zoom);
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
    else if (e.key === 'd' || e.key === 'D') toggleTanpura();
    else if (e.key === 'm' || e.key === 'M') toggleMic();
    else if (e.key === '+' || e.key === '=') setZoom(zoom() * 1.25);
    else if (e.key === '-' || e.key === '_') setZoom(zoom() / 1.25);
    else if (e.key === '0') setZoom(1);
  });

  requestAnimationFrame(loop);
}
init();

// Debug hook (harmless in production): inspect live state from the console.
window.swaraswatiDebug = () => ({ now: ctx ? ctx.currentTime : null, lastFrame, current, hCount, micOn, testTone: !!testTone, tablaEvents: tabla ? tabla.events.length : 0 });

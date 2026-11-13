# Swaraswati

A browser-based practice companion for Hindustani classical vocal riyaz: a shruti (pitch) monitor,
a synthesised tanpura, a synthesised tabla with 22 taals and theka variations, sargam drills, and a "guru" panel
that tells you which swaras drift, by how much, and when you stray outside the raga.

No build step, no dependencies. Everything is vanilla JS + Web Audio + Canvas.

## Run it

AudioWorklets cannot load from `file://`, so serve the folder over HTTP:

```bash
python3 -m http.server 8787
```

then open <http://localhost:8787>. Use headphones (or keep the speaker away from the mic) so the
tanpura and tabla are not picked up as "your voice".

## How to practise with it

1. **Set your Sa.** Pick it from the dropdown, or press *Detect*, sing and hold your Sa for 3 seconds.
2. **Pick a raga.** The graph draws bright lines only for the raga's swaras; everything else is faint.
   The trace turns red when you are nearer a swara that is not in the raga.
3. **Start the tanpura** (D) and sing. The big display shows the swara, its cents deviation, and a live hint
   (flat / sharp / wavering / out of raga).
4. **Start the tabla** (T), pick a taal and laya. The current matra lights up in the theka strip.
   Your note onsets are marked under the graph and compared with the nearest matra.
   Press **Space** on the beat to test your own taal: it reports early/late in ms.
5. **Sargam drill.** Choose a pattern (aroha-avaroha, pairs, triples, long holds, Sa-swara-Sa) and press Start.
   It begins on the next sam, shows the target swara each matra, and scores every note.
6. **Guru report.** Press *Show* for a session summary: % in tune, which swaras tend sharp or flat,
   wobble, and any out-of-raga swaras with the swara you probably meant.

## Features in detail

- **Zoom the swara trace** with the − / + buttons on the chart, ⌘/Ctrl + scroll, a trackpad pinch, or the `+` `-` `0` keys.
  Zoomed in, faint guides mark ±15¢ (in tune) and ±35¢ (close) around each swara line and the view follows the note you are singing.
- **Guru report** speaks like a teacher: it knows each raga's vadi, samvadi and pakad, catches swaras that do not belong,
  swaras used against the aroha/avaroha, notes you never visited, and ends with homework built around the pakad.
- **Taal library**: 22 taals with 44 thekas (variations such as filled, vilambit, drut, dholak-style). Bols inside a matra
  can be subdivided (`- Dhin`, `Dha Ge`, `Tirkit`). Pick the theka under the taal.
- **Laya**: 20 to 400 bpm with the laya name (vilambit, madhya, drut), tap tempo, layakari (ekgun / dugun / chaugun plays
  the theka at 1×, 2× or 4× density inside the same avartan), and a tempo ramp of +N bpm per avartan up to a cap.
- **Fine-tune Sa** in cents; the tanpura and tabla follow.

## Architecture

| File | Role |
| --- | --- |
| `js/pitch-worklet.js` | AudioWorklet that only captures audio and ships 1024-sample chunks. No DSP on the audio thread, so playback never glitches. |
| `js/pitch-worker.js` | Web Worker running the McLeod Pitch Method (NSDF) with an adaptive noise-floor gate. Window 2048, hop 1024, m(τ) via cumulative sums, no per-frame allocation. |
| `js/pitch.js` | Glue: worklet → worker (direct MessageChannel, with main-thread fallback) → `onFrame`. |
| `js/music.js` | Swara tables (just intonation and equal temperament), token grammar, nearest-swara lookup. |
| `js/ragas.js` / `js/taals.js` | Raga and theka data. Add your own here. |
| `js/tanpura.js` | 4-string tanpura with jawari swell. |
| `js/tabla.js` | Synthesised dayan/bayan strokes, look-ahead scheduler, matra lookup for timing feedback. |
| `js/guru.js` | Per-swara statistics, live hints, session report. |
| `js/drill.js` | Alankar pattern generation and note-by-note scoring. |
| `js/app.js` | UI wiring, ring-buffer pitch history, canvas rendering. |

### Why this is lighter than shruti-monitor

- Pitch detection runs once, in a worker, instead of on the audio thread (and again on the main thread).
- The NSDF normaliser is computed from cumulative sums, halving the inner-loop work; buffers are pre-allocated.
- History lives in fixed typed-array ring buffers; the canvas only draws the visible 12 s.
- The voicing gate adapts to the room's noise floor rather than using fixed thresholds, so softer singing is caught
  while a steady drone is treated as background.

## Token grammar for ragas and drills

`S r R g G m M P d D n N` (lowercase = komal, `M` = tivra Ma). `'` suffix = taar saptak, `.` prefix = mandra saptak.
Example: `.N R G M D N S'`.

## Ideas for later

- Sample-based tabla (record a real set) and lehra.
- Record and replay a session with the pitch trace.
- Per-raga pakad / chalan drills and meend detection.
- Export the guru report to share with your teacher.

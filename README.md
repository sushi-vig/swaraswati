# Swaraswati

A browser-based practice companion for Indian classical vocal riyaz, Hindustani and Carnatic: a shruti (pitch) monitor,
two tanpuras, a shruti petti and a swarmandal, a tabla with real stroke recordings and 22 taals with theka variations, sargam drills,
a raga library of 77 Hindustani ragas, all 72 melakartas and 78 janya ragas, and a "guru" panel that tells you which swaras drift,
by how much, and when you stray outside the raga.

No build step, no dependencies. Everything is vanilla JS + Web Audio + Canvas.

**Live:** <https://sushi-vig.github.io/swaraswati/> (GitHub Pages, served from `main`; every push updates it within a minute).

## Run it locally

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
  Octaves visible = 6 − 2 × zoom: 0.5× shows five octaves, 1× four, 1.5× three, 2× (the default) your main octave with half
  an octave above and below, 2.5× exactly one. The frame stays centred on Sa..Sa' and only nudges when you sing past its edge.
  Past 2.5× the span halves per step (3× half an octave, 4× an eighth), the view follows the note you sing, and faint guides
  mark ±15¢ (in tune) and ±35¢ (close) around each swara line.
- **Guru report** speaks like a teacher: it knows each raga's vadi, samvadi and pakad, catches swaras that do not belong,
  swaras used against the aroha/avaroha, notes you never visited, and ends with homework built around the pakad.
- **Carnatic talas**: Adi (1 and 2 kalai), Rupaka, Misra and Khanda Chapu, the three Ekas, Jhampa, Ata, Matya, Dhruva and
  Tisra Triputa, plus the remaining talas of the 35-tala scheme, generated from their angas. The strip shows each anga
  (I₄, O, U) and the kriya on every akshara (clap, count, wave). A synthesised mridangam plays the sollukattu: one stroke
  per kriya, or sarva laghu in chatusra or tisra nadai.
- **Varisai drills** in Carnatic mode for any sampurna raga: sarali varisai 1–8, janta varisai 1–4 and the seven alankaras,
  each in its tala (the drill switches the tala for you), at first, second or third speed.
- **Taal library**: 22 Hindustani taals with 44 thekas (variations such as filled, vilambit, drut, dholak-style). Bols inside a matra
  can be subdivided (`- Dhin`, `Dha Ge`, `Tirkit`). Pick the theka under the taal.
- **Laya**: 20 to 400 bpm with the laya name (vilambit, madhya, drut), tap tempo, layakari (ekgun / dugun / chaugun plays
  the theka at 1×, 2× or 4× density inside the same avartan), and a tempo ramp of +N bpm per avartan up to a cap.
- **Tradition switch.** Carnatic mode names the swaras the Carnatic way, sixteen names over twelve pitches, resolved per raga:
  the same pitch reads Ri3 in Nata and Ga2 in Kharaharapriya, Ga1 in Varali and Ri2 in Mohanam. The big display, the trace,
  the drill and the guru report all follow. Sa is shown in kattai (and as a harmonium key) alongside Hz.
- **Raga library**: 77 Hindustani ragas grouped by thaat with vadi, samvadi, pakad and teacher's notes; all 72 melakartas
  generated from the scheme with chakra and notes for the common ones; 78 janya ragas with arohana, avarohana, parent mela,
  vakra and bhashanga remarks and characteristic phrases. The Find box searches both traditions by name, thaat or mela number.
- **Shruti petti** (`P`): a continuous reed drone, Sa · Pa · lower Sa (or Ma, or upper Sa, or Sa alone), with volume, tone and
  fine tune. Runs alongside or instead of the tanpuras.
- **Gamaka-aware scoring** (on by default in Carnatic mode, a checkbox under Mic): an oscillating note, a kampita or
  andolan, is judged by the pitch the swing is anchored on, not frame by frame. The display shows the anchored swara
  with a tilde and the swing's width and rate; the guru reports which swaras carried gamaka and whether the anchor sat
  true; the drill scores the anchor. Plain slides and steady notes are untouched.
- **Mic on speakers**: the browser's echo cancellation is on by default, so the tanpura and drum the page plays are
  subtracted from the microphone (checkbox under Mic; turn off on headphones for the rawest signal). A level meter shows
  what the detector receives against the noise floor it must clear, and frames that coincide with a drum stroke are drawn
  but never start a note or get scored.
- **Fine-tune Sa** in cents; the tanpura, shruti petti and tabla follow.
- **Two tanpuras** (A and B), each with a voice (female, male, male an octave below), first-string choice (Pa, Ma, Ni,
  komal Ni, Dha, Ga or none), volume, pluck speed, jawari, fine tune and pan. Run both panned apart for a fuller drone.
- **Swarmandal** tuned to the raga's swaras over one to three octaves. Strum with the button or `S`; auto-strum on the sam
  every 1, 2, 4 or 8 avartans while the tabla runs.
- **Presets**: save the whole setup (Sa, raga, tuning, taal, theka, laya, tanpuras, swarmandal, drill) under a name,
  load it back, export all presets as a JSON file and import them on another device.
- **Recording** (`R`): records the tanpura, tabla and swarmandal mix plus your voice from the mic into a WebM/Opus file
  (M4A on Safari) with playback and download. Takes live in memory until downloaded.
- **Save the guru report** as a text file to send to your teacher.
- **Recorded tabla**: 26 real stroke recordings (CC0, from the Sonic Pi sample set, originally Freesound user mmiron)
  in `samples/tabla/`, pitch-shifted as one drum to your Sa, with round-robin takes and short takes for fast bols.
  Switch to the synthesised drum under Tabla → Sound. Provenance and licences are in `samples/LICENSES.md`.
- **Recorded tanpura**: the voices "Recorded strings" and "Recorded, octave below" play CC0 single-string recordings
  (Freesound user luckylittleraven's C# pack, Sa at C#3) from `samples/tanpura/`. The app measures each file's pitch,
  normalises its level and shifts the nearest string to each note,
  so Sa, Pa, Dha and the kharaj need little shifting and any other first string is bent from the nearest one.

## Architecture

| File | Role |
| --- | --- |
| `js/pitch-worklet.js` | AudioWorklet that only captures audio and ships 1024-sample chunks. No DSP on the audio thread, so playback never glitches. |
| `js/pitch-worker.js` | Web Worker running the McLeod Pitch Method (NSDF) with an adaptive noise-floor gate. Window 2048, hop 1024, m(τ) via cumulative sums, no per-frame allocation. |
| `js/pitch.js` | Glue: worklet → worker (direct MessageChannel, with main-thread fallback) → `onFrame`. |
| `js/music.js` | Swara tables (just intonation and equal temperament), token grammar, nearest-swara lookup. |
| `js/ragas.js`, `js/ragas-hindustani.js`, `js/ragas-carnatic.js` | Raga data: Hindustani list, generated melakartas and janyas. Add your own here. |
| `js/taals.js` | Hindustani thekas; Carnatic talas built from angas with kriya and sollukattu. |
| `js/shruti.js` | Shruti petti: reed drone synthesis. |
| `js/tanpura.js` | 4-string tanpura: synthesised voicings with jawari swell, or recorded strings; pan and fine tune. |
| `js/tanpura-kit.js` | Loads `samples/tanpura/*.wav`, measures each string's pitch, plays the nearest one shifted to the target. |
| `js/swarmandal.js` | Raga-tuned swarmandal strum. |
| `js/tabla.js` | Theka scheduler (layakari, ramp), synthesised tabla fallback and mridangam, matra lookup for timing feedback. |
| `js/samples.js` | Sampled tabla kit: loads `samples/tabla/*.flac`, maps bols to takes, pitch-shifts to Sa. |
| `js/gamaka.js` | Oscillation detector: finds a kampita/andolan and the pitch it is anchored on. |
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

- Dhatu varisai and the remaining sarali variants; recorded mridangam strokes if a CC0 set turns up.
- Lehra (a looping melody over the theka for taal practice).
- Replay a recording with its pitch trace.
- Per-raga pakad / chalan drills and meend detection.

#!/usr/bin/env python3
"""Read a Swaraswati diagnostic capture (swaraswati-diag-*.wav) and report what went wrong.

The file has three 16 kHz channels: 0 = mic (after the 55 Hz high-pass), 1 = the app's own output (the canceller's
reference), 2 = cleaned (what the detector received). A 'swdg' RIFF chunk holds JSON with every detector frame and
its fate (clear / masked / held / silent), the canceller's figures, the drum strokes, the device and the settings.

Usage: python3 tools/diag-report.py path/to/swaraswati-diag-YYYYMMDD-HHMM.wav
"""
import json, struct, sys, math

def read(path):
    data = open(path, 'rb').read()
    assert data[:4] == b'RIFF' and data[8:12] == b'WAVE', 'not a WAV'
    o, fmt, pcm, meta = 12, None, None, None
    while o + 8 <= len(data):
        cid, n = data[o:o + 4], struct.unpack('<I', data[o + 4:o + 8])[0]
        body = data[o + 8:o + 8 + n]
        if cid == b'fmt ': fmt = struct.unpack('<HHIIHH', body[:16])
        elif cid == b'data': pcm = body
        elif cid == b'swdg': meta = json.loads(body.decode('utf-8'))
        o += 8 + n + (n & 1)
    nch, rate = fmt[1], fmt[2]
    n = len(pcm) // 2 // nch
    samples = struct.unpack('<%dh' % (n * nch), pcm[:n * nch * 2])
    chans = [[samples[i * nch + c] / 32768 for i in range(n)] for c in range(nch)]
    return chans, rate, meta

def db(x): return 20 * math.log10(max(x, 1e-9))
def rms(xs): return math.sqrt(sum(x * x for x in xs) / max(1, len(xs)))

def main(path):
    chans, rate, meta = read(path)
    mic, ref, clean = chans
    print(f"{path}\n  {len(mic) / rate:.1f} s at {rate} Hz · recorded {meta.get('began')}")
    print(f"  mic: {meta['mic'].get('label') or '(unknown)'} · test tone: {meta['mic'].get('testTone')}")
    c = meta.get('context', {}); s = meta.get('settings', {})
    print(f"  context: {c.get('sampleRate')} Hz, output latency {c.get('outputLatency')} s, reference delay {c.get('refDelay')} s")
    print(f"  settings: canceller {'on' if s.get('aec') else 'OFF'}, browser canceller {'ON' if s.get('echoCancel') else 'off'}, sensitivity {s.get('sensitivity')}, "
          f"tabla {'running' if s.get('tablaRunning') else 'off'} vol {s.get('tablaVol')}, tanpuras {[t['running'] for t in s.get('tanpuras', [])]}, shruti {s.get('shruti')}")
    print(f"  overall levels: mic {db(rms(mic)):.0f} dBFS · app output {db(rms(ref)):.0f} dBFS · cleaned {db(rms(clean)):.0f} dBFS")
    # what the mic heard vs what the detector got, in 0.5 s blocks
    blk = rate // 2
    rows = []
    for i in range(0, len(mic) - blk, blk):
        rows.append((i / rate, db(rms(mic[i:i + blk])), db(rms(ref[i:i + blk])), db(rms(clean[i:i + blk]))))
    removed = [m - cl for _, m, r, cl in rows if r > -50]
    if removed: print(f"  bleed removed while the app played: median {sorted(removed)[len(removed) // 2]:.1f} dB, best {max(removed):.1f} dB")
    frames = meta.get('frames', [])
    if frames:
        fates = {}
        for f in frames: fates[f[5]] = fates.get(f[5], 0) + 1
        n = len(frames)
        print("  detector frames: " + ', '.join(f"{k} {v} ({100 * v / n:.0f}%)" for k, v in sorted(fates.items(), key=lambda kv: -kv[1])))
        # why silent? rms below gate, or clarity too low
        sil = [f for f in frames if f[5] == 'silent']
        if sil:
            gated = sum(1 for f in sil if f[3] < max(0.0025, f[4] * 1.8))
            print(f"  of the silent frames, {gated} were below the loudness gate (level under floor x 1.8), {len(sil) - gated} were loud enough but not clear (two sounds at once)")
        # voice loss around strokes
        strokes = meta.get('strokes', [])
        if strokes:
            lost = kept = 0
            for st in strokes:
                after = [f for f in frames if 0 <= f[0] - st['t'] < st['ring'] + 0.05]
                before = [f for f in frames if -0.3 <= f[0] - st['t'] < -0.02]
                if before and all(f[5] == 'clear' for f in before[-3:]):
                    if any(f[5] != 'clear' for f in after): lost += 1
                    else: kept += 1
            print(f"  strokes: {len(strokes)}; when the voice was clear just before a stroke it stayed clear through {kept} strokes and was lost (masked/held/silent) in {lost}")
        floor = sorted(f[4] for f in frames)[len(frames) // 2]
        level = sorted(f[3] for f in frames if f[5] == 'clear')
        print(f"  median noise floor the gate uses: {db(floor):.0f} dBFS (gate to start a note: {db(floor * 1.8):.0f} dBFS); median level of clear frames: {db(level[len(level) // 2]) if level else float('nan'):.0f} dBFS")
    stats = meta.get('stats', [])
    if stats:
        erle = sorted(x[1] for x in stats)
        print(f"  canceller figure (bleed removed): median {erle[len(erle) // 2]:.0f} dB, max {erle[-1]:.0f} dB")
    print("\n  Reading: if the mic level with the app playing is within ~10 dB of the app's output, the instruments are as loud as the voice at")
    print("  the mic. If most silent frames are 'below the gate', the voice is quieter than the residual drone. If strokes lose the voice but")
    print("  the figure is high, the problem is the detector, not the canceller.")

if __name__ == '__main__':
    if len(sys.argv) < 2: print(__doc__); sys.exit(1)
    main(sys.argv[1])

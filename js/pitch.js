// Glue between the AudioContext (worklet capture) and the analysis worker.
export class PitchTracker {
  constructor(ctx) {
    this.ctx = ctx;
    this.onFrame = null;
    this.node = null;
    this.worker = null;
    this.input = null;
    this.ready = false;
  }

  async init() {
    if (this.ready) return;
    await this.ctx.audioWorklet.addModule(new URL('./pitch-worklet.js', import.meta.url));
    this.worker = new Worker(new URL('./pitch-worker.js', import.meta.url));
    const ch = new MessageChannel();
    // The worklet decimates to ~16 kHz (by an integer factor) before analysis; tell the worker that rate.
    const D = Math.max(1, Math.round(this.ctx.sampleRate / 16000));
    this.rate = this.ctx.sampleRate / D;
    this.worker.postMessage({ type: 'init', sampleRate: this.rate, window: 1024, hop: 512, port: ch.port1 }, [ch.port1]);
    // Input 0: the mic (or a test tone). Input 1: the app's own output, the reference the canceller subtracts.
    this.node = new AudioWorkletNode(this.ctx, 'capture-processor', { numberOfInputs: 2, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    // Preferred path: worklet -> worker directly. Fallback: worklet -> main -> worker.
    this.node.port.postMessage({ port: ch.port2 }, [ch.port2]);
    this.onStats = null; this.stats = null;
    this.node.port.onmessage = (e) => {
      const d = e.data; if (!d) return;
      if (d.type === 'samples') this.worker.postMessage(d, [d.samples.buffer]);
      else if (d.type === 'aec') { this.stats = d; if (this.onStats) this.onStats(d); }
      else if (d.type === 'diag') { if (this.onDiag) this.onDiag(d); }
    };
    this.worker.onmessage = (e) => { if (this.onFrame) this.onFrame(e.data); };
    // Keep the node alive in the graph without producing sound.
    this.sink = this.ctx.createGain(); this.sink.gain.value = 0;
    this.node.connect(this.sink).connect(this.ctx.destination);
    this.hp = this.ctx.createBiquadFilter(); this.hp.type = 'highpass'; this.hp.frequency.value = 55;
    this.hp.connect(this.node);
    this.ready = true;
  }

  // Route any AudioNode (mic source or a test tone) into the analyser.
  setInput(node) {
    if (this.input) { try { this.input.disconnect(this.hp); } catch (_) { /* already disconnected */ } }
    this.input = node;
    if (node) node.connect(this.hp);
    this.worker.postMessage({ type: 'reset' });
  }

  // The app's output, so the canceller can subtract what the speakers play from the mic.
  setReference(node) {
    if (!this.refDelay) { this.refDelay = this.ctx.createDelay(1); this.refDelay.delayTime.value = 0; this.refDelaySec = 0; this.refDelay.connect(this.node, 0, 1); }
    if (this.reference) { try { this.reference.disconnect(this.refDelay); } catch (_) { /* not connected */ } }
    this.reference = node; if (node) node.connect(this.refDelay);
  }
  // Shift the reference later by `sec` (output latency over Bluetooth, say) so the echo falls inside the filter's reach.
  setReferenceDelay(sec) {
    const v = Math.min(0.9, Math.max(0, sec || 0));
    if (!this.refDelay || Math.abs(v - this.refDelaySec) < 0.005) return;
    this.refDelaySec = v; this.refDelay.delayTime.setTargetAtTime(v, this.ctx.currentTime, 0.05); this.resetAec();
  }
  setAec(on) { this.node.port.postMessage({ aec: !!on }); }
  tuneAec(opts) { this.node.port.postMessage(opts); }
  resetAec() { this.node.port.postMessage({ reset: true }); }
  // Stream the decimated mic, reference and cleaned signal (512-sample chunks) to onDiag.
  setDiag(on) { this.node.port.postMessage({ diag: !!on }); }

  // sensitivity 0..1 -> absolute RMS gate (higher sensitivity = lower gate).
  setSensitivity(s) {
    const absRms = 0.0025 * Math.pow(12, 1 - s); // 0.03 .. 0.0025
    this.worker.postMessage({ type: 'params', params: { absRms } });
  }
}

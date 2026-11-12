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
    this.worker.postMessage({ type: 'init', sampleRate: this.ctx.sampleRate, port: ch.port1 }, [ch.port1]);
    this.node = new AudioWorkletNode(this.ctx, 'capture-processor', { numberOfInputs: 1, numberOfOutputs: 1, channelCount: 1, channelCountMode: 'explicit' });
    // Preferred path: worklet -> worker directly. Fallback: worklet -> main -> worker.
    this.node.port.postMessage({ port: ch.port2 }, [ch.port2]);
    this.node.port.onmessage = (e) => { if (e.data && e.data.type === 'samples') this.worker.postMessage(e.data, [e.data.samples.buffer]); };
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

  // sensitivity 0..1 -> absolute RMS gate (higher sensitivity = lower gate).
  setSensitivity(s) {
    const absRms = 0.0025 * Math.pow(12, 1 - s); // 0.03 .. 0.0025
    this.worker.postMessage({ type: 'params', params: { absRms } });
  }
}

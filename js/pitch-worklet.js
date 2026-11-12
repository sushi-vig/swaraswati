// AudioWorklet: only captures audio and ships 1024-sample chunks to the analysis worker.
// All DSP happens off the audio thread so tabla/tanpura playback never glitches.
class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.size = 1024;
    this.chunk = new Float32Array(this.size);
    this.idx = 0;
    this.workerPort = null;
    this.port.onmessage = (e) => { if (e.data && e.data.port) this.workerPort = e.data.port; };
  }
  process(inputs) {
    const input = inputs[0];
    if (!input || !input[0]) return true;
    const ch = input[0];
    let i = 0;
    while (i < ch.length) {
      const n = Math.min(ch.length - i, this.size - this.idx);
      this.chunk.set(ch.subarray(i, i + n), this.idx);
      this.idx += n; i += n;
      if (this.idx === this.size) {
        const msg = { type: 'samples', samples: this.chunk, endTime: currentTime + i / sampleRate };
        (this.workerPort || this.port).postMessage(msg, [this.chunk.buffer]);
        this.chunk = new Float32Array(this.size);
        this.idx = 0;
      }
    }
    return true;
  }
}
registerProcessor('capture-processor', CaptureProcessor);

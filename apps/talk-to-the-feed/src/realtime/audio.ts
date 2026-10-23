import { downsample, floatToPcm16, OUTPUT_RATE } from "@/lib/pcm";

export class PcmPlayer {
  private ctx: AudioContext | null = null;
  private next = 0;
  private sources: AudioBufferSourceNode[] = [];

  private context(): AudioContext {
    if (!this.ctx) this.ctx = new AudioContext();
    return this.ctx;
  }

  async resume(): Promise<void> {
    const ctx = this.context();
    if (ctx.state !== "running") await ctx.resume();
  }

  enqueue(pcm: Int16Array): void {
    if (!pcm.length) return;
    const ctx = this.context();
    const buffer = ctx.createBuffer(1, pcm.length, OUTPUT_RATE);
    const channel = buffer.getChannelData(0);
    for (let index = 0; index < pcm.length; index += 1) channel[index] = pcm[index] / 32768;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    const start = Math.max(ctx.currentTime + 0.03, this.next);
    source.start(start);
    this.next = start + buffer.duration;
    this.sources.push(source);
    source.onended = () => {
      this.sources = this.sources.filter((item) => item !== source);
    };
  }

  stop(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // The buffer may already have ended.
      }
    }
    this.sources = [];
    this.next = 0;
  }
}

export class MicCapture {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private release = () => {};

  constructor(private readonly onPcm: (pcm: Int16Array) => void) {}

  async start(): Promise<void> {
    if (this.ctx) return;
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true },
      video: false,
    });
    const ctx = new AudioContext();
    this.ctx = ctx;
    const source = ctx.createMediaStreamSource(this.stream);
    const rate = ctx.sampleRate;
    const emit = (input: Float32Array) => {
      this.onPcm(floatToPcm16(downsample(input, rate, OUTPUT_RATE)));
    };
    try {
      await ctx.audioWorklet.addModule(new URL("../pcm-worklet.js", import.meta.url));
      const node = new AudioWorkletNode(ctx, "pcm-processor");
      const pending: number[] = [];
      node.port.onmessage = (event: MessageEvent<Float32Array>) => {
        pending.push(...event.data);
        const frame = Math.max(1, Math.floor(rate * 0.1));
        if (pending.length < frame) return;
        emit(new Float32Array(pending.splice(0, frame)));
      };
      source.connect(node);
      this.release = () => node.disconnect();
    } catch {
      const processor = ctx.createScriptProcessor(4096, 1, 1);
      const gain = ctx.createGain();
      gain.gain.value = 0;
      processor.onaudioprocess = (event) => {
        emit(new Float32Array(event.inputBuffer.getChannelData(0)));
      };
      source.connect(processor);
      processor.connect(gain);
      gain.connect(ctx.destination);
      this.release = () => {
        processor.disconnect();
        gain.disconnect();
      };
    }
  }

  async resume(): Promise<void> {
    if (this.ctx && this.ctx.state !== "running") await this.ctx.resume();
  }

  async stop(): Promise<void> {
    this.release();
    this.stream?.getTracks().forEach((track) => track.stop());
    await this.ctx?.close();
    this.ctx = null;
    this.stream = null;
  }
}

import type { NoteOutput } from "./output";
import { audioClock } from "./output";
import { loadPianoSamples, nearestSample } from "./sampleLoader";
interface SampleVoice {
  note: number;
  source: AudioBufferSourceNode;
  gain: GainNode;
  releasing: boolean;
}
export class PianoSampler implements NoteOutput {
  private context?: AudioContext;
  private master?: GainNode;
  private samples?: Map<number, AudioBuffer>;
  private loading?: Promise<void>;
  private voices = new Set<SampleVoice>();
  private volume = 0.6;
  async ready() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -16;
      compressor.ratio.value = 4;
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
    }
    await this.context.resume();
    if (!this.samples) {
      if (!this.loading)
        this.loading = loadPianoSamples(this.context)
          .then((samples) => {
            this.samples = samples;
          })
          .catch((error) => {
            this.loading = undefined;
            throw error;
          });
      await this.loading;
    }
  }
  noteOn(note: number, velocity: number, atTime: number) {
    if (!this.context || !this.samples || !this.master) return;
    const context = this.context,
      root = nearestSample(note, [...this.samples.keys()]);
    const source = context.createBufferSource(),
      gain = context.createGain();
    source.buffer = this.samples.get(root)!;
    source.playbackRate.value = 2 ** ((note - root) / 12);
    const start = context.currentTime + Math.max(0, atTime - audioClock());
    const level = 0.32 * (Math.max(1, Math.min(127, velocity)) / 127) ** 1.5;
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(level, start + 0.006);
    gain.gain.setTargetAtTime(level * 0.7, start + 0.05, 0.9);
    source.connect(gain);
    gain.connect(this.master);
    const voice = { note, source, gain, releasing: false };
    this.voices.add(voice);
    source.onended = () => {
      this.voices.delete(voice);
      source.disconnect();
      gain.disconnect();
    };
    source.start(start);
  }
  private release(voice: SampleVoice, time: number, fast = false) {
    if (!this.context) return;
    voice.releasing = true;
    const at = Math.max(this.context.currentTime, time);
    voice.gain.gain.cancelAndHoldAtTime(at);
    voice.gain.gain.setTargetAtTime(0, at, fast ? 0.012 : 0.16);
    try {
      voice.source.stop(at + (fast ? 0.08 : 0.9));
    } catch {
      /* Voice already ended. */
    }
  }
  noteOff(note: number, atTime: number) {
    if (!this.context) return;
    const time = this.context.currentTime + Math.max(0, atTime - audioClock());
    const voice = [...this.voices].find((v) => v.note === note && !v.releasing);
    if (voice) this.release(voice, time);
  }
  allNotesOff() {
    if (this.context)
      for (const voice of this.voices)
        this.release(voice, this.context.currentTime, true);
  }
  setVolume(value: number) {
    this.volume = value;
    if (this.context && this.master)
      this.master.gain.setTargetAtTime(value, this.context.currentTime, 0.02);
  }
  dispose() {
    this.allNotesOff();
    if (this.context && this.context.state !== "closed")
      void this.context.close().catch(() => {});
    this.context = undefined;
    this.master = undefined;
    this.samples = undefined;
    this.loading = undefined;
    this.voices.clear();
  }
}

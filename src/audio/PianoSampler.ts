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
  private percussionSources = new Set<AudioScheduledSourceNode>();
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
  private keepPercussionSource(source: AudioScheduledSourceNode) {
    this.percussionSources.add(source);
    source.onended = () => {
      this.percussionSources.delete(source);
      source.disconnect();
    };
  }
  percussionOn(note: number, velocity: number, atTime: number) {
    if (!this.context || !this.master) return;
    const context = this.context;
    const start = context.currentTime + Math.max(0, atTime - audioClock());
    const level = Math.max(1, Math.min(127, velocity)) / 127;
    if (note === 36) {
      const source = context.createOscillator();
      const gain = context.createGain();
      source.type = "sine";
      source.frequency.setValueAtTime(135, start);
      source.frequency.exponentialRampToValueAtTime(48, start + 0.16);
      gain.gain.setValueAtTime(Math.max(0.001, level * 0.65), start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.2);
      source.connect(gain);
      gain.connect(this.master);
      this.keepPercussionSource(source);
      source.start(start);
      source.stop(start + 0.21);
      return;
    }
    if (note === 76 || note === 77) {
      const source = context.createOscillator();
      const gain = context.createGain();
      source.type = "triangle";
      source.frequency.value = note === 76 ? 1760 : 1260;
      gain.gain.setValueAtTime(Math.max(0.001, level * 0.26), start);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.045);
      source.connect(gain);
      gain.connect(this.master);
      this.keepPercussionSource(source);
      source.start(start);
      source.stop(start + 0.05);
      return;
    }
    const duration = note === 38 ? 0.17 : 0.055;
    const buffer = context.createBuffer(
      1,
      Math.ceil(context.sampleRate * duration),
      context.sampleRate,
    );
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = context.createBufferSource();
    const filter = context.createBiquadFilter();
    const gain = context.createGain();
    source.buffer = buffer;
    filter.type = note === 38 ? "bandpass" : "highpass";
    filter.frequency.value = note === 38 ? 1800 : 6500;
    filter.Q.value = note === 38 ? 0.7 : 1.1;
    gain.gain.setValueAtTime(
      Math.max(0.001, level * (note === 38 ? 0.38 : 0.2)),
      start,
    );
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    this.keepPercussionSource(source);
    source.start(start);
    source.stop(start + duration);
  }
  percussionOff() {
    // Synthesized drum voices are short one-shots and stop themselves.
  }
  allNotesOff() {
    if (this.context)
      for (const voice of this.voices)
        this.release(voice, this.context.currentTime, true);
    for (const source of this.percussionSources) {
      try {
        source.stop();
      } catch {
        /* Source already stopped. */
      }
    }
    this.percussionSources.clear();
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
    this.percussionSources.clear();
  }
}

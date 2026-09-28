import type { NoteOutput } from "./output";
import { audioClock } from "./output";

export class PercussionSynth implements NoteOutput {
  private context?: AudioContext;
  private master?: GainNode;
  private sources = new Set<AudioScheduledSourceNode>();
  private volume = 0.6;

  async ready() {
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = this.volume;
      const compressor = this.context.createDynamicsCompressor();
      compressor.threshold.value = -14;
      compressor.ratio.value = 5;
      this.master.connect(compressor);
      compressor.connect(this.context.destination);
    }
    await this.context.resume();
  }

  noteOn() {
    // Melodic notes are intentionally never routed to the percussion synth.
  }

  noteOff() {
    // Percussion voices are short one-shots.
  }

  private keep(source: AudioScheduledSourceNode) {
    this.sources.add(source);
    source.onended = () => {
      this.sources.delete(source);
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
      this.keep(source);
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
      this.keep(source);
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
    for (let index = 0; index < data.length; index++)
      data[index] = Math.random() * 2 - 1;
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
    this.keep(source);
    source.start(start);
    source.stop(start + duration);
  }

  percussionOff() {
    // Percussion voices are short one-shots and stop themselves.
  }

  allNotesOff() {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        /* Source already stopped. */
      }
    }
    this.sources.clear();
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
  }
}

import type { Chord, Pattern } from "../music/types";
import { createPlaybackEvents, type PlaybackSequence } from "./events";
import { audioClock, type NoteOutput } from "./output";
import { PianoSampler } from "./PianoSampler";
export type PlaybackState = "stopped" | "playing" | "paused";
interface Edge {
  beat: number;
  note: number;
  velocity: number;
  on: boolean;
}
export class AudioEngine {
  private timer?: ReturnType<typeof setInterval>;
  private epoch = 0;
  private elapsed = 0;
  private startedAt = 0;
  private state: PlaybackState = "stopped";
  private callback?: (index: number, state: PlaybackState) => void;
  private index = -1;
  private velocity = 85;
  constructor(
    private output: NoteOutput = new PianoSampler(),
    private clock = audioClock,
  ) {}
  async ready() {
    await this.output.ready();
  }
  setOutput(output: NoteOutput) {
    this.stop();
    this.output = output;
  }
  setVolume(value: number) {
    this.output.setVolume(value);
  }
  setVelocity(value: number) {
    this.velocity = value;
  }
  async previewNote() {
    this.stop();
    await this.playSequence(
      {
        events: [
          {
            note: 60,
            startBeat: 0,
            durationBeat: 1,
            velocity: this.velocity,
            chordIndex: 0,
          },
        ],
        durationBeats: 1,
        beatsPerChord: 1,
        chordCount: 1,
        markers: [],
      },
      90,
      false,
      () => {},
    );
  }
  async preview(chord: Chord, pattern: Pattern = "block") {
    this.stop();
    await this.play([chord], 90, 2, pattern, false, () => {});
  }
  async previewRoute(
    chords: Chord[],
    pattern: Pattern = "block",
    bpm = 90,
    beats = 4,
  ) {
    this.stop();
    await this.play(chords, bpm, beats, pattern, false, () => {});
  }
  async play(
    chords: Chord[],
    bpm: number,
    beats: number,
    pattern: Pattern,
    loop: boolean,
    callback: (index: number, state: PlaybackState) => void,
  ) {
    return this.playSequence(
      createPlaybackEvents(chords, { beats, pattern, velocity: this.velocity }),
      bpm,
      loop,
      callback,
    );
  }
  async playSequence(
    sequence: PlaybackSequence,
    bpm: number,
    loop: boolean,
    callback: (index: number, state: PlaybackState) => void,
  ) {
    if (!sequence.chordCount || this.state === "playing") return;
    const token = ++this.epoch;
    await this.ready();
    if (token !== this.epoch) return;
    const secondsPerBeat = 60 / bpm,
      total = sequence.durationBeats * secondsPerBeat;
    const edges: Edge[] = sequence.events
      .flatMap((e) => [
        { beat: e.startBeat, note: e.note, velocity: e.velocity, on: true },
        {
          beat: e.startBeat + e.durationBeat,
          note: e.note,
          velocity: 0,
          on: false,
        },
      ])
      .sort((a, b) => a.beat - b.beat || Number(a.on) - Number(b.on));
    this.callback = callback;
    this.state = "playing";
    this.index = -1;
    this.startedAt = this.clock() - this.elapsed;
    let cycle = Math.floor(this.elapsed / total),
      cursor = 0;
    const position = (this.elapsed % total) / secondsPerBeat;
    while (cursor < edges.length && edges[cursor].beat < position - 0.00001)
      cursor++;
    if (position > 0) {
      for (const e of sequence.events)
        if (e.startBeat < position && e.startBeat + e.durationBeat > position)
          this.output.noteOn(e.note, e.velocity, this.clock());
    }
    let lastTick = this.clock();
    const tick = () => {
      const now = this.clock(),
        elapsed = now - this.startedAt;
      if (!loop && elapsed >= total) {
        this.stop();
        return;
      }
      const actualCycle = Math.floor(elapsed / total),
        beat = (elapsed % total) / secondsPerBeat;
      if (now - lastTick > 0.5) {
        this.output.allNotesOff();
        cycle = actualCycle;
        cursor = 0;
        while (cursor < edges.length && edges[cursor].beat < beat) cursor++;
        for (const e of sequence.events)
          if (e.startBeat < beat && e.startBeat + e.durationBeat > beat)
            this.output.noteOn(e.note, e.velocity, now);
      }
      lastTick = now;
      const index = Math.min(
        sequence.chordCount - 1,
        Math.floor(beat / sequence.beatsPerChord),
      );
      if (index !== this.index) {
        this.index = index;
        callback(index, "playing");
      }
      const horizon = elapsed + 0.08;
      while (true) {
        if (cursor >= edges.length) {
          if (!loop) break;
          cycle++;
          cursor = 0;
        }
        const edge = edges[cursor],
          absoluteBeat = cycle * sequence.durationBeats + edge.beat;
        if (absoluteBeat * secondsPerBeat > horizon) break;
        const time = Math.max(
          now,
          this.startedAt + absoluteBeat * secondsPerBeat,
        );
        if (edge.on) this.output.noteOn(edge.note, edge.velocity, time);
        else this.output.noteOff(edge.note, time);
        cursor++;
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }
  pause() {
    if (this.state !== "playing") return;
    this.epoch++;
    this.elapsed = this.clock() - this.startedAt;
    this.state = "paused";
    clearInterval(this.timer);
    this.output.allNotesOff();
    this.callback?.(this.index, "paused");
  }
  stop() {
    this.epoch++;
    clearInterval(this.timer);
    this.timer = undefined;
    this.output.allNotesOff();
    this.elapsed = 0;
    this.index = -1;
    this.state = "stopped";
    this.callback?.(-1, "stopped");
  }
  dispose() {
    this.stop();
    this.output.dispose();
  }
}

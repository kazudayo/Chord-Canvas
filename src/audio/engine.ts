import type { Chord, Pattern } from "../music/types";
import {
  createPlaybackEvents,
  type NoteEvent,
  type PlaybackSequence,
} from "./events";
import { audioClock, type NoteOutput } from "./output";
import { PianoSampler } from "./PianoSampler";
export type PlaybackState = "stopped" | "playing" | "paused";
interface Edge {
  beat: number;
  note: number;
  velocity: number;
  on: boolean;
  track?: NoteEvent["track"];
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
  private percussionOutput?: NoteOutput;
  constructor(
    private output: NoteOutput = new PianoSampler(),
    private clock = audioClock,
  ) {}
  async ready(includePercussion = false) {
    await Promise.all([
      this.output.ready(),
      includePercussion &&
      this.percussionOutput &&
      this.percussionOutput !== this.output
        ? this.percussionOutput.ready()
        : Promise.resolve(),
    ]);
  }
  setOutput(output: NoteOutput) {
    this.stop();
    this.output = output;
  }
  setPercussionOutput(output: NoteOutput) {
    if (this.percussionOutput === output) return;
    this.percussionOutput?.allNotesOff();
    this.percussionOutput = output;
  }
  setVolume(value: number) {
    this.output.setVolume(value);
    if (this.percussionOutput && this.percussionOutput !== this.output)
      this.percussionOutput.setVolume(value);
  }
  setVelocity(value: number) {
    this.velocity = value;
  }
  async previewNote() {
    this.prepare();
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
        chordStartBeats: [0],
        chordCount: 1,
        markers: [],
      },
      90,
      false,
      () => {},
    );
  }
  async preview(chord: Chord, pattern: Pattern = "block", octave = 0) {
    this.prepare();
    await this.play([chord], 90, 2, pattern, false, () => {}, undefined, [
      octave,
    ]);
  }
  async previewRoute(
    chords: Chord[],
    pattern: Pattern = "block",
    bpm = 90,
    beats = 4,
  ) {
    this.prepare();
    await this.play(chords, bpm, beats, pattern, false, () => {});
  }
  async play(
    chords: Chord[],
    bpm: number,
    beats: number,
    pattern: Pattern,
    loop: boolean,
    callback: (index: number, state: PlaybackState) => void,
    beatDurations?: number[],
    octaveShifts?: number[],
  ) {
    return this.playSequence(
      createPlaybackEvents(chords, {
        beats,
        beatDurations,
        octaveShifts,
        pattern,
        velocity: this.velocity,
      }),
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
    await this.ready(sequence.events.some((event) => event.track === "drum"));
    if (token !== this.epoch) return;
    const secondsPerBeat = 60 / bpm,
      total = sequence.durationBeats * secondsPerBeat;
    const edges: Edge[] = sequence.events
      .flatMap((e) => [
        {
          beat: e.startBeat,
          note: e.note,
          velocity: e.velocity,
          on: true,
          track: e.track,
        },
        {
          beat: e.startBeat + e.durationBeat,
          note: e.note,
          velocity: 0,
          on: false,
          track: e.track,
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
        if (
          e.track !== "drum" &&
          e.startBeat < position &&
          e.startBeat + e.durationBeat > position
        )
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
          if (
            e.track !== "drum" &&
            e.startBeat < beat &&
            e.startBeat + e.durationBeat > beat
          )
            this.output.noteOn(e.note, e.velocity, now);
      }
      lastTick = now;
      let index = sequence.chordCount - 1;
      for (let i = 1; i < sequence.chordStartBeats.length; i++) {
        if (beat < sequence.chordStartBeats[i]) {
          index = i - 1;
          break;
        }
      }
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
        if (edge.track === "drum") {
          if (edge.on)
            (this.percussionOutput ?? this.output).percussionOn?.(
              edge.note,
              edge.velocity,
              time,
            );
          else
            (this.percussionOutput ?? this.output).percussionOff?.(
              edge.note,
              time,
            );
        } else if (edge.on) this.output.noteOn(edge.note, edge.velocity, time);
        else this.output.noteOff(edge.note, time);
        cursor++;
      }
    };
    tick();
    this.timer = setInterval(tick, 25);
  }
  prepare() {
    if (this.state !== "stopped" || this.timer !== undefined) {
      this.stop();
      return;
    }
    // Cancel a pending async start without sending MIDI panic messages.
    // Some external instruments process a just-sent CC120/123 after the first
    // Note On and cut the opening chord short.
    this.epoch++;
    this.elapsed = 0;
    this.index = -1;
  }
  pause() {
    if (this.state !== "playing") return;
    this.epoch++;
    this.elapsed = this.clock() - this.startedAt;
    this.state = "paused";
    clearInterval(this.timer);
    this.allNotesOff();
    this.callback?.(this.index, "paused");
  }
  stop() {
    this.epoch++;
    clearInterval(this.timer);
    this.timer = undefined;
    this.allNotesOff();
    this.elapsed = 0;
    this.index = -1;
    this.state = "stopped";
    this.callback?.(-1, "stopped");
  }
  dispose() {
    this.stop();
    this.output.dispose();
    if (this.percussionOutput && this.percussionOutput !== this.output)
      this.percussionOutput.dispose();
  }
  private allNotesOff() {
    this.output.allNotesOff();
    if (this.percussionOutput && this.percussionOutput !== this.output)
      this.percussionOutput.allNotesOff();
  }
}

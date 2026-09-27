import type { Chord, Pattern, Section } from "../music/types";
import { voicing } from "../music/voiceLeading";
export interface NoteEvent {
  note: number;
  startBeat: number;
  durationBeat: number;
  velocity: number;
  chordIndex: number;
}
export interface PlaybackSequence {
  events: NoteEvent[];
  durationBeats: number;
  beatsPerChord: number;
  chordCount: number;
  markers: { name: string; beat: number }[];
}
export interface PlaybackOptions {
  beats: number;
  pattern: Pattern;
  velocity?: number;
}
export function playbackVoicing(chord: Chord, previous?: number[]): number[] {
  const base = voicing(chord).map((n) => n + 12);
  if (!previous) return base;
  const options = [-12, 0, 12]
    .map((shift) => base.map((n) => n + shift))
    .filter((notes) => notes[0] >= 48 && notes.at(-1)! <= 96);
  const motion = (notes: number[]) =>
    notes.reduce(
      (sum, n, i) =>
        sum + Math.abs(n - previous[Math.min(i, previous.length - 1)]),
      0,
    ) + Math.abs(notes[0] - previous[0]);
  return options.sort((a, b) => motion(a) - motion(b))[0] ?? base;
}
export function createPlaybackEvents(
  chords: Chord[],
  options: PlaybackOptions,
): PlaybackSequence {
  const beats = Math.max(0.25, options.beats),
    velocity = Math.max(1, Math.min(127, Math.round(options.velocity ?? 85)));
  const events: NoteEvent[] = [];
  let previous: number[] | undefined;
  chords.forEach((chord, chordIndex) => {
    const notes = playbackVoicing(chord, previous);
    previous = notes;
    const start = chordIndex * beats;
    notes.forEach((note, i) => {
      const offset =
        options.pattern === "arpeggio" ? (i * beats) / notes.length : 0;
      events.push({
        note,
        startBeat: start + offset,
        durationBeat: beats - offset,
        velocity,
        chordIndex,
      });
    });
    events.push({
      note: notes[0] - 12,
      startBeat: start,
      durationBeat: beats,
      velocity: Math.max(1, Math.round(velocity * 0.78)),
      chordIndex,
    });
  });
  return {
    events,
    durationBeats: chords.length * beats,
    beatsPerChord: beats,
    chordCount: chords.length,
    markers: [],
  };
}
export function createSongPlaybackEvents(
  sections: Section[],
  options: PlaybackOptions,
): PlaybackSequence {
  const sequence = createPlaybackEvents(
    sections.flatMap((s) => s.chords.map((e) => e.chord)),
    options,
  );
  let beat = 0;
  sequence.markers = sections.map((s) => {
    const marker = { name: s.name, beat };
    beat += s.chords.length * options.beats;
    return marker;
  });
  return sequence;
}

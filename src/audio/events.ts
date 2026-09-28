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
  chordStartBeats: number[];
  chordCount: number;
  markers: { name: string; beat: number }[];
}
export interface PlaybackOptions {
  beats: number;
  beatDurations?: number[];
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
  const chordStartBeats: number[] = [];
  let cursor = 0;
  let previous: number[] | undefined;
  chords.forEach((chord, chordIndex) => {
    const chordBeats = Math.max(
      0.25,
      options.beatDurations?.[chordIndex] ?? beats,
    );
    const notes = playbackVoicing(chord, previous);
    previous = notes;
    const start = cursor;
    chordStartBeats.push(start);
    notes.forEach((note, i) => {
      const offset =
        options.pattern === "arpeggio" ? (i * chordBeats) / notes.length : 0;
      events.push({
        note,
        startBeat: start + offset,
        durationBeat: chordBeats - offset,
        velocity,
        chordIndex,
      });
    });
    events.push({
      note: notes[0] - 12,
      startBeat: start,
      durationBeat: chordBeats,
      velocity: Math.max(1, Math.round(velocity * 0.78)),
      chordIndex,
    });
    cursor += chordBeats;
  });
  return {
    events,
    durationBeats: cursor,
    beatsPerChord: beats,
    chordStartBeats,
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
    {
      ...options,
      beatDurations: sections.flatMap((s) =>
        s.chords.map((e) => e.beats ?? options.beats),
      ),
    },
  );
  let beat = 0;
  sequence.markers = sections.map((s) => {
    const marker = { name: s.name, beat };
    beat += s.chords.reduce(
      (total, chord) => total + (chord.beats ?? options.beats),
      0,
    );
    return marker;
  });
  return sequence;
}

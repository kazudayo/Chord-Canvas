import type { Chord, Pattern, RhythmPattern, Section } from "../music/types";
import { voicing } from "../music/voiceLeading";
export interface NoteEvent {
  note: number;
  startBeat: number;
  durationBeat: number;
  velocity: number;
  chordIndex: number;
  track?: "chord" | "melody" | "drum";
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
  octaveShifts?: number[];
  pattern: Pattern;
  rhythm?: RhythmPattern;
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
    const baseNotes = playbackVoicing(chord, previous);
    previous = baseNotes;
    const requestedOctave = Math.max(
      -3,
      Math.min(3, Math.round(options.octaveShifts?.[chordIndex] ?? 0)),
    );
    let octaveShift = requestedOctave * 12;
    const lowest = baseNotes[0] - 12;
    const highest = baseNotes.at(-1) ?? baseNotes[0];
    while (lowest + octaveShift < 0) octaveShift += 12;
    while (highest + octaveShift > 127) octaveShift -= 12;
    const notes = baseNotes.map((note) => note + octaveShift);
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
        track: "chord",
      });
    });
    events.push({
      note: notes[0] - 12,
      startBeat: start,
      durationBeat: chordBeats,
      velocity: Math.max(1, Math.round(velocity * 0.78)),
      chordIndex,
      track: "chord",
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
      octaveShifts: sections.flatMap((s) => s.chords.map((e) => e.octave ?? 0)),
    },
  );
  let beat = 0;
  let chordOffset = 0;
  sequence.markers = sections.map((s) => {
    const marker = { name: s.name, beat };
    const sectionDuration = s.chords.reduce(
      (total, chord) => total + (chord.beats ?? options.beats),
      0,
    );
    const localStarts: number[] = [];
    let localBeat = 0;
    for (const chord of s.chords) {
      localStarts.push(localBeat);
      localBeat += chord.beats ?? options.beats;
    }
    for (const melody of s.melody ?? []) {
      if (melody.startBeat >= sectionDuration) continue;
      let localChordIndex = Math.max(0, localStarts.length - 1);
      for (let i = 1; i < localStarts.length; i++) {
        if (melody.startBeat < localStarts[i]) {
          localChordIndex = i - 1;
          break;
        }
      }
      sequence.events.push({
        note: melody.note,
        startBeat: beat + melody.startBeat,
        durationBeat: Math.min(
          melody.durationBeats,
          sectionDuration - melody.startBeat,
        ),
        velocity: Math.max(
          1,
          Math.min(127, melody.velocity ?? (options.velocity ?? 85) + 10),
        ),
        chordIndex: chordOffset + localChordIndex,
        track: "melody",
      });
    }
    beat += sectionDuration;
    chordOffset += s.chords.length;
    return marker;
  });
  sequence.events.sort((a, b) => a.startBeat - b.startBeat || a.note - b.note);
  addRhythmEvents(sequence, options.rhythm ?? "off");
  return sequence;
}

export function addRhythmEvents(
  sequence: PlaybackSequence,
  rhythm: RhythmPattern,
): PlaybackSequence {
  if (rhythm === "off" || sequence.durationBeats <= 0) return sequence;
  const chordIndexAt = (beat: number) => {
    let index = Math.max(0, sequence.chordCount - 1);
    for (let i = 1; i < sequence.chordStartBeats.length; i++) {
      if (beat < sequence.chordStartBeats[i]) {
        index = i - 1;
        break;
      }
    }
    return index;
  };
  const hit = (note: number, beat: number, velocity: number) => {
    if (beat >= sequence.durationBeats) return;
    sequence.events.push({
      note,
      startBeat: beat,
      durationBeat: Math.min(0.1, sequence.durationBeats - beat),
      velocity,
      chordIndex: chordIndexAt(beat),
      track: "drum",
    });
  };
  if (rhythm === "metronome") {
    for (let beat = 0; beat < sequence.durationBeats; beat += 1)
      hit(beat % 4 === 0 ? 76 : 77, beat, beat % 4 === 0 ? 108 : 76);
  } else if (rhythm === "twoBeat") {
    for (let beat = 0; beat < sequence.durationBeats; beat += 1)
      hit(beat % 2 === 0 ? 36 : 38, beat, beat % 2 === 0 ? 105 : 92);
  } else if (rhythm === "fourBeat") {
    for (let beat = 0; beat < sequence.durationBeats; beat += 1) {
      hit(42, beat, 64);
      hit(36, beat, beat % 4 === 0 ? 106 : 78);
      if (beat % 4 === 1 || beat % 4 === 3) hit(38, beat, 100);
    }
  } else {
    for (let beat = 0; beat < sequence.durationBeats; beat += 0.5)
      hit(42, beat, Number.isInteger(beat) ? 72 : 55);
    for (let measure = 0; measure < sequence.durationBeats; measure += 4) {
      hit(36, measure, 108);
      hit(38, measure + 1, 101);
      hit(36, measure + 2, 96);
      hit(36, measure + 2.5, 78);
      hit(38, measure + 3, 104);
    }
  }
  sequence.events.sort((a, b) => a.startBeat - b.startBeat || a.note - b.note);
  return sequence;
}

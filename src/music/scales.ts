import type { Chord, Key } from "./types";
import { intervalNote, mod, pitch } from "./notes";

export type ScaleCategory =
  "major" | "minor" | "mode" | "pentatonic" | "blues" | "other";

export interface ScaleDefinition {
  id: string;
  name: string;
  intervals: number[];
  degreeLabels: string[];
  category: ScaleCategory;
}

export interface ScaleTone {
  index: number;
  interval: number;
  degree: string;
  note: string;
  pitchClass: number;
}

export type ScaleDisplayMode = "chord" | "scale" | "chord-scale";
export type ScaleLabelMode = "note" | "degree";
export type ScalePosition =
  "auto" | "0-5" | "3-8" | "5-10" | "7-12" | "10-15" | "all";

export interface ScaleExplorerState {
  root: string;
  scaleId: string;
  display: ScaleDisplayMode;
  label: ScaleLabelMode;
  position: ScalePosition;
}

export const SCALE_DEFINITIONS: ScaleDefinition[] = [
  {
    id: "major",
    name: "Major / Ionian",
    intervals: [0, 2, 4, 5, 7, 9, 11],
    degreeLabels: ["1", "2", "3", "4", "5", "6", "7"],
    category: "major",
  },
  {
    id: "dorian",
    name: "Dorian",
    intervals: [0, 2, 3, 5, 7, 9, 10],
    degreeLabels: ["1", "2", "b3", "4", "5", "6", "b7"],
    category: "mode",
  },
  {
    id: "phrygian",
    name: "Phrygian",
    intervals: [0, 1, 3, 5, 7, 8, 10],
    degreeLabels: ["1", "b2", "b3", "4", "5", "b6", "b7"],
    category: "mode",
  },
  {
    id: "lydian",
    name: "Lydian",
    intervals: [0, 2, 4, 6, 7, 9, 11],
    degreeLabels: ["1", "2", "3", "#4", "5", "6", "7"],
    category: "mode",
  },
  {
    id: "mixolydian",
    name: "Mixolydian",
    intervals: [0, 2, 4, 5, 7, 9, 10],
    degreeLabels: ["1", "2", "3", "4", "5", "6", "b7"],
    category: "mode",
  },
  {
    id: "aeolian",
    name: "Aeolian / Natural Minor",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degreeLabels: ["1", "2", "b3", "4", "5", "b6", "b7"],
    category: "mode",
  },
  {
    id: "locrian",
    name: "Locrian",
    intervals: [0, 1, 3, 5, 6, 8, 10],
    degreeLabels: ["1", "b2", "b3", "4", "b5", "b6", "b7"],
    category: "mode",
  },
  {
    id: "natural-minor",
    name: "Natural Minor",
    intervals: [0, 2, 3, 5, 7, 8, 10],
    degreeLabels: ["1", "2", "b3", "4", "5", "b6", "b7"],
    category: "minor",
  },
  {
    id: "harmonic-minor",
    name: "Harmonic Minor",
    intervals: [0, 2, 3, 5, 7, 8, 11],
    degreeLabels: ["1", "2", "b3", "4", "5", "b6", "7"],
    category: "minor",
  },
  {
    id: "melodic-minor",
    name: "Melodic Minor",
    intervals: [0, 2, 3, 5, 7, 9, 11],
    degreeLabels: ["1", "2", "b3", "4", "5", "6", "7"],
    category: "minor",
  },
  {
    id: "major-pentatonic",
    name: "Major Pentatonic",
    intervals: [0, 2, 4, 7, 9],
    degreeLabels: ["1", "2", "3", "5", "6"],
    category: "pentatonic",
  },
  {
    id: "minor-pentatonic",
    name: "Minor Pentatonic",
    intervals: [0, 3, 5, 7, 10],
    degreeLabels: ["1", "b3", "4", "5", "b7"],
    category: "pentatonic",
  },
  {
    id: "blues",
    name: "Blues Scale",
    intervals: [0, 3, 5, 6, 7, 10],
    degreeLabels: ["1", "b3", "4", "b5", "5", "b7"],
    category: "blues",
  },
];

export const SCALE_ROOTS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
  "C#",
  "Gb",
  "D#",
  "G#",
  "A#",
];

export function getScaleDefinition(id: string): ScaleDefinition {
  return (
    SCALE_DEFINITIONS.find((definition) => definition.id === id) ??
    SCALE_DEFINITIONS[0]
  );
}

function degreeSteps(degree: string): number {
  const number = Number(degree.match(/\d+/)?.[0] ?? 1);
  return mod(number - 1, 7);
}

export function getScaleTones(root: string, scaleId: string): ScaleTone[] {
  const definition = getScaleDefinition(scaleId);
  return definition.intervals.map((interval, index) => {
    const note = intervalNote(
      root,
      interval,
      degreeSteps(definition.degreeLabels[index]),
    );
    return {
      index,
      interval,
      degree: definition.degreeLabels[index],
      note,
      pitchClass: pitch(note),
    };
  });
}

export function scaleIdForKey(key: Key): string {
  return key.mode === "major" ? "major" : "natural-minor";
}

export function scaleStateForKey(key: Key): ScaleExplorerState {
  return {
    root: key.tonic,
    scaleId: scaleIdForKey(key),
    display: "chord-scale",
    label: "note",
    position: "auto",
  };
}

export function scalePreviewNotes(root: string, scaleId: string): number[] {
  const rootMidi = 60 + pitch(root);
  const definition = getScaleDefinition(scaleId);
  return [
    ...definition.intervals.map((interval) => rootMidi + interval),
    rootMidi + 12,
  ];
}

const CHORD_DEGREES: Record<number, string> = {
  0: "Root",
  1: "b2",
  2: "2nd",
  3: "b3",
  4: "3rd",
  5: "4th",
  6: "b5",
  7: "5th",
  8: "#5",
  9: "6th",
  10: "b7",
  11: "7th",
};

export function chordToneDegree(chord: Chord, pitchClass: number) {
  if (!chord.notes.some((note) => pitch(note) === mod(pitchClass))) return null;
  return CHORD_DEGREES[mod(pitchClass - pitch(chord.root))] ?? null;
}

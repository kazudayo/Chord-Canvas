import { chromaticName, mod } from "../music/notes";
import type { ScaleTone } from "../music/scales";
import { STANDARD_TUNING } from "./tuning";
import type {
  GuitarStringNumber,
  GuitarStringPosition,
  GuitarTuning,
} from "./types";

export function midiAt(
  string: GuitarStringNumber,
  fret: number,
  tuning: GuitarTuning = STANDARD_TUNING,
): number {
  return tuning.strings[string] + fret;
}

export function midiNoteName(midi: number, flats = false): string {
  return `${chromaticName(mod(midi), flats)}${Math.floor(midi / 12) - 1}`;
}

export function positionAt(
  string: GuitarStringNumber,
  fret: number | null,
  finger: GuitarStringPosition["finger"] = fret === 0 ? 0 : null,
  tuning: GuitarTuning = STANDARD_TUNING,
): GuitarStringPosition {
  if (fret == null) return { string, fret: null, finger: null };
  const midiNote = midiAt(string, fret, tuning);
  return {
    string,
    fret,
    finger: fret === 0 ? 0 : finger,
    midiNote,
    noteName: midiNoteName(midiNote),
  };
}

export function soundingPositions(positions: GuitarStringPosition[]) {
  return positions
    .filter(
      (position): position is GuitarStringPosition & { fret: number } =>
        position.fret != null,
    )
    .sort((a, b) => (a.midiNote ?? 0) - (b.midiNote ?? 0));
}

export function averageFret(positions: GuitarStringPosition[]): number {
  const fretted = positions.filter(
    (position): position is GuitarStringPosition & { fret: number } =>
      position.fret != null && position.fret > 0,
  );
  return fretted.length
    ? fretted.reduce((sum, position) => sum + position.fret, 0) / fretted.length
    : 0;
}

export function fretSpan(positions: GuitarStringPosition[]): number {
  const frets = positions
    .map((position) => position.fret)
    .filter((fret): fret is number => fret != null && fret > 0);
  return frets.length ? Math.max(...frets) - Math.min(...frets) : 0;
}

export interface ScaleFretPosition {
  string: GuitarStringNumber;
  fret: number;
  midiNote: number;
  pitchClass: number;
  tone: ScaleTone;
}

export function scaleFretboardPositions(
  tones: ScaleTone[],
  startFret = 0,
  endFret = 15,
  tuning: GuitarTuning = STANDARD_TUNING,
): ScaleFretPosition[] {
  const byPitch = new Map(tones.map((tone) => [tone.pitchClass, tone]));
  const positions: ScaleFretPosition[] = [];
  for (const string of [6, 5, 4, 3, 2, 1] as GuitarStringNumber[]) {
    for (let fret = startFret; fret <= endFret; fret++) {
      const midiNote = midiAt(string, fret, tuning);
      const tone = byPitch.get(mod(midiNote));
      if (tone)
        positions.push({
          string,
          fret,
          midiNote,
          pitchClass: tone.pitchClass,
          tone,
        });
    }
  }
  return positions;
}

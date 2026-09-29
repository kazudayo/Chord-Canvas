import { chromaticName, mod } from "../music/notes";
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

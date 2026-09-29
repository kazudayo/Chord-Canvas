import { fretSpan, positionAt } from "./fretboard";
import { GUITAR_STRINGS } from "./tuning";
import type {
  GuitarBarre,
  GuitarFinger,
  GuitarStringNumber,
  GuitarStringPosition,
} from "./types";

export interface FingeringResult {
  positions: GuitarStringPosition[];
  barres: GuitarBarre[];
  valid: boolean;
}

export function assignFingering(
  frets: Record<GuitarStringNumber, number | null>,
): FingeringResult {
  const positions = GUITAR_STRINGS.map((string) =>
    positionAt(string, frets[string]),
  );
  const fretted = positions.filter(
    (position): position is GuitarStringPosition & { fret: number } =>
      position.fret != null && position.fret > 0,
  );
  const barres: GuitarBarre[] = [];
  let nextFinger: GuitarFinger = 1;

  const grouped = new Map<number, GuitarStringPosition[]>();
  for (const position of fretted) {
    const group = grouped.get(position.fret) ?? [];
    group.push(position);
    grouped.set(position.fret, group);
  }

  for (const [fret, group] of [...grouped].sort((a, b) => a[0] - b[0])) {
    if (nextFinger == null || nextFinger > 4) {
      return { positions, barres, valid: false };
    }
    const strings = group.map((position) => position.string);
    const useBarre = group.length >= 2 && fret === Math.min(...grouped.keys());
    if (useBarre) {
      const finger = nextFinger as 1 | 2 | 3 | 4;
      for (const position of group) position.finger = finger;
      barres.push({
        fret,
        fromString: Math.min(...strings) as GuitarStringNumber,
        toString: Math.max(...strings) as GuitarStringNumber,
        finger,
      });
      nextFinger = (nextFinger + 1) as GuitarFinger;
      continue;
    }
    for (const position of group.sort((a, b) => b.string - a.string)) {
      if (nextFinger == null || nextFinger > 4)
        return { positions, barres, valid: false };
      position.finger = nextFinger;
      nextFinger = (nextFinger + 1) as GuitarFinger;
    }
  }

  return { positions, barres, valid: fretSpan(positions) <= 5 };
}

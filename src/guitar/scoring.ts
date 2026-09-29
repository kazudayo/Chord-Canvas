import { averageFret, fretSpan } from "./fretboard";
import type { GuitarVoicing } from "./types";

export function transitionCost(
  previous: GuitarVoicing,
  next: GuitarVoicing,
): number {
  const previousByString = new Map(
    previous.positions.map((position) => [position.string, position]),
  );
  let movement = Math.abs(
    averageFret(previous.positions) - averageFret(next.positions),
  );
  let commonStrings = 0;
  let anchoredFingers = 0;
  for (const position of next.positions) {
    const before = previousByString.get(position.string);
    if (position.fret == null || before?.fret == null) continue;
    commonStrings++;
    movement += Math.abs(position.fret - before.fret) * 0.65;
    if (position.fret === before.fret) anchoredFingers++;
  }
  return (
    movement +
    fretSpan(next.positions) * 0.75 +
    (next.barres?.length ?? 0) * 1.4 -
    commonStrings * 0.4 -
    anchoredFingers * 1.8
  );
}

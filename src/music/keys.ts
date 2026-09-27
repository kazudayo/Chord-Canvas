import { intervalNote } from "./notes";
import type { Key, MinorVariant } from "./types";
export const SCALES = {
  major: [0, 2, 4, 5, 7, 9, 11],
  natural: [0, 2, 3, 5, 7, 8, 10],
  harmonic: [0, 2, 3, 5, 7, 8, 11],
  melodic: [0, 2, 3, 5, 7, 9, 11],
};
export function scale(key: Key, variant: MinorVariant = "natural"): string[] {
  return SCALES[key.mode === "major" ? "major" : variant].map((offset, index) =>
    intervalNote(key.tonic, offset, index),
  );
}
export const keyName = (key: Key) =>
  `${key.tonic} ${key.mode === "major" ? "Major" : "Minor"}`;

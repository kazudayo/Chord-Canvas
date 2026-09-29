import type { GuitarStringNumber, GuitarTuning } from "./types";

export const GUITAR_STRINGS: GuitarStringNumber[] = [6, 5, 4, 3, 2, 1];
export const TAB_STRINGS: GuitarStringNumber[] = [1, 2, 3, 4, 5, 6];

export const STANDARD_TUNING: GuitarTuning = {
  id: "standard",
  name: "Standard · E A D G B e",
  strings: {
    6: 40,
    5: 45,
    4: 50,
    3: 55,
    2: 59,
    1: 64,
  },
};

export const STRING_LABELS: Record<GuitarStringNumber, string> = {
  6: "E",
  5: "A",
  4: "D",
  3: "G",
  2: "B",
  1: "e",
};

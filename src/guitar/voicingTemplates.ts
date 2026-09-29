import type { Quality } from "../music/types";
import { assignFingering } from "./fingering";
import { GUITAR_STRINGS } from "./tuning";
import type {
  GuitarStringNumber,
  GuitarVoicing,
  GuitarVoicingFamily,
} from "./types";

type FretList = [
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
  number | null,
];

export interface CuratedVoicingTemplate {
  root: string;
  quality: Quality;
  bass?: string;
  frets: FretList;
  family: GuitarVoicingFamily;
  description: string;
}

export const CURATED_VOICINGS: CuratedVoicingTemplate[] = [
  {
    root: "C",
    quality: "major",
    frets: [null, 3, 2, 0, 1, 0],
    family: "open",
    description: "開放弦を使うCの基本フォームです",
  },
  {
    root: "C",
    quality: "major",
    bass: "E",
    frets: [0, 3, 2, 0, 1, 0],
    family: "open",
    description: "Eを最低音にしたC/Eフォームです",
  },
  {
    root: "C",
    quality: "maj7",
    frets: [null, 3, 2, 0, 0, 0],
    family: "open",
    description: "開放弦を多く使うCmaj7です",
  },
  {
    root: "A",
    quality: "minor",
    frets: [null, 0, 2, 2, 1, 0],
    family: "open",
    description: "Amの基本オープンフォームです",
  },
  {
    root: "A",
    quality: "m7",
    frets: [null, 0, 2, 0, 1, 0],
    family: "open",
    description: "指の移動が少ないAm7です",
  },
  {
    root: "D",
    quality: "minor",
    frets: [null, null, 0, 2, 3, 1],
    family: "open",
    description: "Dmの基本オープンフォームです",
  },
  {
    root: "D",
    quality: "m7",
    frets: [null, null, 0, 2, 1, 1],
    family: "open",
    description: "1フレットを小さくバレーするDm7です",
  },
  {
    root: "G",
    quality: "major",
    frets: [3, 2, 0, 0, 0, 3],
    family: "open",
    description: "Gの基本オープンフォームです",
  },
  {
    root: "G",
    quality: "7",
    frets: [3, 2, 0, 0, 0, 1],
    family: "open",
    description: "開放弦を使うG7の基本フォームです",
  },
  {
    root: "E",
    quality: "major",
    frets: [0, 2, 2, 1, 0, 0],
    family: "open",
    description: "Eの基本オープンフォームです",
  },
  {
    root: "E",
    quality: "minor",
    frets: [0, 2, 2, 0, 0, 0],
    family: "open",
    description: "Emの基本オープンフォームです",
  },
  {
    root: "E",
    quality: "7",
    frets: [0, 2, 0, 1, 0, 0],
    family: "open",
    description: "E7の基本オープンフォームです",
  },
];

export function fretsToRecord(frets: FretList) {
  return Object.fromEntries(
    GUITAR_STRINGS.map((string, index) => [string, frets[index]]),
  ) as Record<GuitarStringNumber, number | null>;
}

export function templateToVoicing(
  template: CuratedVoicingTemplate,
): GuitarVoicing | null {
  const fingering = assignFingering(fretsToRecord(template.frets));
  if (!fingering.valid) return null;
  const fretted = fingering.positions
    .map((position) => position.fret)
    .filter((fret): fret is number => fret != null && fret > 0);
  const signature = template.frets.map((fret) => fret ?? "x").join("-");
  return {
    id: `curated-${template.root}-${template.quality}-${template.bass ?? "root"}-${signature}`,
    positions: fingering.positions,
    barres: fingering.barres,
    family: template.family,
    difficulty: fingering.barres.length ? "normal" : "easy",
    baseFret: fretted.length ? Math.min(...fretted) : 1,
    rootInBass: template.bass == null || template.bass === template.root,
    description: template.description,
    recommendationReason: template.description,
  };
}

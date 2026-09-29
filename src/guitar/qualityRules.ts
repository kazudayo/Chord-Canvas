import type { Quality } from "../music/types";
import type { GuitarVoicingStyle } from "./types";

interface QualityToneRule {
  required: number[];
  optional: number[];
  jazzRequired?: number[];
  labels?: Partial<Record<number, string>>;
}

export const GUITAR_QUALITY_RULES: Record<Quality, QualityToneRule> = {
  major: { required: [0, 4, 7], optional: [] },
  minor: { required: [0, 3, 7], optional: [] },
  dim: { required: [0, 3, 6], optional: [] },
  aug: { required: [0, 4, 8], optional: [] },
  maj7: {
    required: [0, 4, 7, 11],
    jazzRequired: [4, 11],
    optional: [7],
    labels: { 7: "5th", 0: "Root" },
  },
  "7": {
    required: [0, 4, 7, 10],
    jazzRequired: [4, 10],
    optional: [7],
    labels: { 7: "5th", 0: "Root" },
  },
  m7: {
    required: [0, 3, 7, 10],
    jazzRequired: [3, 10],
    optional: [7],
    labels: { 7: "5th", 0: "Root" },
  },
  m7b5: { required: [0, 3, 6, 10], optional: [] },
  dim7: { required: [0, 3, 6, 9], optional: [] },
  mMaj7: {
    required: [0, 3, 11],
    jazzRequired: [3, 11],
    optional: [7],
    labels: { 7: "5th", 0: "Root" },
  },
  augMaj7: { required: [0, 4, 8, 11], optional: [] },
  sus2: { required: [0, 2, 7], optional: [] },
  sus4: { required: [0, 5, 7], optional: [] },
  add9: { required: [0, 4, 7, 2], optional: [] },
  maj9: {
    required: [0, 4, 11, 2],
    jazzRequired: [4, 11, 2],
    optional: [7],
    labels: { 7: "5th", 0: "Root" },
  },
  m9: {
    required: [0, 3, 10, 2],
    jazzRequired: [3, 10, 2],
    optional: [7],
    labels: { 7: "5th", 0: "Root" },
  },
  "9": {
    required: [0, 4, 10, 2],
    jazzRequired: [4, 10, 2],
    optional: [7],
    labels: { 7: "5th", 0: "Root" },
  },
  "11": {
    required: [0, 4, 10, 5],
    jazzRequired: [4, 10, 5],
    optional: [7, 2],
    labels: { 7: "5th", 2: "9th", 0: "Root" },
  },
  "13": {
    required: [0, 4, 10, 9],
    jazzRequired: [4, 10, 9],
    optional: [7, 2, 5],
    labels: { 7: "5th", 2: "9th", 5: "11th", 0: "Root" },
  },
};

export function requiredIntervals(
  quality: Quality,
  style: GuitarVoicingStyle,
): number[] {
  const rule = GUITAR_QUALITY_RULES[quality];
  return style === "jazz" && rule.jazzRequired
    ? rule.jazzRequired
    : rule.required;
}

import { getScaleDefinition, getScaleTones } from "./scales";
import type { Key, MinorVariant } from "./types";

export const SCALES = {
  major: getScaleDefinition("major").intervals,
  natural: getScaleDefinition("natural-minor").intervals,
  harmonic: getScaleDefinition("harmonic-minor").intervals,
  melodic: getScaleDefinition("melodic-minor").intervals,
};

export function scale(key: Key, variant: MinorVariant = "natural"): string[] {
  const scaleId =
    key.mode === "major"
      ? "major"
      : variant === "harmonic"
        ? "harmonic-minor"
        : variant === "melodic"
          ? "melodic-minor"
          : "natural-minor";
  return getScaleTones(key.tonic, scaleId).map((tone) => tone.note);
}

export const keyName = (key: Key) =>
  `${key.tonic} ${key.mode === "major" ? "Major" : "Minor"}`;

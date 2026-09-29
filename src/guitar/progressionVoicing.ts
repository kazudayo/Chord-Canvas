import type { ChordEntry } from "../music/types";
import { transitionCost } from "./scoring";
import type { GuitarGenerationOptions, GuitarVoicing } from "./types";
import {
  generateGuitarVoicings,
  voicingMatchesChord,
} from "./voicingGenerator";

export function defaultVoicing(
  entry: ChordEntry,
  options: GuitarGenerationOptions,
): GuitarVoicing | undefined {
  if (voicingMatchesChord(entry.chord, entry.guitarVoicing))
    return entry.guitarVoicing;
  return generateGuitarVoicings(entry.chord, options)[0];
}

export function optimizeProgressionVoicings(
  entries: ChordEntry[],
  options: GuitarGenerationOptions,
): GuitarVoicing[] {
  const layers = entries.map((entry) =>
    generateGuitarVoicings(entry.chord, { ...options, limit: 7 }),
  );
  if (layers.some((layer) => !layer.length)) return [];

  const costs: number[][] = layers.map((layer) => layer.map(() => Infinity));
  const paths: number[][] = layers.map((layer) => layer.map(() => -1));
  costs[0] = layers[0].map((voicing) =>
    voicing.difficulty === "advanced" ? 4 : 0,
  );

  for (let layer = 1; layer < layers.length; layer++) {
    for (let next = 0; next < layers[layer].length; next++) {
      for (let previous = 0; previous < layers[layer - 1].length; previous++) {
        const cost =
          costs[layer - 1][previous] +
          transitionCost(layers[layer - 1][previous], layers[layer][next]);
        if (cost < costs[layer][next]) {
          costs[layer][next] = cost;
          paths[layer][next] = previous;
        }
      }
    }
  }

  let cursor = costs.at(-1)!.indexOf(Math.min(...costs.at(-1)!));
  const result = Array<GuitarVoicing>(layers.length);
  for (let layer = layers.length - 1; layer >= 0; layer--) {
    result[layer] = layers[layer][cursor];
    cursor = paths[layer][cursor];
  }
  return result.map((voicing, index) => ({
    ...voicing,
    recommendationReason:
      index === 0
        ? voicing.recommendationReason
        : `前のコードから手の移動が少ない${voicing.family}フォームです`,
  }));
}

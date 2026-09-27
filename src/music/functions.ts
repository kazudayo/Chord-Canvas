import type { Chord, HarmonicFunction, Key } from "./types";
import { intervalNote, mod, pitch } from "./notes";
const BORROWED_FUNCTIONS: Record<
  number,
  { primary: HarmonicFunction; possible: HarmonicFunction[]; reason: string }
> = {
  3: {
    primary: "Predominant",
    possible: ["Predominant"],
    reason: "ivはプレドミナントとしてVへ進めるほか、主和音へ穏やかに戻れます。",
  },
  5: {
    primary: "Predominant",
    possible: ["Predominant", "Tonic"],
    reason:
      "♭VIは次の和音を準備したり、主和音の色彩的な代理になったりします。前後の響きで役割が変わります。",
  },
  6: {
    primary: "Predominant",
    possible: ["Predominant", "Dominant"],
    reason:
      "♭VIIはIVへの展開や、主和音へのモーダルな接続に使えます。導音を持つVと同じ強いドミナントとは限りません。",
  },
};
export function withFunction(chord: Chord, key: Key): Chord {
  let result: Chord = {
    ...chord,
    analysisKey: { ...key },
    functionStrength: "normal",
    possibleFunctions: [chord.function],
  };
  if (chord.source === "borrowed") {
    const rule =
      key.mode === "major" ? BORROWED_FUNCTIONS[chord.degreeIndex] : undefined;
    result = {
      ...result,
      sourceMode: key.mode === "major" ? "parallel-minor" : "parallel-major",
      borrowedDegree: chord.degree,
      function: rule?.primary ?? chord.function,
      possibleFunctions: rule?.possible ?? [chord.function],
      functionStrength: chord.degreeIndex === 3 ? "normal" : "contextual",
      contextualReasons: [
        rule?.reason ??
          "同主長調の明るい響きを借りています。前後の進行によって役割が変わります。",
      ],
    };
  } else if (chord.function === "Dominant") {
    const hasLeading = chord.notes.some(
      (n) => mod(pitch(n) - pitch(key.tonic)) === 11,
    );
    const weak =
      key.mode === "minor" &&
      !hasLeading &&
      chord.source !== "secondaryDominant";
    result.functionStrength = weak ? "weak" : "strong";
    result.contextualReasons = [
      weak
        ? "自然短音階の響きです。主音へ半音上行する導音を持たないため、穏やかなドミナントとして働きます。"
        : chord.source === "secondaryDominant"
          ? `${chord.targetRoot}への一時的な導音を含み、目的の和音へ向かいます。`
          : `${intervalNote(key.tonic, 11, 6)}から${key.tonic}への導音解決が、強い引力を作ります。`,
    ];
  }
  return result;
}
export const functionWeight = (c: Chord) =>
  c.functionStrength === "weak"
    ? 0.4
    : c.functionStrength === "contextual"
      ? 0.65
      : c.functionStrength === "strong"
        ? 1.15
        : 1;
export const functionClass = (c: Chord) => c.function.toLowerCase();
export const functionShort = (c: Chord) =>
  (c.function === "Predominant" ? "Subdominant" : c.function) +
  (c.functionStrength === "weak"
    ? " (weak)"
    : c.functionStrength === "strong"
      ? " (strong)"
      : c.functionStrength === "contextual"
        ? " · 文脈依存"
        : "");

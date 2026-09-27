import type {
  Chord,
  ChordSource,
  HarmonicFunction,
  Key,
  MinorVariant,
  Quality,
} from "./types";
import { intervalNote, LETTERS, mod, pitch, spell } from "./notes";
import { scale } from "./keys";
import { withFunction } from "./functions";

export const QUALITIES: Record<
  Quality,
  { intervals: number[]; steps: number[]; suffix: string }
> = {
  major: { intervals: [0, 4, 7], steps: [0, 2, 4], suffix: "" },
  minor: { intervals: [0, 3, 7], steps: [0, 2, 4], suffix: "m" },
  dim: { intervals: [0, 3, 6], steps: [0, 2, 4], suffix: "dim" },
  aug: { intervals: [0, 4, 8], steps: [0, 2, 4], suffix: "aug" },
  maj7: { intervals: [0, 4, 7, 11], steps: [0, 2, 4, 6], suffix: "maj7" },
  "7": { intervals: [0, 4, 7, 10], steps: [0, 2, 4, 6], suffix: "7" },
  m7: { intervals: [0, 3, 7, 10], steps: [0, 2, 4, 6], suffix: "m7" },
  m7b5: { intervals: [0, 3, 6, 10], steps: [0, 2, 4, 6], suffix: "m7♭5" },
  dim7: { intervals: [0, 3, 6, 9], steps: [0, 2, 4, 6], suffix: "dim7" },
  mMaj7: { intervals: [0, 3, 7, 11], steps: [0, 2, 4, 6], suffix: "m(maj7)" },
  augMaj7: {
    intervals: [0, 4, 8, 11],
    steps: [0, 2, 4, 6],
    suffix: "aug(maj7)",
  },
  sus2: { intervals: [0, 2, 7], steps: [0, 1, 4], suffix: "sus2" },
  sus4: { intervals: [0, 5, 7], steps: [0, 3, 4], suffix: "sus4" },
  add9: { intervals: [0, 4, 7, 14], steps: [0, 2, 4, 8], suffix: "add9" },
  maj9: {
    intervals: [0, 4, 7, 11, 14],
    steps: [0, 2, 4, 6, 8],
    suffix: "maj9",
  },
  m9: { intervals: [0, 3, 7, 10, 14], steps: [0, 2, 4, 6, 8], suffix: "m9" },
  "9": { intervals: [0, 4, 7, 10, 14], steps: [0, 2, 4, 6, 8], suffix: "9" },
  "11": {
    intervals: [0, 4, 7, 10, 14, 17],
    steps: [0, 2, 4, 6, 8, 10],
    suffix: "11",
  },
  "13": {
    intervals: [0, 4, 7, 10, 14, 17, 21],
    steps: [0, 2, 4, 6, 8, 10, 12],
    suffix: "13",
  },
};
export function makeChord(
  root: string,
  quality: Quality,
  meta: Partial<Omit<Chord, "root" | "quality" | "notes" | "bassNote">> = {},
): Chord {
  const data = QUALITIES[quality];
  const notes = data.intervals.map((n, i) =>
    intervalNote(root, n, data.steps[i]),
  );
  const inversion = Math.max(
    0,
    Math.min(meta.inversion ?? 0, notes.length - 1),
  );
  return {
    degree: "自由",
    degreeIndex: -1,
    function: "Tonic",
    source: "custom",
    extensions: data.intervals.filter((n) => n >= 10).map(String),
    ...meta,
    root,
    quality,
    notes,
    inversion,
    bassNote: notes[inversion],
  };
}
export function chordName(c: Chord): string {
  return (
    c.root + QUALITIES[c.quality].suffix + (c.inversion ? "/" + c.bassNote : "")
  );
}
export function invert(c: Chord, inversion: number): Chord {
  return makeChord(c.root, c.quality, { ...c, inversion });
}
export function degreeLabel(
  index: number,
  quality: Quality,
  prefix = "",
): string {
  const roman = ["I", "II", "III", "IV", "V", "VI", "VII"][index];
  const lower = QUALITIES[quality].intervals[1] === 3;
  const suffix: Partial<Record<Quality, string>> = {
    dim: "°",
    aug: "+",
    m7: "7",
    maj7: "maj7",
    "7": "7",
    dim7: "°7",
    m7b5: "ø7",
    mMaj7: "(maj7)",
    augMaj7: "+maj7",
  };
  return (
    prefix + (lower ? roman.toLowerCase() : roman) + (suffix[quality] ?? "")
  );
}
export function diatonic(
  key: Key,
  seventh = false,
  variant: MinorVariant = "natural",
): Chord[] {
  const notes = scale(key, variant);
  return notes.map((root, i) => {
    const intervals = Array.from({ length: seventh ? 4 : 3 }, (_, n) =>
      mod(pitch(notes[(i + 2 * n) % 7]) - pitch(root)),
    );
    const quality = (Object.keys(QUALITIES) as Quality[]).find(
      (q) => QUALITIES[q].intervals.join() === intervals.join(),
    )!;
    const fn: HarmonicFunction = [0, 2, 5].includes(i)
      ? "Tonic"
      : [1, 3].includes(i)
        ? "Predominant"
        : "Dominant";
    return withFunction(
      makeChord(root, quality, {
        degree: degreeLabel(i, quality),
        degreeIndex: i,
        function: fn,
        source:
          variant === "natural" || key.mode === "major"
            ? "diatonic"
            : "harmonicMinor",
      }),
      key,
    );
  });
}
export function harmonicDominants(key: Key, seventh = false): Chord[] {
  return key.mode === "minor"
    ? diatonic(key, seventh, "harmonic").filter((c) =>
        [4, 6].includes(c.degreeIndex),
      )
    : [];
}
export function borrowed(key: Key, seventh = false): Chord[] {
  const opposite: Key = {
    ...key,
    mode: key.mode === "major" ? "minor" : "major",
  };
  return diatonic(opposite, seventh)
    .filter((c) =>
      key.mode === "major"
        ? [3, 5, 6].includes(c.degreeIndex)
        : [0, 3].includes(c.degreeIndex),
    )
    .map((c) =>
      withFunction(
        {
          ...c,
          source: "borrowed" as ChordSource,
          degree: degreeLabel(
            c.degreeIndex,
            c.quality,
            key.mode === "major" && [5, 6].includes(c.degreeIndex) ? "♭" : "",
          ),
        },
        key,
      ),
    );
}
export function secondaryDominants(key: Key): Chord[] {
  return diatonic(key)
    .filter((c) => c.degreeIndex !== 0 && c.quality !== "dim")
    .map((target) =>
      withFunction(
        makeChord(intervalNote(target.root, 7, 4), "7", {
          source: "secondaryDominant",
          function: "Dominant",
          degree: `V7/${target.degree}`,
          degreeIndex: -1,
          targetRoot: target.root,
        }),
        key,
      ),
    );
}
export function classify(root: string, quality: Quality, key: Key): Chord {
  const pool = [
    ...diatonic(key),
    ...diatonic(key, true),
    ...harmonicDominants(key),
    ...harmonicDominants(key, true),
    ...borrowed(key),
    ...borrowed(key, true),
    ...secondaryDominants(key),
  ];
  const exact = pool.find(
    (c) => pitch(c.root) === pitch(root) && c.quality === quality,
  );
  if (exact) return exact;
  const intervals = QUALITIES[quality].intervals;
  const base = pool.find(
    (c) =>
      pitch(c.root) === pitch(root) &&
      (["sus2", "sus4"].includes(quality) ||
        QUALITIES[c.quality].intervals.slice(0, 3).join() ===
          intervals.slice(0, 3).join()),
  );
  if (!base) return makeChord(root, quality);
  const suffix = QUALITIES[quality].suffix.replace(/^m(?!aj)/, "");
  const degree =
    base.source === "secondaryDominant"
      ? base.degree.replace("V7/", `V${suffix}/`)
      : base.degree.replace(/maj7|ø7|°7|7$/, "") + suffix;
  return makeChord(base.root, quality, {
    ...base,
    degree,
    source: "custom",
    extensions: intervals.filter((n) => n >= 10).map(String),
  });
}
export function transpose(c: Chord, from: Key, to: Key): Chord {
  const shift = mod(pitch(to.tonic) - pitch(from.tonic));
  const letters = mod(
    LETTERS.indexOf(to.tonic[0]) - LETTERS.indexOf(from.tonic[0]),
    7,
  );
  const move = (note: string) =>
    spell(
      pitch(note) + shift,
      LETTERS[mod(LETTERS.indexOf(note[0]) + letters, 7)],
    );
  return makeChord(move(c.root), c.quality, {
    ...c,
    targetRoot: c.targetRoot ? move(c.targetRoot) : undefined,
    analysisKey: c.analysisKey
      ? { ...c.analysisKey, tonic: move(c.analysisKey.tonic) }
      : undefined,
    interpretations: c.interpretations?.map((a) => ({
      ...a,
      key: { ...a.key, tonic: move(a.key.tonic) },
    })),
    contextualReasons: undefined,
  });
}

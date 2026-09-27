import type { Chord, Key, SectionConnectionContext } from "./types";
import { diatonic, makeChord, chordName, classify, invert } from "./chords";
import { chromaticName, intervalNote, pitch } from "./notes";
import { evaluate } from "./recommendation";
export interface Pivot {
  chord: Chord;
  currentDegree: string;
  targetDegree: string;
  sourceKey: Key;
  targetKey: Key;
}
export type ConnectionMood =
  "自然" | "盛り上げる" | "落ち着かせる" | "意外性" | "転調";
export function relatedKeys(key: Key): { key: Key; relation: string }[] {
  return [
    {
      key: { tonic: intervalNote(key.tonic, 7, 4), mode: key.mode },
      relation: "属調 / Dominant",
    },
    {
      key: { tonic: intervalNote(key.tonic, 5, 3), mode: key.mode },
      relation: "下属調 / Subdominant",
    },
    {
      key: {
        tonic: intervalNote(
          key.tonic,
          key.mode === "major" ? 9 : 3,
          key.mode === "major" ? 5 : 2,
        ),
        mode: key.mode === "major" ? ("minor" as const) : ("major" as const),
      },
      relation: "平行調 / Relative",
    },
    {
      key: {
        ...key,
        mode: key.mode === "major" ? ("minor" as const) : ("major" as const),
      },
      relation: "同主調 / Parallel",
    },
  ].map((item) => ({
    ...item,
    key: {
      ...item.key,
      tonic:
        item.key.tonic.length > 2
          ? chromaticName(pitch(item.key.tonic), key.tonic.includes("b"))
          : item.key.tonic,
    },
  }));
}
export function pivots(from: Key, to: Key): Pivot[] {
  const target = diatonic(to);
  return diatonic(from).flatMap((c) => {
    const found = target.find(
      (t) => pitch(t.root) === pitch(c.root) && t.quality === c.quality,
    );
    return found
      ? [
          {
            chord: connectionChord(c, from, to),
            currentDegree: c.degree,
            targetDegree: found.degree,
            sourceKey: from,
            targetKey: to,
          },
        ]
      : [];
  });
}
export function modulationRoutes(
  from: Key,
  to: Key,
): { label: string; chords: Chord[]; reason: string }[] {
  const tonic = diatonic(to)[0];
  const dom = makeChord(intervalNote(to.tonic, 7, 4), "7", {
    source: "modulation",
    degree: "V7",
    degreeIndex: 4,
    function: "Dominant",
  });
  const common = pivots(from, to).sort(
    (a, b) =>
      Number(b.targetDegree === "ii" || b.targetDegree === "iv") -
      Number(a.targetDegree === "ii" || a.targetDegree === "iv"),
  );
  const routes = common.slice(0, 3).map((p) => ({
    label: "共通和音でつなぐ",
    chords: [p.chord, dom, tonic],
    reason: `${chordName(p.chord)}は現在の${p.currentDegree}、転調先の${p.targetDegree}。共通和音から転調先のV7 → I / iへ進みます。`,
  }));
  routes.push({
    label: "ドミナントで導く",
    chords: [dom, tonic],
    reason: "転調先のドミナントで新しい主音を予感させ、解決します。",
  });
  routes.push({
    label: "ダイレクトに切り替える",
    chords: [tonic],
    reason:
      "共通和音を挟まず、新しいキーから始めます。セクション境界の変化を際立たせます。",
  });
  return routes.slice(0, 5);
}
export function connectionRoutes(
  last: Chord | undefined,
  first: Chord | undefined,
  target: Key,
  mood: ConnectionMood,
): { chords: Chord[]; score: number; reason: string }[] {
  // Backward-compatible same-key entry point. New callers supply both keys.
  return findConnectionRoutes(
    {
      sourceKey: target,
      targetKey: target,
      sourceChord: last,
      targetChord: first,
    },
    mood,
  ).map((route) => ({
    ...route,
    chords: first ? [...route.chords.slice(0, -1), first] : route.chords,
  }));
}
export function connectionChord(
  chord: Chord,
  sourceKey: Key,
  targetKey: Key,
): Chord {
  const source = classify(chord.root, chord.quality, sourceKey);
  const target = invert(
    classify(chord.root, chord.quality, targetKey),
    chord.inversion,
  );
  return {
    ...target,
    analysisKey: targetKey,
    interpretations: [
      {
        key: { ...sourceKey },
        degree: source.degree,
        function: source.function,
      },
      {
        key: { ...targetKey },
        degree: target.degree,
        function: target.function,
      },
    ],
  };
}
export function findConnectionRoutes(
  context: SectionConnectionContext,
  mood: ConnectionMood,
): {
  chords: Chord[];
  score: number;
  reason: string;
  context: SectionConnectionContext;
}[] {
  const {
    sourceKey,
    targetKey: target,
    sourceChord: last,
    targetChord: first,
  } = context;
  const destination = first ?? diatonic(target)[0];
  const pool = diatonic(target, true);
  const dom = makeChord(intervalNote(destination.root, 7, 4), "7", {
    function: "Dominant",
    degree: `V7/${destination.degree}`,
    source: "secondaryDominant",
    targetRoot: destination.root,
  });
  const nodes = [...pool, dom];
  let beam: { chords: Chord[]; score: number }[] = [{ chords: [], score: 0 }];
  const results: {
    chords: Chord[];
    score: number;
    reason: string;
    context: SectionConnectionContext;
  }[] = [];
  for (let depth = 0; depth < 3; depth++) {
    beam = beam
      .flatMap((path) =>
        nodes
          .filter(
            (c) =>
              !path.chords.some((p) => chordName(p) === chordName(c)) &&
              chordName(c) !== chordName(destination),
          )
          .map((c) => {
            const previous =
              path.chords.at(-1) ??
              (last ? connectionChord(last, sourceKey, target) : undefined);
            const moodScore =
              mood === "盛り上げる"
                ? c.function === "Dominant"
                  ? 25
                  : 0
                : mood === "落ち着かせる"
                  ? c.function === "Dominant"
                    ? -40
                    : 12
                  : mood === "意外性"
                    ? c.degreeIndex === 5 || c.degreeIndex === 2
                      ? 35
                      : 0
                    : mood === "転調"
                      ? c.source === "secondaryDominant"
                        ? 35
                        : 0
                      : 0;
            return {
              chords: [...path.chords, c],
              score:
                path.score +
                (path.chords.length || !last
                  ? evaluate(previous, c, target).score
                  : 0.65 * evaluate(previous, c, target).score +
                    0.35 *
                      evaluate(
                        classify(last.root, last.quality, sourceKey),
                        classify(c.root, c.quality, sourceKey),
                        sourceKey,
                      ).score) +
                moodScore,
            };
          }),
      )
      .sort((a, b) => b.score / b.chords.length - a.score / a.chords.length)
      .slice(0, 24);
    for (const path of beam) {
      const end = evaluate(path.chords.at(-1), destination, target);
      results.push({
        chords: [...path.chords, destination].map((c) =>
          connectionChord(c, sourceKey, target),
        ),
        score: (path.score + end.score) / (path.chords.length + 1),
        reason: end.reasons[0],
        context,
      });
    }
  }
  return results.sort((a, b) => b.score - a.score).slice(0, 4);
}

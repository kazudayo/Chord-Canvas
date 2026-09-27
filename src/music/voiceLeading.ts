import { invert } from "./chords";
import { distance, pitch } from "./notes";
import type { Chord } from "./types";
export function voicing(c: Chord): number[] {
  const pcs = [
    ...c.notes.slice(c.inversion),
    ...c.notes.slice(0, c.inversion),
  ].map(pitch);
  const midi: number[] = [];
  for (const pc of pcs) {
    let n = 48 + pc;
    while (midi.length && n <= midi[midi.length - 1]) n += 12;
    midi.push(n);
  }
  return midi;
}
// Minimum injective matching between the smaller and larger pitch-class sets.
// Extra voices are allowed to appear/disappear (triad ↔ seventh), never reused.
export function voiceDistance(a: Chord, b: Chord): number {
  let small = a.notes.map(pitch),
    large = b.notes.map(pitch);
  if (small.length > large.length) [small, large] = [large, small];
  const memo = new Map<string, number>();
  function match(i: number, mask: number): number {
    if (i === small.length) return 0;
    const key = `${i}:${mask}`;
    if (memo.has(key)) return memo.get(key)!;
    const cost = Math.min(
      ...large.map((n, j) =>
        mask & (1 << j)
          ? Infinity
          : distance(small[i], n) + match(i + 1, mask | (1 << j)),
      ),
    );
    memo.set(key, cost);
    return cost;
  }
  return match(0, 0) + Math.abs(a.notes.length - b.notes.length);
}
export function bestInversion(
  previous: Chord,
  next: Chord,
): { chord: Chord; reason: string } {
  const prev = voicing(previous);
  const ranked = next.notes
    .map((_, i) => {
      const chord = invert(next, i),
        notes = voicing(chord);
      const bass = Math.abs(prev[0] - notes[0]);
      const motion = notes.reduce(
        (total, n, index) =>
          total + Math.abs(n - prev[Math.min(index, prev.length - 1)]),
        0,
      );
      return { chord, score: bass * 2 + motion, bass };
    })
    .sort((a, b) => a.score - b.score)[0];
  const delta = voicing(ranked.chord)[0] - prev[0];
  return {
    chord: ranked.chord,
    reason:
      delta === 0
        ? "ベース音を保ち、上の声部だけを動かせます。"
        : ranked.bass <= 2
          ? `ベースが${ranked.bass === 1 ? "半音" : "全音"}で${delta < 0 ? "下降" : "上昇"}し、滑らかにつながります。`
          : "ベースと各声部の移動量が小さくなる配置です。",
  };
}

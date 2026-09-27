import type { Chord, Key, Mood, Recommendation } from "./types";
import {
  borrowed,
  chordName,
  diatonic,
  harmonicDominants,
  secondaryDominants,
} from "./chords";
import { distance, mod, pitch } from "./notes";
import { voiceDistance } from "./voiceLeading";
import { functionWeight } from "./functions";
import { explainTransition } from "./reasons";

export const MOODS: Mood[] = [
  "すべて",
  "明るい",
  "暗い",
  "切ない",
  "不穏",
  "壮大",
  "おしゃれ",
  "緊張感",
  "落ち着く",
];
export function cadence(a: Chord, b: Chord, key: Key): string | undefined {
  const tonic = pitch(key.tonic),
    aRoot = mod(pitch(a.root) - tonic),
    bRoot = mod(pitch(b.root) - tonic);
  const isV =
    aRoot === 7 && ["major", "7", "9", "11", "13"].includes(a.quality);
  const tonicQualities =
    key.mode === "major"
      ? ["major", "maj7", "maj9", "add9"]
      : ["minor", "m7", "m9", "mMaj7"];
  const resolvesToTonic = bRoot === 0 && tonicQualities.includes(b.quality);
  if (isV && resolvesToTonic) return "正格終止";
  if (
    aRoot === 5 &&
    ["major", "minor", "maj7", "m7", "maj9", "m9", "add9"].includes(
      a.quality,
    ) &&
    resolvesToTonic
  )
    return "変格終止";
  const substituteQualities =
    key.mode === "major"
      ? ["minor", "m7", "m9"]
      : ["major", "maj7", "maj9", "add9"];
  if (
    isV &&
    bRoot === (key.mode === "major" ? 9 : 8) &&
    substituteQualities.includes(b.quality)
  )
    return "偽終止";
  if (bRoot === 7 && ["major", "7", "9", "11", "13"].includes(b.quality))
    return "半終止";
}
export function evaluate(
  current: Chord | undefined,
  candidate: Chord,
  key: Key,
  mood: Mood = "すべて",
): Recommendation {
  let score = candidate.source === "diatonic" ? 15 : 5;
  let category = "自然";
  const reasons: string[] = [];
  if (!current) {
    score += [60, 20, 10, 30, 5, 40, 0][candidate.degreeIndex] ?? 0;
    reasons.push(
      candidate.degreeIndex === 0
        ? "主調を明確に感じさせる、基本的な開始コードです。"
        : candidate.degreeIndex === 5
          ? "トニックの代理として、少し落ち着いた印象から始められます。"
          : `${candidate.function}の響きから、自由に物語を始められます。`,
    );
  } else {
    const transitions: Record<string, number> = {
      "Tonic:Predominant": 27,
      "Tonic:Dominant": 22,
      "Predominant:Dominant": 38,
      "Dominant:Tonic": 38,
      "Predominant:Tonic": 18,
      "Tonic:Tonic": 12,
    };
    score +=
      (transitions[`${current.function}:${candidate.function}`] ?? 0) *
      Math.min(functionWeight(current), functionWeight(candidate));
    const cad = cadence(current, candidate, key);
    if (cad === "正格終止") {
      score += 48;
      category = "強い解決";
      reasons.push(
        `${current.degree} → ${candidate.degree} の正格終止。緊張から安定へ向かう、強い解決です。`,
      );
    } else if (cad === "偽終止") {
      score += 26;
      category = "進行を継続";
      reasons.push(
        `${key.mode === "major" ? "V → vi" : "V → VI"} の偽終止。予想を少し裏切って、物語を続けられます。`,
      );
    } else if (cad === "変格終止") {
      score += 25;
      category = "穏やかな解決";
      reasons.push(
        "IV / iv → I / i の変格終止。柔らかく落ち着くつながりです。",
      );
    } else if (
      current.function === "Predominant" &&
      candidate.function === "Dominant"
    ) {
      reasons.push(
        `${current.degree} → ${candidate.degree}。PredominantからDominantへ進み、トニックへの解決を準備します。`,
      );
    } else {
      reasons.push(
        `${current.function} → ${candidate.function}。${candidate.function === "Tonic" ? "安定した響きへ戻ります。" : candidate.function === "Predominant" ? "響きを広げ、次の展開を準備します。" : "緊張感をつくり、先へ進む力を加えます。"}`,
      );
    }
    if (
      current.targetRoot &&
      pitch(current.targetRoot) === pitch(candidate.root)
    ) {
      score += 90;
      category = "強い解決";
      reasons.unshift(
        `${chordName(current)}は${chordName(candidate)}へ向かうセカンダリードミナント。狙った和音へ解決します。`,
      );
    }
    if (mod(pitch(current.root) - pitch(candidate.root)) === 7) {
      score += 15;
      reasons.push("根音が完全5度下へ進む、力強いつながりです。");
    }
    const common = candidate.notes.filter((n) =>
      current.notes.some((a) => pitch(a) === pitch(n)),
    );
    score +=
      common.length * 3 + Math.max(0, 12 - voiceDistance(current, candidate));
    score += Math.max(
      0,
      4 - distance(pitch(current.bassNote), pitch(candidate.bassNote)),
    );
    if (common.length)
      reasons.push(
        `共通音 ${common.join("・")} を保ち、声部をつなげられます。`,
      );
    if (pitch(candidate.root) === pitch(key.tonic)) {
      const leading = current.notes.find(
        (n) => mod(pitch(n) - pitch(key.tonic)) === 11,
      );
      if (leading) {
        score += 8;
        reasons.push(`導音 ${leading} → ${key.tonic} が半音で解決します。`);
      }
      const seventh = current.notes[3];
      const resolution =
        seventh &&
        candidate.notes.find((n) => mod(pitch(seventh) - pitch(n)) === 1);
      if (seventh && resolution) {
        score += 6;
        reasons.push(`第7音 ${seventh} → ${resolution} が半音下行します。`);
      }
    }
    if (
      current.root === candidate.root &&
      current.quality === candidate.quality
    )
      score -= 40;
  }
  if (candidate.source === "borrowed") {
    category = "借用和音";
    reasons.unshift(
      `同主${key.mode === "major" ? "短" : "長"}調からの借用和音。いつものキーに違った陰影を加えます。`,
    );
  }
  if (candidate.source === "secondaryDominant") {
    category = "セカンダリードミナント";
    reasons.unshift(
      `${candidate.targetRoot}を根音とする和音へ向かうセカンダリードミナントです。`,
    );
  }
  if (candidate.source === "harmonicMinor")
    reasons.unshift(
      "ハーモニック・マイナーの導音を使い、短調の解決感を強めます。",
    );
  const minor =
    candidate.quality.startsWith("m") && !candidate.quality.startsWith("maj");
  const moodBoost =
    mood === "すべて"
      ? 0
      : ["暗い", "切ない"].includes(mood)
        ? minor || candidate.source === "borrowed"
          ? 25
          : 0
        : ["不穏", "緊張感"].includes(mood)
          ? candidate.function === "Dominant"
            ? 28
            : 0
          : mood === "おしゃれ"
            ? candidate.notes.length >= 4
              ? 22
              : 0
            : mood === "落ち着く"
              ? candidate.function === "Tonic"
                ? 25
                : 0
              : ["明るい", "壮大"].includes(mood)
                ? !minor && !candidate.quality.includes("dim")
                  ? 20
                  : 0
                : 0;
  return {
    chord: candidate,
    score: score + moodBoost,
    category,
    reasons,
    explanations: explainTransition(
      current,
      candidate,
      key,
      current ? cadence(current, candidate, key) : undefined,
    ),
  };
}
export function recommendations(
  current: Chord | undefined,
  key: Key,
  seventh: boolean,
  category = "すべて",
  mood: Mood = "すべて",
): Recommendation[] {
  const pool = [
    ...diatonic(key, seventh),
    ...harmonicDominants(key, seventh),
    ...borrowed(key, seventh),
    ...secondaryDominants(key),
  ];
  return pool
    .map((c) => evaluate(current, c, key, mood))
    .filter(
      (r) =>
        category === "すべて" ||
        (category === "ダイアトニック"
          ? ["diatonic", "harmonicMinor"].includes(r.chord.source)
          : r.category === category),
    )
    .sort((a, b) => b.score - a.score);
}
export function substitutes(chord: Chord, key: Key): Chord[] {
  return diatonic(key, chord.notes.length >= 4).filter(
    (c) => c.function === chord.function && pitch(c.root) !== pitch(chord.root),
  );
}

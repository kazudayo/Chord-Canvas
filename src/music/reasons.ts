import type { Chord, Key, RecommendationReason } from "./types";
import { mod, pitch } from "./notes";
import { voiceDistance } from "./voiceLeading";
export function explainTransition(
  current: Chord | undefined,
  next: Chord,
  key: Key,
  cadenceName?: string,
): RecommendationReason[] {
  const reasons: RecommendationReason[] = [];
  const add = (
    id: string,
    title: string,
    explanation: string,
    priority: number,
  ) => reasons.push({ id, title, explanation, priority });
  if (!current)
    add(
      "opening",
      "最初の響き",
      next.degreeIndex === 0
        ? "主調をはっきり感じさせる、安定した出発点です。"
        : "主和音以外から始めて、少し違う物語を作れます。",
      50,
    );
  if (cadenceName === "正格終止")
    add(
      "authentic-cadence",
      `${current!.degree} → ${next.degree} · 正格終止`,
      "DominantからTonicへ、緊張がほどける強い解決です。",
      100,
    );
  if (cadenceName === "偽終止")
    add(
      "deceptive-cadence",
      "偽終止",
      "主和音に戻ると予想させながら別の安定した和音へ進み、曲を続けられます。",
      99,
    );
  if (cadenceName === "変格終止")
    add(
      "plagal-cadence",
      "変格終止",
      "IV / ivから主和音へ、柔らかく落ち着くつながりです。",
      98,
    );
  if (current?.targetRoot && pitch(current.targetRoot) === pitch(next.root))
    add(
      "secondary-resolution",
      "副ドミナントの解決",
      `${current.root}7が準備した${next.root}の和音に着地します。`,
      105,
    );
  if (next.source === "borrowed")
    add(
      "modal-interchange",
      "同主調からの借用",
      `${key.tonic} ${key.mode === "major" ? "Minor" : "Major"}の${next.borrowedDegree ?? next.degree}を借用。${next.contextualReasons?.[0] ?? "いつものキーに違う陰影を加えます。"}`,
      95,
    );
  if (next.source === "secondaryDominant")
    add(
      "secondary-dominant",
      "次の目的地を準備",
      `${next.targetRoot}を根音とする和音へ進みやすくする、セカンダリードミナントです。`,
      95,
    );
  if (
    current &&
    ((pitch(next.root) === pitch(key.tonic) && next.function === "Tonic") ||
      (current.targetRoot && pitch(current.targetRoot) === pitch(next.root)))
  ) {
    const leading = current.notes.find(
      (n) => mod(pitch(next.root) - pitch(n)) === 1,
    );
    if (
      current.function === "Dominant" &&
      current.functionStrength !== "weak" &&
      leading
    )
      add(
        "leading-tone-resolution",
        "導音解決",
        `${leading} → ${next.root}。半音上に進む導音が、着地する感覚を強めます。`,
        90,
      );
    const seventh =
      current.notes.length >= 4 && /7|9|11|13/.test(current.quality)
        ? current.notes[3]
        : undefined;
    const resolution =
      seventh &&
      next.notes.find(
        (n) =>
          [1, 2].includes(mod(pitch(seventh) - pitch(n))) &&
          pitch(n) === pitch(next.notes[1]),
      );
    if (current.function === "Dominant" && seventh && resolution)
      add(
        "seventh-resolution",
        "7thの下行解決",
        `${seventh} → ${resolution}。第7音を一段下げると、緊張が自然にほどけます。`,
        85,
      );
  }
  if (current?.functionStrength === "weak")
    add(
      "weak-dominant",
      "穏やかなドミナント",
      "導音がないため、長三和音のV・V7より柔らかい動きになります。",
      80,
    );
  if (next.functionStrength === "weak")
    add(
      "weak-dominant",
      "Dominant (weak)",
      "自然短音階のv・VII。導音を含むV・V7ほど強く解決を求めません。",
      80,
    );
  if (current) {
    const common = next.notes.filter((n) =>
      current.notes.some((m) => pitch(m) === pitch(n)),
    );
    if (common.length)
      add(
        "common-tone",
        "共通音",
        `${common.join("・")}の音を前後で保つと、響きが滑らかにつながります。`,
        60,
      );
    if (voiceDistance(current, next) <= 5)
      add(
        "voice-leading",
        "小さな声部移動",
        "構成音同士の移動が小さく、急に跳躍しない配置を選びやすい組み合わせです。",
        55,
      );
    if (
      !reasons.some(
        (r) => r.id.endsWith("cadence") || r.id === "secondary-resolution",
      )
    )
      add(
        "functional-motion",
        `${current.function} → ${next.function}`,
        next.function === "Dominant"
          ? "ドミナントへ進み、次のトニックへの解決を準備します。"
          : next.function === "Predominant"
            ? "響きを広げて、次の展開につなげられます。"
            : "安定した響きに戻り、ひと息つけます。",
        65,
      );
  }
  return reasons.sort((a, b) => b.priority - a.priority).slice(0, 3);
}

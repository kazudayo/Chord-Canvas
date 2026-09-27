import type { Chord, Key, Mode, Quality } from "./types";
import { classify, makeChord } from "./chords";
import { scale } from "./keys";
import { intervalNote } from "./notes";
export interface ProgressionPreset {
  id: string;
  name: string;
  aliases?: string[];
  mode: Mode;
  degrees: string[];
  mood: string;
  description: string;
}
export const PRESETS: ProgressionPreset[] = [
  {
    id: "pop",
    name: "王道ポップ",
    aliases: ["ポップパンク進行"],
    mode: "major",
    degrees: ["I", "V", "vi", "IV"],
    mood: "明るい・開放的",
    description:
      "主和音から広がり、少しの切なさを経て戻る。歌を乗せやすい循環です。",
  },
  {
    id: "canon",
    name: "カノン進行",
    mode: "major",
    degrees: ["I", "V", "vi", "iii", "IV", "I", "IV", "V"],
    mood: "穏やか・ドラマチック",
    description: "親しみやすい8コード。小さな物語をゆっくり育てたいときに。",
  },
  {
    id: "fifties",
    name: "50s / ドゥーワップ",
    mode: "major",
    degrees: ["I", "vi", "IV", "V"],
    mood: "懐かしい・あたたかい",
    description: "明るさと郷愁が同居する、クラシックな4コード。",
  },
  {
    id: "turnaround",
    name: "ジャズ・ターンアラウンド",
    mode: "major",
    degrees: ["I", "vi", "ii", "V"],
    mood: "なめらか・循環",
    description: "次の主和音へ帰るための定番。7thに編集しても楽しめます。",
  },
  {
    id: "two-five-one",
    name: "ツー・ファイブ・ワン",
    mode: "major",
    degrees: ["ii", "V", "I"],
    mood: "自然・落ち着く",
    description: "下属機能からドミナント、主和音へ。解決感を聴き比べる基本形。",
  },
  {
    id: "royal",
    name: "王道進行",
    mode: "major",
    degrees: ["IV", "V", "iii", "vi"],
    mood: "切ない・高揚感",
    description: "少し浮遊した始まりから短調の響きへ。サビの出発点にも。",
  },
  {
    id: "komuro",
    name: "小室進行",
    mode: "major",
    degrees: ["vi", "IV", "V", "I"],
    mood: "切ない・力強い",
    description: "短調の響きから始めて、長調へ開いていく4コード。",
  },
  {
    id: "marunouchi",
    name: "丸サ進行",
    aliases: ["Just the Two of Us系"],
    mode: "major",
    degrees: ["IVmaj7", "III7", "vi7", "I7"],
    mood: "都会的・ほろ苦い",
    description:
      "III7がvi7へ導く進行。最後のI7は次のIVmaj7へのドミナントとして聴けます。",
  },
  {
    id: "blues",
    name: "12小節ブルース",
    mode: "major",
    degrees: [
      "I7",
      "IV7",
      "I7",
      "I7",
      "IV7",
      "IV7",
      "I7",
      "I7",
      "V7",
      "IV7",
      "I7",
      "V7",
    ],
    mood: "ブルージー・ゆったり",
    description:
      "各コードを4拍にすると12小節。I7・IV7はブルース特有の響きとして使います。",
  },
  {
    id: "minor-pop",
    name: "マイナー・ポップ",
    mode: "minor",
    degrees: ["i", "VI", "III", "VII"],
    mood: "切ない・壮大",
    description: "自然短音階の循環。強い導音を使わず、滑らかに回ります。",
  },
  {
    id: "minor-cadence",
    name: "マイナーの基本終止",
    mode: "minor",
    degrees: ["i", "iv", "V", "i"],
    mood: "暗い・明確な解決",
    description: "長三和音のVに導音が含まれるため、iへの引力が強くなります。",
  },
  {
    id: "andalusian",
    name: "アンダルシア進行",
    mode: "minor",
    degrees: ["i", "VII", "VI", "V"],
    mood: "情熱的・ドラマチック",
    description:
      "主音から下がっていくベースが特徴。最後は強いVで緊張を残します。",
  },
];
export function presetChords(preset: ProgressionPreset, key: Key): Chord[] {
  const musicKey = { ...key, mode: preset.mode };
  const tones = scale(musicKey);
  return preset.degrees.map((degree) => {
    const match = /^([b#]?)([ivIV]+)(maj7|7)?$/.exec(degree);
    if (!match) throw new Error(`Unsupported degree: ${degree}`);
    const index = ["I", "II", "III", "IV", "V", "VI", "VII"].indexOf(
      match[2].toUpperCase(),
    );
    if (index < 0) throw new Error(`Unsupported degree: ${degree}`);
    const root = intervalNote(
      tones[index],
      match[1] === "b" ? -1 : match[1] === "#" ? 1 : 0,
      0,
    );
    const minor = match[2] === match[2].toLowerCase();
    const quality: Quality =
      match[3] === "maj7"
        ? "maj7"
        : match[3] === "7"
          ? minor
            ? "m7"
            : "7"
          : minor
            ? "minor"
            : "major";
    const analyzed = classify(root, quality, musicKey);
    const chord = {
      ...analyzed,
      degree,
      degreeIndex: index,
      analysisKey: musicKey,
    };
    if (preset.id === "blues" && index !== 4)
      return {
        ...makeChord(root, quality, chord),
        function: index === 0 ? "Tonic" : "Predominant",
        functionStrength: "contextual",
        contextualReasons: [
          "ブルースではI7・IV7を安定した響きとして扱うことがあります。",
        ],
      };
    return chord;
  });
}

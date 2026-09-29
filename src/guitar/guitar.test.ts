import { describe, expect, it } from "vitest";
import { invert, makeChord, QUALITIES, transpose } from "../music/chords";
import { mod, pitch } from "../music/notes";
import type { ChordEntry, Song } from "../music/types";
import { validSong } from "../state/workspace";
import { fretSpan, midiAt, midiNoteName, soundingPositions } from "./fretboard";
import { optimizeProgressionVoicings } from "./progressionVoicing";
import { tabDisplayOrder, tabFingers, tabFrets } from "./tab";
import { STANDARD_TUNING } from "./tuning";
import {
  generateGuitarVoicings,
  validateGuitarVoicing,
  voicingMatchesChord,
} from "./voicingGenerator";

const standard = {
  style: "standard" as const,
  position: "auto" as const,
  limit: 12,
};

function first(root: string, quality: Parameters<typeof makeChord>[1]) {
  const chord = makeChord(root, quality);
  const voicing = generateGuitarVoicings(chord, standard)[0];
  expect(voicing).toBeDefined();
  return { chord, voicing };
}

function intervals(root: string, voicing: ReturnType<typeof first>["voicing"]) {
  return new Set(
    soundingPositions(voicing.positions).map((position) =>
      mod((position.midiNote ?? 0) - pitch(root)),
    ),
  );
}

describe("ギター標準チューニングとTAB", () => {
  it("Standard E2 A2 D3 G3 B3 E4 とフレット音高を保持する", () => {
    expect(STANDARD_TUNING.strings).toEqual({
      6: 40,
      5: 45,
      4: 50,
      3: 55,
      2: 59,
      1: 64,
    });
    expect(midiAt(5, 3)).toBe(48);
    expect(midiNoteName(midiAt(5, 3))).toBe("C3");
    expect(tabDisplayOrder()).toEqual([1, 2, 3, 4, 5, 6]);
  });

  it("C open は x32010、開放弦は指0、ミュート弦は発音しない", () => {
    const { chord, voicing } = first("C", "major");
    expect(tabFrets(voicing)).toEqual(["x", "3", "2", "0", "1", "0"]);
    expect(tabFingers(voicing)).toEqual(["x", "3", "2", "0", "1", "0"]);
    expect(soundingPositions(voicing.positions)).toHaveLength(5);
    expect(validateGuitarVoicing(chord, voicing)).toBe(true);
  });
});

describe("コード品質別の構成音ルール", () => {
  it("対応する全コード品質に決定的な候補を生成する", () => {
    for (const quality of Object.keys(QUALITIES) as Parameters<
      typeof makeChord
    >[1][]) {
      const chord = makeChord("C", quality);
      const voicings = generateGuitarVoicings(chord, standard);
      expect(voicings.length, quality).toBeGreaterThan(0);
      expect(validateGuitarVoicing(chord, voicings[0]), quality).toBe(true);
    }
  });

  it.each([
    ["C", "maj7", [0, 4, 7, 11]],
    ["A", "m7", [0, 3, 7, 10]],
    ["B", "m7b5", [0, 3, 6, 10]],
  ] as const)("%s %s の必須音を含む", (root, quality, required) => {
    const { chord, voicing } = first(root, quality);
    const found = intervals(root, voicing);
    required.forEach((tone) => expect(found.has(tone)).toBe(true));
    expect(validateGuitarVoicing(chord, voicing)).toBe(true);
  });

  it("Jazz の G7 はガイドトーン3rd/7thを省略しない", () => {
    const chord = makeChord("G", "7");
    const voicing = generateGuitarVoicings(chord, {
      style: "jazz",
      position: "middle",
      limit: 12,
    })[0];
    expect(voicing).toBeDefined();
    const found = intervals("G", voicing);
    expect(found.has(4)).toBe(true);
    expect(found.has(10)).toBe(true);
    expect(validateGuitarVoicing(chord, voicing, "jazz")).toBe(true);
  });

  it("Easy は4フレット幅未満、フォームの指番号は0〜4に収まる", () => {
    for (const [root, quality] of [
      ["C", "major"],
      ["A", "minor"],
      ["G", "7"],
    ] as const) {
      const chord = makeChord(root, quality);
      const voicings = generateGuitarVoicings(chord, {
        style: "easy",
        position: "auto",
        limit: 8,
      });
      expect(voicings.length).toBeGreaterThan(0);
      for (const voicing of voicings) {
        expect(fretSpan(voicing.positions)).toBeLessThanOrEqual(3);
        expect(
          voicing.positions.every(
            (position) =>
              position.finger == null ||
              (position.finger >= 0 && position.finger <= 4),
          ),
        ).toBe(true);
      }
    }
  });

  it("F major に実用的なバレー情報を生成する", () => {
    const { voicing } = first("F", "major");
    expect(voicing.barres?.length).toBeGreaterThan(0);
  });
});

describe("スラッシュコードと進行最適化", () => {
  it("C/E は最低音をEにする", () => {
    const chord = invert(makeChord("C", "major"), 1);
    const voicing = generateGuitarVoicings(chord, standard)[0];
    expect(voicing).toBeDefined();
    const lowest = soundingPositions(voicing.positions)[0];
    expect(mod(lowest.midiNote ?? 0)).toBe(pitch("E"));
    expect(validateGuitarVoicing(chord, voicing)).toBe(true);
  });

  it("進行全体に同じ長さの弾きやすいフォーム列を返す", () => {
    const entries: ChordEntry[] = [
      makeChord("C", "maj7"),
      makeChord("A", "m7"),
      makeChord("D", "m7"),
      makeChord("G", "7"),
    ].map((chord, index) => ({ id: String(index), chord, beats: 4 }));
    const result = optimizeProgressionVoicings(entries, standard);
    expect(result).toHaveLength(entries.length);
    result.forEach((voicing, index) =>
      expect(validateGuitarVoicing(entries[index].chord, voicing)).toBe(true),
    );
  });
});

describe("保存互換性と移調時の再計算", () => {
  const baseSong = (entry: ChordEntry): Song => ({
    id: "song",
    title: "test",
    sections: [
      {
        id: "section",
        name: "A",
        key: { tonic: "C", mode: "major" },
        chords: [entry],
        melody: [],
      },
    ],
    bpm: 90,
    beats: 4,
    pattern: "block",
    rhythm: "off",
    loop: false,
    updatedAt: "2026-09-29",
  });

  it("旧データはguitarVoicingなしで有効", () => {
    expect(
      validSong(
        baseSong({ id: "c", chord: makeChord("C", "major"), beats: 4 }),
      ),
    ).toBe(true);
  });

  it("選択フォームをJSON保存して復元できる", () => {
    const { chord, voicing } = first("C", "major");
    const song = baseSong({ id: "c", chord, beats: 4, guitarVoicing: voicing });
    const restored = JSON.parse(JSON.stringify(song)) as Song;
    expect(validSong(restored)).toBe(true);
    expect(restored.sections[0].chords[0].guitarVoicing?.id).toBe(voicing.id);
  });

  it("移調前フォームは不一致となり移調先で再生成できる", () => {
    const { chord, voicing } = first("C", "major");
    const moved = transpose(
      chord,
      { tonic: "C", mode: "major" },
      { tonic: "D", mode: "major" },
    );
    expect(voicingMatchesChord(moved, voicing)).toBe(false);
    expect(generateGuitarVoicings(moved, standard).length).toBeGreaterThan(0);
  });
});

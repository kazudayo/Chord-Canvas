import { describe, it, expect } from "vitest";
import {
  borrowed,
  chordName,
  classify,
  diatonic,
  harmonicDominants,
  invert,
  transpose,
} from "./chords";
import { evaluate } from "./recommendation";
import { PRESETS, presetChords } from "./presets";
import { connectionChord, findConnectionRoutes, pivots } from "./modulation";
import { functionShort, functionWeight } from "./functions";
import type { Key } from "./types";
const C: Key = { tonic: "C", mode: "major" },
  G: Key = { tonic: "G", mode: "major" },
  A: Key = { tonic: "A", mode: "minor" };
describe("強度・借用・説明", () => {
  it("自然短調のv/VIIは弱く、和声短調のV/V7は強い", () => {
    const natural = diatonic(A);
    const v = natural[4];
    expect(functionShort(v)).toBe("Dominant (weak)");
    expect(natural[6].functionStrength).toBe("weak");
    const strong = harmonicDominants(A).find((c) => c.degreeIndex === 4)!;
    expect(strong.functionStrength).toBe("strong");
    expect(strong.notes).toContain("G#");
    expect(functionWeight(v)).toBeLessThan(functionWeight(strong));
    expect(evaluate(v, natural[0], A).score).toBeLessThan(
      evaluate(strong, natural[0], A).score,
    );
    expect(
      harmonicDominants(A, true).find((c) => c.quality === "7")
        ?.functionStrength,
    ).toBe("strong");
  });
  it("iv・♭VI・♭VIIに借用元と文脈依存の機能を残す", () => {
    const chords = borrowed(C);
    const iv = chords.find((c) => c.root === "F")!,
      vi = chords.find((c) => c.root === "Ab")!,
      vii = chords.find((c) => c.root === "Bb")!;
    expect(iv.function).toBe("Predominant");
    expect(vi.possibleFunctions).toContain("Tonic");
    expect(vii.functionStrength).toBe("contextual");
    expect(vii.possibleFunctions).toContain("Predominant");
    expect(vii.sourceMode).toBe("parallel-minor");
    expect(vii.contextualReasons?.[0]).toContain(
      "同じ強いドミナントとは限りません",
    );
  });
  it("G7→Cは正格終止・B→C・F→Eの3理由を優先", () => {
    const r = evaluate(classify("G", "7", C), classify("C", "major", C), C);
    expect(r.explanations.map((e) => e.id)).toEqual([
      "authentic-cadence",
      "leading-tone-resolution",
      "seventh-resolution",
    ]);
    expect(r.explanations[1].explanation).toContain("B → C");
    expect(r.explanations[2].explanation).toContain("F → E");
    expect(r.explanations[0].priority).toBeGreaterThan(
      r.explanations[1].priority,
    );
  });
  it("弱いvから導音解決を説明しない", () => {
    expect(
      evaluate(diatonic(A)[4], diatonic(A)[0], A).explanations.some(
        (e) => e.id === "leading-tone-resolution",
      ),
    ).toBe(false);
  });
});
describe("2つのキーを持つ接続", () => {
  it("AmをCのvi / Gのiiとして保持する", () => {
    const chord = connectionChord(classify("A", "minor", C), C, G);
    expect(chord.degree).toBe("ii");
    expect(chord.analysisKey).toEqual(G);
    expect(chord.interpretations?.map((a) => a.degree)).toEqual(["vi", "ii"]);
    expect(pivots(C, G).find((p) => p.chord.root === "A")?.targetKey).toEqual(
      G,
    );
  });
  it("接続経路は指定キーと実際の先頭和音に着地する", () => {
    const context = {
      sourceKey: C,
      targetKey: G,
      sourceChord: diatonic(C)[0],
      targetChord: invert(diatonic(G)[5], 1),
    };
    const routes = findConnectionRoutes(context, "自然");
    expect(routes.length).toBe(4);
    for (const r of routes) {
      expect(r.context).toEqual(context);
      expect(r.chords.at(-1)?.root).toBe("E");
      expect(r.chords.at(-1)?.inversion).toBe(1);
      expect(
        r.chords.every(
          (c) =>
            c.analysisKey?.tonic === "G" && c.interpretations?.length === 2,
        ),
      ).toBe(true);
    }
  });
  it("保存用JSONや移調でも両キーの解釈を保持する", () => {
    const chord = connectionChord(classify("A", "minor", C), C, G);
    expect(JSON.parse(JSON.stringify(chord)).interpretations).toEqual(
      chord.interpretations,
    );
    const moved = transpose(chord, C, { tonic: "D", mode: "major" });
    expect(moved.root).toBe("B");
    expect(moved.analysisKey?.tonic).toBe("A");
    expect(moved.interpretations?.map((a) => a.degree)).toEqual(["vi", "ii"]);
  });
});
describe("Degreeプリセット", () => {
  it("12定義を持ち、ポップパンクは同型エイリアス", () => {
    expect(PRESETS).toHaveLength(12);
    expect(PRESETS[0].aliases).toContain("ポップパンク進行");
  });
  it.each(["C", "D", "E", "Eb", "F#", "Bb"])(
    "%sへ移調でき、Degreeと通常のコード情報を保持する",
    (tonic) => {
      for (const p of PRESETS) {
        const chords = presetChords(p, { tonic, mode: p.mode });
        expect(chords.map((c) => c.degree)).toEqual(p.degrees);
        expect(
          chords.every(
            (c) =>
              c.notes.length >= 3 &&
              c.bassNote === c.root &&
              c.analysisKey?.tonic === tonic,
          ),
        ).toBe(true);
      }
    },
  );
  it("Eメジャーのポップ進行はE B C#m A", () => {
    expect(
      presetChords(PRESETS[0], { tonic: "E", mode: "major" }).map(chordName),
    ).toEqual(["E", "B", "C#m", "A"]);
  });
  it("Dメジャーのポップ進行はD A Bm G", () => {
    expect(
      presetChords(PRESETS[0], { tonic: "D", mode: "major" }).map(chordName),
    ).toEqual(["D", "A", "Bm", "G"]);
  });
  it("丸サはFmaj7 E7 Am7 C7", () => {
    expect(
      presetChords(
        PRESETS.find((p) => p.id === "marunouchi")!,
        C,
      ).map(chordName),
    ).toEqual(["Fmaj7", "E7", "Am7", "C7"]);
  });
  it("Aマイナーの終止とアンダルシアはEメジャーで終わる", () => {
    expect(
      presetChords(
        PRESETS.find((p) => p.id === "minor-cadence")!,
        A,
      ).map(chordName),
    ).toEqual(["Am", "Dm", "E", "Am"]);
    expect(
      presetChords(
        PRESETS.find((p) => p.id === "andalusian")!,
        A,
      ).map(chordName),
    ).toEqual(["Am", "G", "F", "E"]);
  });
  it("ブルースは12コード、I7の機能は文脈依存Tonic", () => {
    const c = presetChords(
      PRESETS.find((p) => p.id === "blues")!,
      C,
    );
    expect(c).toHaveLength(12);
    expect(c[0].function).toBe("Tonic");
    expect(c[0].functionStrength).toBe("contextual");
  });
});

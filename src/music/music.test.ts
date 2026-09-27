import { describe, expect, it } from "vitest";
import {
  borrowed,
  chordName,
  classify,
  diatonic,
  harmonicDominants,
  invert,
  makeChord,
  QUALITIES,
  secondaryDominants,
  transpose,
} from "./chords";
import { intervalNote, KEY_OPTIONS, mod, pitch } from "./notes";
import { scale } from "./keys";
import {
  cadence,
  evaluate,
  recommendations,
  substitutes,
} from "./recommendation";
import {
  connectionRoutes,
  modulationRoutes,
  pivots,
  relatedKeys,
} from "./modulation";
import { bestInversion, voiceDistance, voicing } from "./voiceLeading";
import type { Key, Quality } from "./types";
const C: Key = { tonic: "C", mode: "major" };
const Am: Key = { tonic: "A", mode: "minor" };
const names = (chords: ReturnType<typeof diatonic>) => chords.map(chordName);

describe("音名とスケール", () => {
  it("異名同音は同じピッチを保つ", () => {
    expect(pitch("C#")).toBe(pitch("Db"));
    expect(pitch("B#")).toBe(0);
    expect(pitch("F##")).toBe(7);
    expect(pitch("C♭")).toBe(11);
  });
  it("D MajorではF#とC#を綴る", () =>
    expect(scale({ tonic: "D", mode: "major" })).toEqual([
      "D",
      "E",
      "F#",
      "G",
      "A",
      "B",
      "C#",
    ]));
  it("Db Majorの綴り", () =>
    expect(scale({ tonic: "Db", mode: "major" })).toEqual([
      "Db",
      "Eb",
      "F",
      "Gb",
      "Ab",
      "Bb",
      "C",
    ]));
  it("C# MajorはE#・B#を含む", () =>
    expect(scale({ tonic: "C#", mode: "major" })).toEqual([
      "C#",
      "D#",
      "E#",
      "F#",
      "G#",
      "A#",
      "B#",
    ]));
  it("Natural / Harmonic / Melodic Minor", () => {
    expect(scale(Am)).toEqual(["A", "B", "C", "D", "E", "F", "G"]);
    expect(scale(Am, "harmonic")).toEqual(["A", "B", "C", "D", "E", "F", "G#"]);
    expect(scale(Am, "melodic")).toEqual(["A", "B", "C", "D", "E", "F#", "G#"]);
  });
  it("音程を文字名に沿って綴る", () =>
    expect(intervalNote("F#", 11, 6)).toBe("E#"));
});
describe("ダイアトニックと拡張和音", () => {
  it("C Major三和音", () =>
    expect(names(diatonic(C))).toEqual([
      "C",
      "Dm",
      "Em",
      "F",
      "G",
      "Am",
      "Bdim",
    ]));
  it("C Major四和音とdegree", () => {
    expect(names(diatonic(C, true))).toEqual([
      "Cmaj7",
      "Dm7",
      "Em7",
      "Fmaj7",
      "G7",
      "Am7",
      "Bm7♭5",
    ]);
    expect(diatonic(C, true).map((c) => c.degree)).toEqual([
      "Imaj7",
      "ii7",
      "iii7",
      "IVmaj7",
      "V7",
      "vi7",
      "viiø7",
    ]);
  });
  it("A Minorのダイアトニックコード", () =>
    expect(names(diatonic(Am))).toEqual([
      "Am",
      "Bdim",
      "C",
      "Dm",
      "Em",
      "F",
      "G",
    ]));
  it("A Minorの導音を持つドミナント", () => {
    expect(names(harmonicDominants(Am, true))).toEqual(["E7", "G#dim7"]);
    expect(harmonicDominants(Am).every((c) => c.function === "Dominant")).toBe(
      true,
    );
  });
  it("すべてのキー・短音階の3/4和音を生成できる", () => {
    for (const tonic of KEY_OPTIONS)
      for (const mode of ["major", "minor"] as const)
        for (const variant of ["natural", "harmonic", "melodic"] as const)
          for (const seventh of [false, true]) {
            const chords = diatonic({ tonic, mode }, seventh, variant);
            expect(chords).toHaveLength(7);
            chords.forEach((c) =>
              expect(c.notes.map((n) => mod(pitch(n) - pitch(c.root)))).toEqual(
                QUALITIES[c.quality].intervals,
              ),
            );
          }
  });
  it("テンションと減七を正しい文字名で生成する", () => {
    expect(makeChord("C", "maj9").notes).toEqual(["C", "E", "G", "B", "D"]);
    expect(makeChord("B", "dim7").notes).toEqual(["B", "D", "F", "Ab"]);
    expect(makeChord("C", "13").notes).toEqual([
      "C",
      "E",
      "G",
      "Bb",
      "D",
      "F",
      "A",
    ]);
    for (const quality of Object.keys(QUALITIES) as Quality[])
      expect(makeChord("C", quality).notes.length).toBeGreaterThanOrEqual(3);
  });
  it("借用和音を同主短調から生成する", () => {
    expect(names(borrowed(C))).toEqual(["Fm", "Ab", "Bb"]);
    expect(borrowed(C).map((c) => c.degree)).toEqual(["iv", "♭VI", "♭VII"]);
    expect(classify("F", "minor", C).source).toBe("borrowed");
  });
  it("セカンダリードミナントの目的地を保持する", () => {
    const secondary = secondaryDominants(C);
    expect(secondary.find((c) => chordName(c) === "A7")?.targetRoot).toBe("D");
    expect(secondary.find((c) => chordName(c) === "D7")?.degree).toBe("V7/V");
    expect(classify("E", "7", C).source).toBe("secondaryDominant");
  });
  it("テンション和音も基礎和音の機能を引き継ぐ", () => {
    expect(classify("D", "m9", C).function).toBe("Predominant");
    expect(classify("D", "m9", C).degree).toBe("ii9");
    expect(classify("G", "13", C).function).toBe("Dominant");
    expect(classify("G", "13", C).degree).toBe("V13");
  });
});
describe("推薦と終止", () => {
  const G7 = diatonic(C, true)[4],
    tonic = diatonic(C)[0],
    vi = diatonic(C)[5];
  it("G7 → Cを最高候補にする", () => {
    expect(recommendations(G7, C, false)[0].chord.root).toBe("C");
    expect(evaluate(G7, tonic, C).category).toBe("強い解決");
    expect(evaluate(G7, tonic, C).reasons.join(" ")).toContain("B → C");
    expect(evaluate(G7, tonic, C).reasons.join(" ")).toContain("F → E");
  });
  it("G7 → Amは偽終止", () => {
    expect(cadence(G7, vi, C)).toBe("偽終止");
    expect(evaluate(G7, vi, C).category).toBe("進行を継続");
  });
  it("G7 → C7を正格終止と誤判定しない", () =>
    expect(cadence(G7, classify("C", "7", C), C)).toBeUndefined());
  it("Dm7 → G7 / F → Gは機能進行として高評価", () => {
    expect(evaluate(diatonic(C, true)[1], G7, C).score).toBeGreaterThan(
      evaluate(diatonic(C, true)[1], diatonic(C, true)[2], C).score,
    );
    expect(evaluate(diatonic(C)[3], diatonic(C)[4], C).score).toBeGreaterThan(
      evaluate(diatonic(C)[3], diatonic(C)[2], C).score,
    );
  });
  it("E7 → Amの一時的な解決を最優先する", () =>
    expect(recommendations(classify("E", "7", C), C, false)[0].chord.root).toBe(
      "A",
    ));
  it("短調のV7 → iとV → VI", () => {
    const E7 = harmonicDominants(Am, true)[0];
    expect(recommendations(E7, Am, false)[0].chord.root).toBe("A");
    expect(cadence(E7, diatonic(Am)[0], Am)).toBe("正格終止");
    expect(cadence(E7, diatonic(Am)[5], Am)).toBe("偽終止");
    expect(cadence(diatonic(Am)[4], diatonic(Am)[0], Am)).toBeUndefined();
  });
  it("変格終止と半終止を認識する", () => {
    expect(cadence(diatonic(C)[3], tonic, C)).toBe("変格終止");
    expect(cadence(tonic, G7, C)).toBe("半終止");
  });
  it("空の進行では主和音を優先し、他の候補も残す", () => {
    const r = recommendations(undefined, C, false);
    expect(r[0].chord.root).toBe("C");
    expect(r.length).toBeGreaterThan(7);
  });
  it("同じ入力なら推薦順序と理由が同じ", () =>
    expect(recommendations(G7, C, true)).toEqual(recommendations(G7, C, true)));
  it("借用和音のみを絞り込める", () =>
    expect(
      recommendations(G7, C, false, "借用和音").every(
        (r) => r.chord.source === "borrowed",
      ),
    ).toBe(true));
  it("共通の機能を持つ代理コードを出す", () => {
    expect(names(substitutes(tonic, C))).toContain("Am");
    expect(names(substitutes(diatonic(C)[3], C))).toEqual(["Dm"]);
  });
});
describe("転回形・声部進行・移調", () => {
  it("C/EとC/Gのベースと実際の音順", () => {
    const c = makeChord("C", "major");
    expect(chordName(invert(c, 1))).toBe("C/E");
    expect(voicing(invert(c, 1))).toEqual([52, 55, 60]);
    expect(chordName(invert(c, 2))).toBe("C/G");
  });
  it("四和音の第3転回形", () => {
    const c = invert(makeChord("C", "maj7"), 3);
    expect(chordName(c)).toBe("Cmaj7/B");
    expect(voicing(c)).toEqual([59, 60, 64, 67]);
  });
  it("最短マッチングが共通音と半音移動を評価する", () => {
    const c = makeChord("C", "major");
    expect(voiceDistance(c, c)).toBe(0);
    expect(voiceDistance(c, makeChord("E", "minor"))).toBe(1);
  });
  it("転回形推薦は合法な転回形を返す", () => {
    const next = bestInversion(
      invert(makeChord("C", "major"), 2),
      makeChord("G", "major"),
    );
    expect(next.chord.notes).toContain(next.chord.bassNote);
    expect(next.reason.length).toBeGreaterThan(5);
  });
  it("C → Eにコード進行を移調する", () => {
    const source = [0, 5, 3, 4].map((i) => diatonic(C)[i]);
    expect(
      names(source.map((c) => transpose(c, C, { tonic: "E", mode: "major" }))),
    ).toEqual(["E", "C#m", "A", "B"]);
  });
  it("移調で転回形とdegreeと副ドミナントの目的地を保つ", () => {
    const next = transpose(invert(diatonic(C)[0], 1), C, {
      tonic: "Db",
      mode: "major",
    });
    expect(chordName(next)).toBe("Db/F");
    expect(next.degree).toBe("I");
    expect(
      transpose(classify("E", "7", C), C, { tonic: "E", mode: "major" })
        .targetRoot,
    ).toBe("C#");
  });
  it("全キーの移調でピッチを保つ", () => {
    for (const tonic of KEY_OPTIONS) {
      const next = transpose(makeChord("G", "7"), C, { tonic, mode: "major" });
      expect(next.notes.map(pitch)).toEqual(
        [7, 11, 2, 5].map((n) => mod(n + pitch(tonic))),
      );
    }
  });
});
describe("転調とセクション接続", () => {
  const G: Key = { tonic: "G", mode: "major" };
  it("AmはCのvi、Gのii", () => {
    const pivot = pivots(C, G).find((p) => chordName(p.chord) === "Am");
    expect(pivot?.currentDegree).toBe("vi");
    expect(pivot?.targetDegree).toBe("ii");
  });
  it("近親調・平行調・同主調を列挙する", () =>
    expect(relatedKeys(C).map((r) => r.key)).toEqual([
      G,
      { tonic: "F", mode: "major" },
      Am,
      { tonic: "C", mode: "minor" },
    ]));
  it("Am → D7 → Gの転調経路", () =>
    expect(
      modulationRoutes(C, G).some(
        (r) => names(r.chords).join(" → ") === "Am → D7 → G",
      ),
    ).toBe(true));
  it("実際の着地コードを使って最大4コード・上位4経路に絞る", () => {
    const first = diatonic(C)[0],
      last = diatonic(C)[5];
    const routes = connectionRoutes(last, first, C, "盛り上げる");
    expect(routes).toHaveLength(4);
    routes.forEach((r) => {
      expect(r.chords.length).toBeLessThanOrEqual(4);
      expect(r.chords.at(-1)).toEqual(first);
    });
  });
  it("着地がトニック以外でも終着点を変えない", () => {
    const first = diatonic(G)[5];
    expect(
      connectionRoutes(undefined, first, G, "自然").every(
        (r) => chordName(r.chords.at(-1)!) === "Em",
      ),
    ).toBe(true);
  });
});

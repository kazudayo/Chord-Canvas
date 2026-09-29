import { describe, expect, it } from "vitest";
import { makeChord } from "./chords";
import { chordToneDegree, getScaleTones, scalePreviewNotes } from "./scales";
import { scaleFretboardPositions } from "../guitar/fretboard";

const notes = (root: string, scaleId: string) =>
  getScaleTones(root, scaleId).map((tone) => tone.note);

describe("Scale Explorer", () => {
  it.each([
    ["C", "major", ["C", "D", "E", "F", "G", "A", "B"]],
    ["G", "mixolydian", ["G", "A", "B", "C", "D", "E", "F"]],
    ["A", "natural-minor", ["A", "B", "C", "D", "E", "F", "G"]],
    ["A", "harmonic-minor", ["A", "B", "C", "D", "E", "F", "G#"]],
    ["C", "major-pentatonic", ["C", "D", "E", "G", "A"]],
    ["A", "minor-pentatonic", ["A", "C", "D", "E", "G"]],
    ["A", "blues", ["A", "C", "D", "Eb", "E", "G"]],
  ])("%s %s の構成音を返す", (root, scaleId, expected) => {
    expect(notes(root, scaleId)).toEqual(expected);
  });

  it("G Mixolydian のDegreeを返す", () => {
    expect(getScaleTones("G", "mixolydian").map((tone) => tone.degree)).toEqual(
      ["1", "2", "3", "4", "5", "6", "b7"],
    );
  });

  it("Bb MajorをFlatで表記する", () => {
    expect(notes("Bb", "major")).toEqual(["Bb", "C", "D", "Eb", "F", "G", "A"]);
  });

  it("Standard Tuning上のScale Toneだけをマッピングする", () => {
    const positions = scaleFretboardPositions(
      getScaleTones("G", "mixolydian"),
      0,
      2,
    );
    expect(
      positions.some(
        (position) =>
          position.string === 6 &&
          position.fret === 1 &&
          position.tone.note === "F",
      ),
    ).toBe(true);
    expect(
      positions.some(
        (position) => position.string === 6 && position.fret === 2,
      ),
    ).toBe(false);
  });

  it("G7 + G MixolydianでG B D FをChord Toneとして判定する", () => {
    const chord = makeChord("G", "7");
    const classified = getScaleTones("G", "mixolydian")
      .filter((tone) => chordToneDegree(chord, tone.pitchClass))
      .map((tone) => tone.note);
    expect(classified).toEqual(["G", "B", "D", "F"]);
    expect(
      getScaleTones("G", "mixolydian").map((tone) =>
        chordToneDegree(chord, tone.pitchClass),
      ),
    ).toEqual(["Root", null, "3rd", null, "5th", null, "b7"]);
  });

  it("Scale試聴はルートの1オクターブ上まで並べる", () => {
    expect(scalePreviewNotes("G", "mixolydian")).toEqual([
      67, 69, 71, 72, 74, 76, 77, 79,
    ]);
  });
});

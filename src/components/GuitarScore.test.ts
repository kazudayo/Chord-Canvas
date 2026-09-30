import { describe, expect, it } from "vitest";
import { makeChord } from "../music/chords";
import { staffNotes } from "./GuitarScore";

describe("五線譜の和音配置", () => {
  it("隣接する2度の音符を左右にずらす", () => {
    const notes = staffNotes(makeChord("C", "sus2"), 82, 16);

    expect(notes.map((note) => note.xOffset)).toEqual([0, 16, 0]);
    expect(notes[0].y - notes[1].y).toBe(8);
  });

  it("重ならない3度以上の音符は中央のままにする", () => {
    const notes = staffNotes(makeChord("C", "major"), 82, 16);

    expect(notes.map((note) => note.xOffset)).toEqual([0, 0, 0]);
  });

  it("連続する2度は下の音から左右交互に並べる", () => {
    const chord = {
      ...makeChord("C", "major"),
      notes: ["C", "D", "E"],
    };

    expect(staffNotes(chord, 82, 16).map((note) => note.xOffset)).toEqual([
      0, 16, 0,
    ]);
  });
});

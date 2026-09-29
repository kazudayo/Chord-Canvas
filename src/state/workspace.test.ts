import { describe, expect, it } from "vitest";
import { exportSong, validSong } from "./workspace";
import { diatonic, invert } from "../music/chords";
import type { Song } from "../music/types";
const song: Song = {
  id: "song-1",
  title: "テスト曲",
  bpm: 90,
  beats: 4,
  pattern: "block",
  rhythm: "eightBeat",
  loop: true,
  updatedAt: "2026-09-26",
  sections: [
    {
      id: "a",
      name: "Aメロ",
      key: { tonic: "C", mode: "major" },
      chords: [
        {
          id: "c",
          beats: 4,
          chord: invert(diatonic({ tonic: "C", mode: "major" })[0], 1),
        },
      ],
      melody: [{ id: "m", note: 72, startBeat: 0.5, durationBeats: 1 }],
    },
  ],
};
describe("保存と書き出し", () => {
  it("曲がJSONを往復してもコードと転回形を維持する", () =>
    expect(validSong(JSON.parse(JSON.stringify(song)))).toBe(true));
  it("壊れたデータと範囲外のテンポを拒否する", () => {
    expect(validSong(null)).toBe(false);
    expect(validSong({ ...song, bpm: 0 })).toBe(false);
    expect(validSong({ ...song, sections: [] })).toBe(false);
    expect(validSong({ ...song, rhythm: "shuffle" })).toBe(false);
    expect(
      validSong({
        ...song,
        sections: [
          {
            ...song.sections[0],
            chords: [{ ...song.sections[0].chords[0], beats: 5 }],
          },
        ],
      }),
    ).toBe(false);
    expect(
      validSong({
        ...song,
        sections: [
          {
            ...song.sections[0],
            chords: [{ ...song.sections[0].chords[0], octave: 4 }],
          },
        ],
      }),
    ).toBe(false);
    expect(
      validSong({
        ...song,
        sections: [
          {
            ...song.sections[0],
            melody: [{ id: "bad", note: 128, startBeat: 0, durationBeats: 1 }],
          },
        ],
      }),
    ).toBe(false);
  });
  it("コード名の書き出しはキーとセクションを含む", () => {
    const result = exportSong(song);
    expect(result).toContain("Key: C Major");
    expect(result).toContain("[Aメロ]");
    expect(result).toContain("C/E");
    expect(result).toContain("[4拍]");
  });
  it("Degree表記の転回形は和音の構成音の度数を使う", () =>
    expect(exportSong(song, true)).toContain("I/3"));
  it("コードのオクターブを保存・テキスト書き出しできる", () => {
    const octaveSong = {
      ...song,
      sections: [
        {
          ...song.sections[0],
          chords: [{ ...song.sections[0].chords[0], octave: 2 }],
        },
      ],
    };
    expect(validSong(octaveSong)).toBe(true);
    expect(exportSong(octaveSong)).toContain("Oct +2");
  });
});

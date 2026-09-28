import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./engine";
import { makeChord } from "../music/chords";
const starts = vi.fn();
const drumStarts = vi.fn();
describe("再生タイムライン", () => {
  const chords = [makeChord("C", "major"), makeChord("G", "7")];
  let engine: AudioEngine;
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
    starts.mockClear();
    drumStarts.mockClear();
    engine = new AudioEngine(
      {
        ready: async () => {},
        noteOn: starts,
        noteOff: vi.fn(),
        percussionOn: drumStarts,
        percussionOff: vi.fn(),
        allNotesOff: vi.fn(),
        setVolume: vi.fn(),
        dispose: vi.fn(),
      },
      () => Date.now() / 1000,
    );
  });
  afterEach(() => {
    engine.dispose();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
  it("順に再生してループなしなら終了する", async () => {
    const report = vi.fn();
    await engine.play(chords, 60, 1, "block", false, report);
    expect(report).toHaveBeenLastCalledWith(0, "playing");
    await vi.advanceTimersByTimeAsync(1100);
    expect(report).toHaveBeenLastCalledWith(1, "playing");
    await vi.advanceTimersByTimeAsync(1000);
    expect(report).toHaveBeenLastCalledWith(-1, "stopped");
  });
  it("一時停止した拍位置から再開する", async () => {
    const report = vi.fn();
    await engine.play(chords, 60, 1, "block", false, report);
    await vi.advanceTimersByTimeAsync(400);
    engine.pause();
    expect(report).toHaveBeenLastCalledWith(0, "paused");
    await vi.advanceTimersByTimeAsync(3000);
    await engine.play(chords, 60, 1, "block", false, report);
    await vi.advanceTimersByTimeAsync(650);
    expect(report).toHaveBeenLastCalledWith(1, "playing");
  });
  it("コードごとの拍数で再生位置を通知する", async () => {
    const report = vi.fn();
    await engine.play(chords, 60, 4, "block", false, report, [1, 3]);
    expect(report).toHaveBeenLastCalledWith(0, "playing");
    await vi.advanceTimersByTimeAsync(1100);
    expect(report).toHaveBeenLastCalledWith(1, "playing");
    await vi.advanceTimersByTimeAsync(3000);
    expect(report).toHaveBeenLastCalledWith(-1, "stopped");
  });
  it("ループし、停止すると次は先頭から再生する", async () => {
    const report = vi.fn();
    await engine.play(chords, 60, 1, "arpeggio", true, report);
    await vi.advanceTimersByTimeAsync(2200);
    expect(report).toHaveBeenLastCalledWith(0, "playing");
    engine.stop();
    await engine.play(chords, 60, 1, "block", true, report);
    expect(report).toHaveBeenLastCalledWith(0, "playing");
  });
  it("バックグラウンド復帰時に過去のコードを重複再生しない", async () => {
    const report = vi.fn();
    await engine.play(chords, 60, 1, "block", true, report);
    starts.mockClear();
    vi.setSystemTime(Date.now() + 60000);
    await vi.advanceTimersByTimeAsync(25);
    expect(starts.mock.calls.length).toBeLessThanOrEqual(10);
  });
  it("ドラムイベントはピアノではなく打楽器出力へ送る", async () => {
    const report = vi.fn();
    await engine.playSequence(
      {
        events: [
          {
            note: 36,
            startBeat: 0,
            durationBeat: 0.1,
            velocity: 100,
            chordIndex: 0,
            track: "drum",
          },
        ],
        durationBeats: 1,
        beatsPerChord: 1,
        chordStartBeats: [0],
        chordCount: 1,
        markers: [],
      },
      120,
      false,
      report,
    );
    expect(drumStarts).toHaveBeenCalledWith(36, 100, expect.any(Number));
    expect(starts).not.toHaveBeenCalled();
  });
});

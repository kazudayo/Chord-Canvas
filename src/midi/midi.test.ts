import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createPlaybackEvents,
  createSongPlaybackEvents,
} from "../audio/events";
import { invert, makeChord } from "../music/chords";
import { exportMidi, variableLength, MIDI_PPQ } from "./export";
import { MidiNoteOutput } from "./MidiOutput";
import { MidiDevices } from "./devices";
import { normalizeSound } from "../state/sound";
import { nearestSample, PIANO_ZONES } from "../audio/sampleLoader";
const chords = [makeChord("C", "major"), invert(makeChord("G", "7"), 1)];
function parse(bytes: Uint8Array) {
  let pos = 22,
    tick = 0;
  const events: {
    tick: number;
    status: number;
    type?: number;
    data: number[];
  }[] = [];
  function vlq() {
    let value = 0,
      b: number;
    do {
      b = bytes[pos++];
      value = (value << 7) | (b & 127);
    } while (b & 128);
    return value;
  }
  while (pos < bytes.length) {
    tick += vlq();
    const status = bytes[pos++];
    if (status === 255) {
      const type = bytes[pos++],
        length = vlq();
      events.push({
        tick,
        status,
        type,
        data: [...bytes.slice(pos, pos + length)],
      });
      pos += length;
    } else {
      events.push({ tick, status, data: [...bytes.slice(pos, pos + 2)] });
      pos += 2;
    }
  }
  return events;
}
describe("共通NoteEvent", () => {
  it("C/Eの配置と最低音はE", () => {
    const seq = createPlaybackEvents([invert(chords[0], 1)], {
      beats: 4,
      pattern: "block",
    });
    expect(seq.events.map((e) => e.note)).toEqual([64, 67, 72, 52]);
  });
  it("転回形・ベース・強さ・拍数を共有", () => {
    const s = createPlaybackEvents(chords, {
      beats: 4,
      pattern: "block",
      velocity: 97,
    });
    expect(s.durationBeats).toBe(8);
    expect(
      s.events.filter((e) => e.chordIndex === 0).map((e) => e.note),
    ).toEqual([60, 64, 67, 48]);
    expect(s.events.filter((e) => e.chordIndex === 1).at(-1)!.note % 12).toBe(
      11,
    );
    expect(s.events[0].velocity).toBe(97);
    expect(s.events.every((e) => e.durationBeat === 4)).toBe(true);
  });
  it("アルペジオは発音をずらしコード終端で離鍵する", () => {
    const s = createPlaybackEvents([chords[0]], {
      beats: 3,
      pattern: "arpeggio",
    });
    expect(s.events.slice(0, 3).map((e) => e.startBeat)).toEqual([0, 1, 2]);
    expect(s.events.every((e) => e.startBeat + e.durationBeat === 3)).toBe(
      true,
    );
  });
  it("空の進行でも正常", () => {
    expect(
      createPlaybackEvents([], { beats: 4, pattern: "block" }).events,
    ).toEqual([]);
  });
  it("サンプル21個と最寄り音高を選択", () => {
    expect(PIANO_ZONES).toHaveLength(21);
    expect(PIANO_ZONES[8]).toEqual({
      midi: 60,
      url: "/assets/audio/piano/C4.mp3",
    });
    expect(
      nearestSample(
        61,
        PIANO_ZONES.map((z) => z.midi),
      ),
    ).toBe(60);
  });
});
describe("標準MIDIファイル", () => {
  it("SMF0、480 PPQ、テンポ・拍子・全ノート・停止イベントを書き出す", () => {
    const sequence = createPlaybackEvents(chords, {
        beats: 4,
        pattern: "block",
        velocity: 95,
      }),
      bytes = exportMidi(sequence, 120, 16),
      events = parse(bytes);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe("MThd");
    expect([...bytes.slice(8, 14)]).toEqual([0, 0, 0, 1, 1, 224]);
    expect(events.find((e) => e.type === 81)?.data).toEqual([7, 161, 32]);
    expect(events.find((e) => e.type === 88)?.data).toEqual([4, 2, 24, 8]);
    expect(
      events
        .filter((e) => e.status === 159)
        .map((e) => ({ note: e.data[0], velocity: e.data[1], tick: e.tick })),
    ).toEqual(
      sequence.events.map((e) => ({
        note: e.note,
        velocity: e.velocity,
        tick: Math.round(e.startBeat * MIDI_PPQ),
      })),
    );
    expect(events.filter((e) => e.status === 143)).toHaveLength(
      sequence.events.length,
    );
    expect(events.at(-1)).toMatchObject({ type: 47, tick: 3840 });
    const boundary = events.filter((e) => e.tick === 1920 && e.status !== 255);
    expect(boundary.slice(0, 4).every((e) => e.status === 143)).toBe(true);
  });
  it("アルペジオのタイミングとセクションマーカーを保持する", () => {
    const sections = ["Aメロ", "サビ"].map((name, i) => ({
      id: String(i),
      name,
      key: { tonic: "C", mode: "major" as const },
      chords: [{ id: String(i), chord: chords[i] }],
    }));
    const seq = createSongPlaybackEvents(sections, {
        beats: 4,
        pattern: "arpeggio",
      }),
      events = parse(exportMidi(seq, 90));
    expect(
      events
        .filter((e) => e.type === 6)
        .map((e) => ({
          name: new TextDecoder().decode(new Uint8Array(e.data)),
          tick: e.tick,
        })),
    ).toEqual([
      { name: "Aメロ", tick: 0 },
      { name: "サビ", tick: 1920 },
    ]);
    expect(events.filter((e) => e.status === 144).map((e) => e.tick)).toEqual(
      seq.events
        .map((e) => Math.round(e.startBeat * 480))
        .sort((a, b) => a - b),
    );
  });
  it("可変長整数は標準形式", () => {
    expect(variableLength(0)).toEqual([0]);
    expect(variableLength(127)).toEqual([127]);
    expect(variableLength(128)).toEqual([129, 0]);
    expect(variableLength(16383)).toEqual([255, 127]);
  });
});
describe("MIDI出力と安全停止", () => {
  afterEach(() => vi.unstubAllGlobals());
  function port() {
    return {
      id: "test",
      name: "Test",
      state: "connected",
      send: vi.fn(),
      clear: vi.fn(),
      open: vi.fn(async () => {}),
    };
  }
  it("チャンネル16のNote On/Offをタイムスタンプ付きで送る", async () => {
    const p = port(),
      out = new MidiNoteOutput(p, 16);
    await out.ready();
    out.noteOn(60, 100, 2);
    out.noteOff(60, 3);
    expect(p.send).toHaveBeenCalledWith([159, 60, 100], 2000);
    expect(p.send).toHaveBeenCalledWith([143, 60, 0], 3000);
  });
  it("Panicはキューを取消、Note Off / CC123 / CC120を送る", () => {
    const p = port(),
      out = new MidiNoteOutput(p, 2);
    out.noteOn(60, 90, 1);
    out.allNotesOff();
    expect(p.clear).toHaveBeenCalled();
    expect(p.send).toHaveBeenCalledWith([129, 60, 0]);
    expect(p.send).toHaveBeenCalledWith([177, 123, 0]);
    expect(p.send).toHaveBeenCalledWith([177, 120, 0]);
  });
  it("音量はCC7で変更し、Velocity値を変えない", () => {
    const p = port(),
      out = new MidiNoteOutput(p);
    out.setVolume(0);
    out.noteOn(60, 90, 1);
    expect(p.send).toHaveBeenCalledWith([176, 7, 0]);
    expect(p.send).toHaveBeenCalledWith([144, 60, 90], 1000);
  });
  it("切断時のPanicで例外を出さず、再生はエラーを返す", async () => {
    const p = port();
    p.state = "disconnected";
    p.send.mockImplementation(() => {
      throw new Error("disconnected");
    });
    const out = new MidiNoteOutput(p);
    expect(() => out.allNotesOff()).not.toThrow();
    await expect(out.ready()).rejects.toThrow("切断");
  });
  it("デバイス作成だけでは権限を求めず、明示request後に列挙する", async () => {
    const output = port(),
      access = {
        outputs: new Map([["test", output]]),
        onstatechange: null as null | (() => void),
      },
      request = vi.fn(async () => access);
    vi.stubGlobal("navigator", { requestMIDIAccess: request });
    const devices = new MidiDevices(),
      changed = vi.fn();
    expect(request).not.toHaveBeenCalled();
    await devices.request(changed);
    expect(request).toHaveBeenCalledWith({ sysex: false });
    expect(changed).toHaveBeenCalledWith([output]);
    output.state = "disconnected";
    access.onstatechange?.();
    expect(changed).toHaveBeenLastCalledWith([]);
    await devices.request(changed);
    expect(request).toHaveBeenCalledTimes(1);
    devices.dispose();
    expect(access.onstatechange).toBeNull();
  });
  it("権限拒否・未対応環境を明示する", async () => {
    vi.stubGlobal("navigator", {});
    await expect(new MidiDevices().request(() => {})).rejects.toThrow(
      "利用できません",
    );
    vi.stubGlobal("navigator", {
      requestMIDIAccess: vi.fn(async () => {
        throw new Error("Permission denied");
      }),
    });
    await expect(new MidiDevices().request(() => {})).rejects.toThrow(
      "Permission denied",
    );
  });
  it("保存済み設定を復元・正規化する", () => {
    expect(
      normalizeSound({
        soundSource: "midi",
        selectedMidiOutputId: "abc",
        midiChannel: 16,
        velocity: 100,
      }),
    ).toEqual({
      soundSource: "midi",
      selectedMidiOutputId: "abc",
      midiChannel: 16,
      velocity: 100,
    });
    expect(normalizeSound({ midiChannel: 99, velocity: -5 })).toMatchObject({
      midiChannel: 16,
      velocity: 1,
      soundSource: "piano",
    });
  });
});

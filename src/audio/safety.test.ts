import { afterEach, describe, expect, it, vi } from "vitest";
import { AudioEngine } from "./engine";
import { PianoSampler } from "./PianoSampler";
import { makeChord } from "../music/chords";
const output = () => ({
  ready: vi.fn(async () => {}),
  noteOn: vi.fn(),
  noteOff: vi.fn(),
  allNotesOff: vi.fn(),
  setVolume: vi.fn(),
  dispose: vi.fn(),
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
describe("再生中断の安全性", () => {
  it("サンプル読み込み中のStopで後から発音しない", async () => {
    const out = output();
    let complete!: () => void;
    out.ready.mockImplementation(
      () =>
        new Promise((resolve) => {
          complete = resolve;
        }),
    );
    const engine = new AudioEngine(out),
      pending = engine.play(
        [makeChord("C", "major")],
        90,
        4,
        "block",
        false,
        () => {},
      );
    engine.stop();
    complete();
    await pending;
    expect(out.noteOn).not.toHaveBeenCalled();
    expect(out.allNotesOff).toHaveBeenCalled();
    engine.dispose();
  });
  it("出力切替で旧ポートにPanic、以降は新ポートへ送信", async () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
    const before = output(),
      after = output(),
      engine = new AudioEngine(before);
    await engine.previewNote();
    engine.setOutput(after);
    expect(before.allNotesOff).toHaveBeenCalled();
    await engine.previewNote();
    expect(after.noteOn).toHaveBeenCalledWith(60, 85, expect.any(Number));
    engine.dispose();
    expect(after.allNotesOff).toHaveBeenCalled();
  });
  it("共有NoteEventの長さに従って離鍵する", async () => {
    vi.useFakeTimers({
      toFake: [
        "setTimeout",
        "clearTimeout",
        "setInterval",
        "clearInterval",
        "Date",
      ],
    });
    let now = 0;
    const out = output(),
      engine = new AudioEngine(out, () => now);
    await engine.play(
      [makeChord("C", "major")],
      120,
      4,
      "block",
      false,
      () => {},
    );
    expect(out.noteOn).toHaveBeenCalledWith(60, 85, 0);
    now = 1.94;
    await vi.advanceTimersByTimeAsync(25);
    expect(out.noteOff).toHaveBeenCalledWith(60, 2);
    engine.dispose();
  });
});
describe("実録音サンプラー", () => {
  const param = () => ({
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    setTargetAtTime: vi.fn(),
    cancelAndHoldAtTime: vi.fn(),
  });
  const gainNode = () => ({
    gain: param(),
    connect: vi.fn(),
    disconnect: vi.fn(),
  });
  const bufferSource = () => ({
    buffer: null,
    playbackRate: { value: 1 },
    connect: vi.fn(),
    disconnect: vi.fn(),
    start: vi.fn(),
    stop: vi.fn(),
    onended: null,
  });
  class Context {
    currentTime = 0;
    state = "running";
    destination = {};
    sources: ReturnType<typeof bufferSource>[] = [];
    gains: ReturnType<typeof gainNode>[] = [];
    resume = vi.fn(async () => {});
    close = vi.fn(async () => {
      this.state = "closed";
    });
    decodeAudioData = vi.fn(async () => ({ length: 100 }));
    createGain() {
      const node = gainNode();
      this.gains.push(node);
      return node;
    }
    createDynamicsCompressor() {
      return { threshold: param(), ratio: param(), connect: vi.fn() };
    }
    createBufferSource() {
      const source = bufferSource();
      this.sources.push(source);
      return source;
    }
  }
  function setup() {
    const context = new Context();
    vi.stubGlobal(
      "AudioContext",
      class {
        constructor() {
          return context;
        }
      },
    );
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1),
      })),
    );
    return context;
  }
  it("21録音を一度だけデコードしてキャッシュし、近い音からピッチシフトする", async () => {
    const context = setup(),
      piano = new PianoSampler();
    await piano.ready();
    await piano.ready();
    expect(context.decodeAudioData).toHaveBeenCalledTimes(21);
    piano.noteOn(61, 100, 0);
    expect(context.sources[0].buffer).toEqual({ length: 100 });
    expect(context.sources[0].playbackRate.value).toBeCloseTo(2 ** (1 / 12));
    expect(context.gains[1].gain.linearRampToValueAtTime).toHaveBeenCalled();
    piano.dispose();
  });
  it("Velocityを音量へ反映し、同音の再打鍵を個別にリリースする", async () => {
    const context = setup(),
      piano = new PianoSampler();
    await piano.ready();
    piano.noteOn(60, 40, 0);
    piano.noteOn(60, 100, 1);
    piano.noteOff(60, 1);
    expect(context.sources[0].stop).toHaveBeenCalled();
    expect(context.sources[1].stop).not.toHaveBeenCalled();
    expect(
      context.gains[1].gain.linearRampToValueAtTime.mock.calls[0][0],
    ).toBeLessThan(
      context.gains[2].gain.linearRampToValueAtTime.mock.calls[0][0],
    );
    piano.allNotesOff();
    expect(context.sources[1].stop).toHaveBeenCalled();
    piano.dispose();
    piano.dispose();
    expect(context.close).toHaveBeenCalledTimes(1);
  });
  it("サンプル取得失敗を通知し、再試行できる", async () => {
    setup();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false })),
    );
    const piano = new PianoSampler();
    await expect(piano.ready()).rejects.toThrow("読み込めません");
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        arrayBuffer: async () => new ArrayBuffer(1),
      })),
    );
    await expect(piano.ready()).resolves.toBeUndefined();
    piano.dispose();
  });
});

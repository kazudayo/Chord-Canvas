import { useEffect, useRef, useState } from "react";
import type { AudioSettings } from "../music/types";
import { AudioEngine } from "../audio/engine";
import { PianoSampler } from "../audio/PianoSampler";
import { PercussionSynth } from "../audio/PercussionSynth";
import { MidiDevices } from "../midi/devices";
import { MidiNoteOutput } from "../midi/MidiOutput";
const KEY = "harmotrail.sound.v1";
const LEGACY_KEY = "chord-canvas.sound.v1";
export const DEFAULT_SOUND: AudioSettings = {
  soundSource: "piano",
  selectedMidiOutputId: "",
  midiChannel: 1,
  velocity: 85,
};
export function normalizeSound(
  value: Partial<AudioSettings> | undefined,
): AudioSettings {
  return {
    soundSource: value?.soundSource === "midi" ? "midi" : "piano",
    selectedMidiOutputId:
      typeof value?.selectedMidiOutputId === "string"
        ? value.selectedMidiOutputId
        : "",
    midiChannel: Math.max(
      1,
      Math.min(16, Math.round(Number(value?.midiChannel) || 1)),
    ),
    velocity: Math.max(
      1,
      Math.min(127, Math.round(Number(value?.velocity) || 85)),
    ),
  };
}
function load() {
  try {
    return normalizeSound(
      JSON.parse(
        localStorage.getItem(KEY) ?? localStorage.getItem(LEGACY_KEY) ?? "null",
      ),
    );
  } catch {
    return DEFAULT_SOUND;
  }
}
export function useSoundEngine() {
  const [settings, setSettings] = useState<AudioSettings>(load);
  const [ports, setPorts] = useState<MIDIOutput[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [midiEnabled, setMidiEnabled] = useState(false);
  const engineRef = useRef<AudioEngine | null>(null),
    pianoRef = useRef<PianoSampler | null>(null),
    percussionRef = useRef<PercussionSynth | null>(null),
    devicesRef = useRef<MidiDevices | null>(null);
  const outputKey = useRef("");
  const settingsRef = useRef(settings);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  const selectedPort = ports.find(
    (p) => p.id === settings.selectedMidiOutputId,
  );
  const effectiveSource =
    settings.soundSource === "midi" && selectedPort ? "midi" : "piano";
  function engine() {
    if (!pianoRef.current) pianoRef.current = new PianoSampler();
    if (!percussionRef.current) percussionRef.current = new PercussionSynth();
    if (!engineRef.current) {
      engineRef.current = new AudioEngine(pianoRef.current);
      engineRef.current.setPercussionOutput(percussionRef.current);
    }
    const key =
      effectiveSource === "midi"
        ? `${selectedPort!.id}:${settings.midiChannel}`
        : "piano";
    if (outputKey.current !== key) {
      engineRef.current.setOutput(
        effectiveSource === "midi"
          ? new MidiNoteOutput(selectedPort!, settings.midiChannel)
          : pianoRef.current,
      );
      outputKey.current = key;
    }
    engineRef.current.setVelocity(settings.velocity);
    return engineRef.current;
  }
  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(settings));
    } catch {
      setMessage("音源設定を保存できませんでした。");
    }
  }, [settings]);
  useEffect(() => {
    engineRef.current?.stop();
  }, [
    settings.soundSource,
    settings.selectedMidiOutputId,
    settings.midiChannel,
  ]);
  useEffect(() => {
    const stop = () => engineRef.current?.stop();
    window.addEventListener("pagehide", stop);
    window.addEventListener("beforeunload", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      window.removeEventListener("beforeunload", stop);
      engineRef.current?.dispose();
      pianoRef.current?.dispose();
      percussionRef.current?.dispose();
      devicesRef.current?.dispose();
      engineRef.current = null;
      pianoRef.current = null;
      percussionRef.current = null;
      devicesRef.current = null;
      outputKey.current = "";
    };
  }, []);
  async function enableMidi() {
    setBusy(true);
    if (!devicesRef.current) devicesRef.current = new MidiDevices();
    try {
      await devicesRef.current.request((next) => {
        setPorts(next);
        const current = settingsRef.current;
        if (
          current.soundSource === "midi" &&
          !next.some((p) => p.id === current.selectedMidiOutputId)
        ) {
          engineRef.current?.stop();
          setSettings({ ...current, soundSource: "piano" });
          setMessage(
            "MIDI出力が見つからないため、Internal Pianoへ切り替えました。",
          );
        } else if (!next.length)
          setMessage("MIDI Outputがありません。Internal Pianoを利用できます。");
        else setMessage(`${next.length}台のMIDI Outputを利用できます。`);
      });
      setMidiEnabled(true);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "MIDIへのアクセスが許可されませんでした。",
      );
    } finally {
      setBusy(false);
    }
  }
  const supported =
    typeof navigator !== "undefined" &&
    typeof navigator.requestMIDIAccess === "function";
  return {
    engine,
    settings,
    setSettings,
    ports,
    effectiveSource,
    message,
    busy,
    midiEnabled,
    enableMidi,
    supported,
    stop: () => engineRef.current?.stop(),
  };
}

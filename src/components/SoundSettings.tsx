import { Play, RefreshCw, OctagonX } from "lucide-react";
import type { useSoundEngine } from "../state/sound";
import { pianoAssetUrl } from "../audio/sampleLoader";
export function SoundSettings({
  sound,
  testNote,
  panic,
}: {
  sound: ReturnType<typeof useSoundEngine>;
  testNote: () => void;
  panic: () => void;
}) {
  const { settings, setSettings } = sound;
  return (
    <div className="sound-settings">
      <p className="muted">
        内蔵ピアノ、またはDAW・外部機器へ接続したMIDI出力を選べます。
      </p>
      <label className="field-label">
        Sound Source
        <select
          aria-label="Sound Source"
          value={
            sound.effectiveSource === "midi"
              ? settings.selectedMidiOutputId
              : "piano"
          }
          onChange={(e) =>
            setSettings({
              ...settings,
              soundSource: e.target.value === "piano" ? "piano" : "midi",
              selectedMidiOutputId:
                e.target.value === "piano"
                  ? settings.selectedMidiOutputId
                  : e.target.value,
            })
          }
        >
          <option value="piano">Internal Piano</option>
          {sound.ports.map((p) => (
            <option key={p.id} value={p.id}>
              MIDI: {p.name || p.id}
            </option>
          ))}
        </select>
      </label>
      {sound.effectiveSource === "piano" && (
        <div className="sample-credit">
          <strong>Salamander Grand Piano</strong>
          <p>
            Yamaha C5の録音を使用。初回再生時にローカルサンプルを読み込みます。
          </p>
          <a
            href={pianoAssetUrl("ATTRIBUTION.md")}
            target="_blank"
            rel="noreferrer"
          >
            Alexander Holm · CC BY 3.0 / 音源クレジット
          </a>
        </div>
      )}
      <div className="sound-options">
        <label className="field-label">
          MIDI Channel
          <select
            aria-label="MIDI Channel"
            value={settings.midiChannel}
            onChange={(e) =>
              setSettings({ ...settings, midiChannel: Number(e.target.value) })
            }
          >
            {Array.from({ length: 16 }, (_, i) => (
              <option value={i + 1} key={i}>
                {i + 1}
              </option>
            ))}
          </select>
        </label>
        <label className="field-label">
          Velocity · {settings.velocity}
          <input
            aria-label="Velocity"
            type="range"
            min={1}
            max={127}
            value={settings.velocity}
            onChange={(e) =>
              setSettings({ ...settings, velocity: Number(e.target.value) })
            }
          />
        </label>
      </div>
      <div className="sound-actions">
        <button className="outline-button" onClick={testNote}>
          <Play size={14} />
          Test Note
        </button>
        <button
          className="outline-button"
          disabled={!sound.supported || sound.busy}
          onClick={() => void sound.enableMidi()}
        >
          <RefreshCw size={14} />
          {sound.busy
            ? "接続中…"
            : sound.midiEnabled
              ? "Refresh MIDI Devices"
              : "MIDIを使用"}
        </button>
        <button className="outline-button danger" onClick={panic}>
          <OctagonX size={15} />
          Panic / All Notes Off
        </button>
      </div>
      <p role="status" className="micro-copy">
        {!sound.supported
          ? "このブラウザでは外部MIDI出力を利用できません。Internal PianoとMIDI書き出しは利用できます。"
          : sound.message ||
            "MIDIを使用するときだけ、ブラウザにアクセス許可を求めます。再起動後はアクセスを有効にするまでInternal Pianoで再生します。"}
      </p>
      <p className="micro-copy">
        MIDIは音声ではなく演奏情報です。受信側のソフト音源でポートとチャンネルを設定してください。VST
        / AUを直接読み込む機能はありません。
      </p>
    </div>
  );
}

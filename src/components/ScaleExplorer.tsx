import { KeyRound, Play } from "lucide-react";
import { useMemo } from "react";
import { averageFret, midiAt } from "../guitar/fretboard";
import { STRING_LABELS, TAB_STRINGS } from "../guitar/tuning";
import type { GuitarStringNumber, GuitarVoicing } from "../guitar/types";
import { chordName } from "../music/chords";
import { chromaticName, mod, pitch, pretty } from "../music/notes";
import {
  chordToneDegree,
  getScaleDefinition,
  getScaleTones,
  SCALE_DEFINITIONS,
  SCALE_ROOTS,
  scaleIdForKey,
  scalePreviewNotes,
  type ScaleExplorerState,
  type ScalePosition,
} from "../music/scales";
import type { Chord, Key } from "../music/types";

const POSITION_OPTIONS: { value: ScalePosition; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "0-5", label: "Open – 5" },
  { value: "3-8", label: "3 – 8" },
  { value: "5-10", label: "5 – 10" },
  { value: "7-12", label: "7 – 12" },
  { value: "10-15", label: "10 – 15" },
  { value: "all", label: "All" },
];

export function scalePositionRange(
  position: ScalePosition,
  voicing?: GuitarVoicing,
): [number, number] {
  if (position === "all") return [0, 15];
  if (position !== "auto") {
    const [start, end] = position.split("-").map(Number);
    return [start, end];
  }
  if (!voicing) return [0, 5];
  const center = averageFret(voicing.positions);
  if (center <= 2) return [0, 5];
  const start = Math.max(0, Math.min(9, Math.round(center) - 2));
  return [start, start + 6];
}

function voicingAt(
  voicing: GuitarVoicing | undefined,
  string: GuitarStringNumber,
  fret: number,
) {
  return voicing?.positions.some(
    (position) => position.string === string && position.fret === fret,
  );
}

export function ScaleExplorer({
  state,
  musicKey,
  chord,
  voicing,
  onChange,
  onPreviewNote,
  onPreviewScale,
}: {
  state: ScaleExplorerState;
  musicKey: Key;
  chord?: Chord;
  voicing?: GuitarVoicing;
  onChange: (state: ScaleExplorerState) => void;
  onPreviewNote: (note: number) => void;
  onPreviewScale: (notes: number[]) => void;
}) {
  const definition = getScaleDefinition(state.scaleId);
  const tones = useMemo(
    () => getScaleTones(state.root, state.scaleId),
    [state.root, state.scaleId],
  );
  const toneByPitch = useMemo(
    () => new Map(tones.map((tone) => [tone.pitchClass, tone])),
    [tones],
  );
  const [startFret, endFret] = scalePositionRange(state.position, voicing);
  const frets = Array.from(
    { length: endFret - startFret + 1 },
    (_, index) => startFret + index,
  );
  const rootPitch = pitch(state.root);
  const useSongKey = () =>
    onChange({
      ...state,
      root: musicKey.tonic,
      scaleId: scaleIdForKey(musicKey),
    });

  return (
    <section className="scale-explorer" aria-label="Scale Explorer">
      <div className="scale-explorer-heading">
        <div>
          <span className="eyebrow">SCALE EXPLORER</span>
          <h3>
            {pretty(state.root)} {definition.name}
          </h3>
          <p>指定したスケールの構成音を、コードフォーム周辺で確認できます。</p>
        </div>
        <button className="outline-button" onClick={useSongKey}>
          <KeyRound size={14} /> Use Song Key
        </button>
      </div>

      <div className="scale-controls">
        <label>
          <span>ROOT</span>
          <select
            value={state.root}
            onChange={(event) =>
              onChange({ ...state, root: event.target.value })
            }
          >
            {SCALE_ROOTS.map((root) => (
              <option key={root} value={root}>
                {pretty(root)}
              </option>
            ))}
          </select>
        </label>
        <label className="scale-type-control">
          <span>SCALE</span>
          <select
            value={state.scaleId}
            onChange={(event) =>
              onChange({ ...state, scaleId: event.target.value })
            }
          >
            {SCALE_DEFINITIONS.map((scale) => (
              <option key={scale.id} value={scale.id}>
                {scale.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>POSITION</span>
          <select
            value={state.position}
            onChange={(event) =>
              onChange({
                ...state,
                position: event.target.value as ScalePosition,
              })
            }
          >
            {POSITION_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button
          className="outline-button scale-play"
          onClick={() =>
            onPreviewScale(scalePreviewNotes(state.root, state.scaleId))
          }
        >
          <Play size={14} /> Play Scale
        </button>
      </div>

      <div className="scale-tone-list" aria-label="スケール構成音">
        {tones.map((tone) => {
          const chordDegree = chord
            ? chordToneDegree(chord, tone.pitchClass)
            : null;
          const root = tone.pitchClass === rootPitch;
          return (
            <button
              key={`${tone.degree}-${tone.note}`}
              className={`${root ? "root" : ""} ${chordDegree ? "chord-tone" : ""}`}
              onClick={() => onPreviewNote(60 + rootPitch + tone.interval)}
            >
              <small>{tone.degree}</small>
              <strong>{pretty(tone.note)}</strong>
              {chordDegree && <span>{chordDegree}</span>}
            </button>
          );
        })}
      </div>

      <div className="scale-view-toolbar">
        <div className="segmented" role="group" aria-label="表示内容">
          {(
            [
              ["chord", "Chord"],
              ["scale", "Scale"],
              ["chord-scale", "Chord + Scale"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={state.display === value ? "active" : ""}
              aria-pressed={state.display === value}
              onClick={() => onChange({ ...state, display: value })}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="フレット上の表示">
          {(
            [
              ["note", "Note"],
              ["degree", "Degree"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              className={state.label === value ? "active" : ""}
              aria-pressed={state.label === value}
              onClick={() => onChange({ ...state, label: value })}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="scale-fretboard-shell">
        <div className="scale-string-labels" aria-hidden="true">
          <span>FRET</span>
          {TAB_STRINGS.map((string) => (
            <strong key={string}>{STRING_LABELS[string]}</strong>
          ))}
        </div>
        <div className="scale-fretboard-scroll">
          <div
            className="scale-fretboard"
            style={{
              gridTemplateColumns: `repeat(${frets.length}, 58px)`,
            }}
          >
            {frets.map((fret) => (
              <span className="scale-fret-number" key={`fret-${fret}`}>
                {fret}
              </span>
            ))}
            {TAB_STRINGS.flatMap((string) =>
              frets.map((fret) => {
                const midiNote = midiAt(string, fret);
                const pitchClass = mod(midiNote);
                const tone = toneByPitch.get(pitchClass);
                const isVoicing = voicingAt(voicing, string, fret);
                const chordDegree = chord
                  ? chordToneDegree(chord, pitchClass)
                  : null;
                const show =
                  state.display === "chord" ? isVoicing : Boolean(tone);
                const label =
                  state.label === "degree"
                    ? state.display === "chord"
                      ? (chordDegree ?? "")
                      : (tone?.degree ?? "")
                    : pretty(
                        tone?.note ??
                          chord?.notes.find(
                            (note) => pitch(note) === pitchClass,
                          ) ??
                          chromaticName(pitchClass, state.root.includes("b")),
                      );
                return (
                  <span
                    className={`scale-fret-cell ${fret === 0 ? "open" : ""}`}
                    key={`${string}-${fret}`}
                  >
                    {show && (
                      <button
                        aria-label={`${STRING_LABELS[string]}弦 ${fret}フレット ${label}`}
                        className={`scale-fret-tone ${pitchClass === rootPitch ? "root" : ""} ${state.display !== "scale" && chordDegree ? "chord-tone" : ""} ${isVoicing ? "voicing-tone" : ""}`}
                        title={
                          chordDegree
                            ? `${pretty(label)} · Chord ${chordDegree}`
                            : pretty(label)
                        }
                        onClick={() => onPreviewNote(midiNote)}
                      >
                        {label}
                      </button>
                    )}
                  </span>
                );
              }),
            )}
          </div>
        </div>
      </div>

      <div className="scale-legend">
        <span className="root">Root</span>
        {chord && state.display !== "scale" && (
          <span className="chord-tone">
            Chord Tone · {pretty(chordName(chord))}
          </span>
        )}
        <span>Scale Tone</span>
        {voicing && <span className="voicing-tone">Current Voicing</span>}
      </div>
      <p className="scale-note">
        ここでは指定したスケールの構成音を表示しています。スケール外の音も、表現に応じて音楽的に使用できます。
      </p>
    </section>
  );
}

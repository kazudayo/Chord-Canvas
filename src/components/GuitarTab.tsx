import { ChevronLeft, ChevronRight, Guitar, Play, Route } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { chordName } from "../music/chords";
import { pretty } from "../music/notes";
import type { ChordEntry } from "../music/types";
import {
  defaultVoicing,
  optimizeProgressionVoicings,
} from "../guitar/progressionVoicing";
import {
  generateGuitarVoicings,
  voicingMatchesChord,
} from "../guitar/voicingGenerator";
import type {
  GuitarPositionPreference,
  GuitarVoicing,
  GuitarVoicingStyle,
} from "../guitar/types";
import { GuitarChordDiagram } from "./GuitarChordDiagram";
import { GuitarScore } from "./GuitarScore";

const STYLE_LABELS: Record<GuitarVoicingStyle, string> = {
  easy: "Easy",
  standard: "Standard",
  jazz: "Jazz",
};

const FAMILY_LABELS: Record<GuitarVoicing["family"], string> = {
  open: "Open Position",
  barre: "Barre",
  root6: "Root 6",
  root5: "Root 5",
  jazz: "Jazz Compact",
  shell: "Shell Voicing",
  drop2: "Drop 2",
  generated: "Generated",
};

export function GuitarTab({
  entries,
  defaultBeats,
  selectedId,
  playingId,
  onSelect,
  onUseVoicing,
  onUseVoicings,
  onPreview,
}: {
  entries: ChordEntry[];
  defaultBeats: number;
  selectedId: string | null;
  playingId: string | null;
  onSelect: (id: string) => void;
  onUseVoicing: (id: string, voicing: GuitarVoicing) => void;
  onUseVoicings: (voicings: GuitarVoicing[]) => void;
  onPreview: (voicing: GuitarVoicing) => void;
}) {
  const [style, setStyle] = useState<GuitarVoicingStyle>("standard");
  const [position, setPosition] = useState<GuitarPositionPreference>("auto");
  const [candidateIndex, setCandidateIndex] = useState(0);
  const selectedEntry =
    entries.find((entry) => entry.id === selectedId) ?? entries[0];
  const candidates = useMemo(() => {
    if (!selectedEntry) return [];
    const generated = generateGuitarVoicings(selectedEntry.chord, {
      style,
      position,
      limit: 10,
    });
    const saved = selectedEntry.guitarVoicing;
    return saved &&
      voicingMatchesChord(selectedEntry.chord, saved) &&
      !generated.some((candidate) => candidate.id === saved.id)
      ? [saved, ...generated]
      : generated;
  }, [selectedEntry, style, position]);

  useEffect(() => {
    if (!selectedEntry) return;
    const savedIndex = candidates.findIndex(
      (candidate) => candidate.id === selectedEntry.guitarVoicing?.id,
    );
    setCandidateIndex(savedIndex >= 0 ? savedIndex : 0);
  }, [selectedEntry?.id, selectedEntry?.guitarVoicing?.id, candidates]);

  const selectedVoicing =
    candidates[candidateIndex] ??
    (selectedEntry &&
    voicingMatchesChord(selectedEntry.chord, selectedEntry.guitarVoicing)
      ? selectedEntry.guitarVoicing
      : undefined);

  const timelineVoicings = useMemo(
    () =>
      new Map(
        entries.map((entry) => [
          entry.id,
          entry.id === selectedEntry?.id && selectedVoicing
            ? selectedVoicing
            : defaultVoicing(entry, { style, position, limit: 6 }),
        ]),
      ),
    [entries, selectedEntry?.id, selectedVoicing, style, position],
  );

  function autoArrange() {
    const optimized = optimizeProgressionVoicings(entries, {
      style,
      position,
      limit: 7,
    });
    if (optimized.length === entries.length) onUseVoicings(optimized);
  }

  if (!entries.length) {
    return (
      <div className="guitar-empty">
        <Guitar size={28} />
        <p>コードを追加すると、ここにギターTABと押さえ方を表示します。</p>
      </div>
    );
  }

  return (
    <div className="guitar-editor">
      <div className="guitar-controls">
        <div>
          <span className="guitar-control-label">VOICING</span>
          <div className="segmented guitar-style-switch">
            {(Object.keys(STYLE_LABELS) as GuitarVoicingStyle[]).map((item) => (
              <button
                key={item}
                className={style === item ? "active" : ""}
                onClick={() => {
                  setStyle(item);
                  setCandidateIndex(0);
                }}
              >
                {STYLE_LABELS[item]}
              </button>
            ))}
          </div>
        </div>
        <label className="guitar-position-control">
          <span className="guitar-control-label">POSITION</span>
          <select
            value={position}
            onChange={(event) => {
              setPosition(event.target.value as GuitarPositionPreference);
              setCandidateIndex(0);
            }}
          >
            <option value="auto">Auto</option>
            <option value="open">Open</option>
            <option value="low">1–5 fret</option>
            <option value="middle">5–9 fret</option>
            <option value="high">8–12 fret</option>
          </select>
        </label>
        <button className="outline-button guitar-auto" onClick={autoArrange}>
          <Route size={15} /> 弾きやすく自動配置
        </button>
      </div>

      <GuitarScore
        display="tab"
        entries={entries}
        defaultBeats={defaultBeats}
        selectedId={selectedEntry?.id ?? null}
        playingId={playingId}
        voicings={timelineVoicings}
        onSelect={onSelect}
      />

      {selectedEntry && selectedVoicing && (
        <section className="guitar-inspector">
          <div className="guitar-inspector-heading">
            <div>
              <span className="eyebrow">GUITAR VOICING</span>
              <h3>{pretty(chordName(selectedEntry.chord))}</h3>
              <p>
                {selectedEntry.chord.degree} · {selectedEntry.chord.function}
              </p>
            </div>
            <div className="shape-switcher">
              <button
                aria-label="前のフォーム"
                disabled={candidateIndex <= 0}
                onClick={() =>
                  setCandidateIndex((index) => Math.max(0, index - 1))
                }
              >
                <ChevronLeft size={18} />
              </button>
              <span>
                {FAMILY_LABELS[selectedVoicing.family]}
                <small>
                  {candidateIndex + 1} / {candidates.length}
                </small>
              </span>
              <button
                aria-label="次のフォーム"
                disabled={candidateIndex >= candidates.length - 1}
                onClick={() =>
                  setCandidateIndex((index) =>
                    Math.min(candidates.length - 1, index + 1),
                  )
                }
              >
                <ChevronRight size={18} />
              </button>
            </div>
          </div>
          <div className="guitar-inspector-grid">
            <GuitarChordDiagram voicing={selectedVoicing} />
            <div className="guitar-voicing-details">
              <p className="guitar-reason">
                {selectedVoicing.recommendationReason ??
                  selectedVoicing.description}
              </p>
              <div className="guitar-inspector-actions">
                <button
                  className="outline-button"
                  onClick={() => onPreview(selectedVoicing)}
                >
                  <Play size={14} /> Play
                </button>
                <button
                  className="primary-button"
                  onClick={() =>
                    onUseVoicing(selectedEntry.id, selectedVoicing)
                  }
                >
                  このフォームを使用
                </button>
              </div>
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

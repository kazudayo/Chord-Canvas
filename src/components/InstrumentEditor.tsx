import { Guitar, Music2, Piano } from "lucide-react";
import { useState } from "react";
import type { GuitarVoicing } from "../guitar/types";
import type { ChordEntry, Key, MelodyNote } from "../music/types";
import { GuitarTab } from "./GuitarTab";
import { GuitarScore } from "./GuitarScore";
import { MelodyEditor } from "./MelodyEditor";

export function InstrumentEditor({
  entries,
  defaultBeats,
  totalBeats,
  musicKey,
  melody,
  selectedId,
  playingId,
  onMelodyChange,
  onSelect,
  onUseVoicing,
  onUseVoicings,
  onPreviewVoicing,
}: {
  entries: ChordEntry[];
  defaultBeats: number;
  totalBeats: number;
  musicKey: Key;
  melody: MelodyNote[];
  selectedId: string | null;
  playingId: string | null;
  onMelodyChange: (notes: MelodyNote[]) => void;
  onSelect: (id: string) => void;
  onUseVoicing: (id: string, voicing: GuitarVoicing) => void;
  onUseVoicings: (voicings: GuitarVoicing[]) => void;
  onPreviewVoicing: (voicing: GuitarVoicing) => void;
}) {
  const [mode, setMode] = useState<"roll" | "staff" | "guitar">("roll");
  const playingIndex = entries.findIndex((entry) => entry.id === playingId);
  const playingStartBeat =
    playingIndex >= 0
      ? entries
          .slice(0, playingIndex)
          .reduce((total, entry) => total + (entry.beats ?? defaultBeats), 0)
      : null;
  const playingBeats =
    playingIndex >= 0
      ? (entries[playingIndex].beats ?? defaultBeats)
      : undefined;
  return (
    <section className="instrument-editor">
      <div
        className="instrument-switch segmented"
        role="tablist"
        aria-label="楽器表示"
      >
        <button
          role="tab"
          aria-selected={mode === "roll"}
          className={mode === "roll" ? "active" : ""}
          onClick={() => setMode("roll")}
        >
          <Piano size={15} /> Piano Roll
        </button>
        <button
          role="tab"
          aria-selected={mode === "staff"}
          className={mode === "staff" ? "active" : ""}
          onClick={() => setMode("staff")}
        >
          <Music2 size={15} /> 五線譜
        </button>
        <button
          role="tab"
          aria-selected={mode === "guitar"}
          className={mode === "guitar" ? "active" : ""}
          onClick={() => setMode("guitar")}
        >
          <Guitar size={15} /> Guitar TAB
        </button>
      </div>
      {mode === "roll" ? (
        <MelodyEditor
          notes={melody}
          totalBeats={totalBeats}
          musicKey={musicKey}
          playheadBeat={playingStartBeat}
          playingBeats={playingBeats}
          onChange={onMelodyChange}
        />
      ) : mode === "staff" ? (
        <div className="guitar-editor staff-editor">
          <GuitarScore
            display="staff"
            entries={entries}
            defaultBeats={defaultBeats}
            selectedId={selectedId}
            playingId={playingId}
            onSelect={onSelect}
          />
        </div>
      ) : (
        <GuitarTab
          entries={entries}
          defaultBeats={defaultBeats}
          selectedId={selectedId}
          playingId={playingId}
          onSelect={onSelect}
          onUseVoicing={onUseVoicing}
          onUseVoicings={onUseVoicings}
          onPreview={onPreviewVoicing}
        />
      )}
    </section>
  );
}

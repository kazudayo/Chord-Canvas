import { Music2, PencilLine, Trash2 } from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
} from "react";
import type { MelodyNote } from "../music/types";

const NOTE_NAMES = [
  "C",
  "C♯",
  "D",
  "E♭",
  "E",
  "F",
  "F♯",
  "G",
  "A♭",
  "A",
  "B♭",
  "B",
];
const MIN_NOTE = 36;
const MAX_NOTE = 96;
const ROW_HEIGHT = 22;
const BEAT_WIDTH = 48;
const STEP = 0.25;
const PITCHES = Array.from(
  { length: MAX_NOTE - MIN_NOTE + 1 },
  (_, index) => MAX_NOTE - index,
);
const BLACK_NOTES = new Set([1, 3, 6, 8, 10]);

interface NoteInteraction {
  mode: "move" | "resize";
  original: MelodyNote;
  current: MelodyNote;
  startX: number;
  startY: number;
}

function noteName(note: number) {
  return `${NOTE_NAMES[note % 12]}${Math.floor(note / 12) - 1}`;
}

function newId() {
  return (
    globalThis.crypto?.randomUUID?.() ?? `melody-${Date.now()}-${Math.random()}`
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function snap(value: number) {
  return Math.round(value / STEP) * STEP;
}

export function MelodyEditor({
  notes,
  totalBeats,
  onChange,
}: {
  notes: MelodyNote[];
  totalBeats: number;
  onChange: (notes: MelodyNote[]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const drawRef = useRef<{
    anchorBeat: number;
    current: MelodyNote;
  } | null>(null);
  const interactionRef = useRef<NoteInteraction | null>(null);
  const [draft, setDraft] = useState<MelodyNote | null>(null);
  const [moving, setMoving] = useState<MelodyNote | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const gridWidth = Math.max(360, totalBeats * BEAT_WIDTH);
  const gridHeight = PITCHES.length * ROW_HEIGHT;
  const beats = useMemo(
    () => Array.from({ length: Math.ceil(totalBeats) }, (_, index) => index),
    [totalBeats],
  );
  const selected = notes.find((note) => note.id === selectedId);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = (MAX_NOTE - 76) * ROW_HEIGHT;
  }, []);

  useEffect(() => {
    if (selectedId && !notes.some((note) => note.id === selectedId))
      setSelectedId(null);
  }, [notes, selectedId]);

  function sorted(next: MelodyNote[]) {
    return [...next].sort(
      (a, b) => a.startBeat - b.startBeat || b.note - a.note,
    );
  }

  function pointInGrid(event: ReactPointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    return {
      beat: clamp(
        Math.floor((event.clientX - rect.left) / (BEAT_WIDTH * STEP)) * STEP,
        0,
        Math.max(0, totalBeats - STEP),
      ),
      note: clamp(
        MAX_NOTE - Math.floor((event.clientY - rect.top) / ROW_HEIGHT),
        MIN_NOTE,
        MAX_NOTE,
      ),
    };
  }

  function beginDraw(event: ReactPointerEvent<HTMLDivElement>) {
    if (!totalBeats) return;
    const point = pointInGrid(event);
    const note: MelodyNote = {
      id: newId(),
      note: point.note,
      startBeat: point.beat,
      durationBeats: Math.min(STEP, totalBeats - point.beat),
    };
    drawRef.current = { anchorBeat: point.beat, current: note };
    setDraft(note);
    setSelectedId(null);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueDraw(event: ReactPointerEvent<HTMLDivElement>) {
    const drawing = drawRef.current;
    if (!drawing) return;
    const point = pointInGrid(event);
    const startBeat = Math.min(drawing.anchorBeat, point.beat);
    const endBeat = Math.max(drawing.anchorBeat, point.beat) + STEP;
    const note = {
      ...drawing.current,
      note: point.note,
      startBeat,
      durationBeats: Math.min(totalBeats, endBeat) - startBeat,
    };
    drawing.current = note;
    setDraft(note);
  }

  function finishDraw(event: ReactPointerEvent<HTMLDivElement>) {
    const drawing = drawRef.current;
    if (!drawing) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onChange(sorted([...notes, drawing.current]));
    setSelectedId(drawing.current.id);
    drawRef.current = null;
    setDraft(null);
  }

  function cancelDraw() {
    drawRef.current = null;
    setDraft(null);
  }

  function beginNoteInteraction(
    event: ReactPointerEvent<HTMLElement>,
    note: MelodyNote,
    mode: NoteInteraction["mode"],
  ) {
    event.preventDefault();
    event.stopPropagation();
    const current = { ...note };
    interactionRef.current = {
      mode,
      original: note,
      current,
      startX: event.clientX,
      startY: event.clientY,
    };
    setMoving(current);
    setSelectedId(note.id);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function continueNoteInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction) return;
    const deltaBeats = snap((event.clientX - interaction.startX) / BEAT_WIDTH);
    let current: MelodyNote;
    if (interaction.mode === "resize") {
      current = {
        ...interaction.original,
        durationBeats: clamp(
          interaction.original.durationBeats + deltaBeats,
          STEP,
          totalBeats - interaction.original.startBeat,
        ),
      };
    } else {
      const deltaNotes = Math.round(
        (interaction.startY - event.clientY) / ROW_HEIGHT,
      );
      current = {
        ...interaction.original,
        note: clamp(interaction.original.note + deltaNotes, MIN_NOTE, MAX_NOTE),
        startBeat: clamp(
          interaction.original.startBeat + deltaBeats,
          0,
          Math.max(0, totalBeats - interaction.original.durationBeats),
        ),
      };
    }
    interaction.current = current;
    setMoving(current);
  }

  function finishNoteInteraction(event: ReactPointerEvent<HTMLElement>) {
    const interaction = interactionRef.current;
    if (!interaction) return;
    event.currentTarget.releasePointerCapture(event.pointerId);
    onChange(
      sorted(
        notes.map((note) =>
          note.id === interaction.current.id ? interaction.current : note,
        ),
      ),
    );
    interactionRef.current = null;
    setMoving(null);
  }

  function cancelNoteInteraction() {
    interactionRef.current = null;
    setMoving(null);
  }

  function removeSelected() {
    if (!selectedId) return;
    onChange(notes.filter((note) => note.id !== selectedId));
    setSelectedId(null);
  }

  const visibleNotes = notes.map((note) =>
    moving?.id === note.id ? moving : note,
  );
  if (draft) visibleNotes.push(draft);

  return (
    <section className="melody-editor" aria-label="メロディエディター">
      <div className="melody-heading">
        <div>
          <Music2 size={15} />
          <span>MELODY PIANO ROLL</span>
        </div>
        <div className="melody-tools">
          {selected ? (
            <span>
              {noteName(selected.note)} ・ {selected.startBeat + 1}拍目 ・
              {selected.durationBeats}拍
            </span>
          ) : (
            <span>{notes.length} notes</span>
          )}
          <button
            aria-label="選択したメロディ音を削除"
            title="選択したノートを削除"
            disabled={!selectedId}
            onClick={removeSelected}
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      <div className="piano-roll-help">
        <PencilLine size={13} />
        <span>空白をドラッグして描画</span>
        <i />
        <span>ノートをドラッグして移動</span>
        <i />
        <span>右端をドラッグして長さを変更</span>
        <strong>1/4拍グリッド</strong>
      </div>

      {totalBeats ? (
        <div className="piano-roll-scroll" ref={scrollRef}>
          <div className="piano-roll-inner">
            <div className="piano-roll-timeline">
              <div className="piano-roll-corner">KEY</div>
              <div className="piano-roll-beats" style={{ width: gridWidth }}>
                {beats.map((beat) => (
                  <span
                    key={beat}
                    style={{ left: beat * BEAT_WIDTH, width: BEAT_WIDTH }}
                  >
                    {beat + 1}
                  </span>
                ))}
              </div>
            </div>
            <div className="piano-roll-body">
              <div className="piano-keys" style={{ height: gridHeight }}>
                {PITCHES.map((note) => (
                  <div
                    key={note}
                    className={BLACK_NOTES.has(note % 12) ? "black" : ""}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span>{noteName(note)}</span>
                  </div>
                ))}
              </div>
              <div
                className="piano-roll-grid"
                aria-label="メロディノートを描画するピアノロール"
                style={{ width: gridWidth, height: gridHeight }}
                onPointerDown={beginDraw}
                onPointerMove={continueDraw}
                onPointerUp={finishDraw}
                onPointerCancel={cancelDraw}
              >
                {PITCHES.map((note, index) => (
                  <div
                    key={note}
                    className={`piano-roll-row ${BLACK_NOTES.has(note % 12) ? "black" : ""}`}
                    style={{ top: index * ROW_HEIGHT, height: ROW_HEIGHT }}
                  />
                ))}
                {Array.from(
                  { length: Math.ceil(totalBeats / STEP) + 1 },
                  (_, index) => index,
                ).map((index) => (
                  <i
                    key={index}
                    className={`piano-roll-line ${index % 4 === 0 ? "beat" : ""}`}
                    style={{ left: index * STEP * BEAT_WIDTH }}
                  />
                ))}
                {visibleNotes.map((note) => (
                  <div
                    key={note.id}
                    role="button"
                    tabIndex={0}
                    aria-label={`${noteName(note.note)}、${note.startBeat + 1}拍目から${note.durationBeats}拍`}
                    aria-pressed={selectedId === note.id}
                    className={`piano-roll-note ${selectedId === note.id ? "selected" : ""} ${draft?.id === note.id ? "draft" : ""}`}
                    style={{
                      left: note.startBeat * BEAT_WIDTH + 2,
                      top: (MAX_NOTE - note.note) * ROW_HEIGHT + 2,
                      width: Math.max(8, note.durationBeats * BEAT_WIDTH - 4),
                      height: ROW_HEIGHT - 4,
                    }}
                    onPointerDown={(event) =>
                      beginNoteInteraction(event, note, "move")
                    }
                    onPointerMove={continueNoteInteraction}
                    onPointerUp={finishNoteInteraction}
                    onPointerCancel={cancelNoteInteraction}
                    onKeyDown={(event) => {
                      if (event.key === "Delete" || event.key === "Backspace") {
                        event.preventDefault();
                        setSelectedId(note.id);
                        onChange(notes.filter((item) => item.id !== note.id));
                      }
                    }}
                  >
                    <span>{noteName(note.note)}</span>
                    <b
                      aria-hidden="true"
                      onPointerDown={(event) =>
                        beginNoteInteraction(event, note, "resize")
                      }
                      onPointerMove={continueNoteInteraction}
                      onPointerUp={finishNoteInteraction}
                      onPointerCancel={cancelNoteInteraction}
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <p className="melody-empty">
          コードを追加すると、ここにメロディを描けるようになります。
        </p>
      )}
    </section>
  );
}

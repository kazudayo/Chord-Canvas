import {
  Hand,
  LockKeyhole,
  Music2,
  PencilLine,
  RotateCcw,
  Trash2,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";
import { keyName, scale } from "../music/keys";
import { pitch, pretty } from "../music/notes";
import type { Key, MelodyNote } from "../music/types";

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
  musicKey,
  playheadBeat,
  playingBeats,
  onChange,
}: {
  notes: MelodyNote[];
  totalBeats: number;
  musicKey: Key;
  playheadBeat: number | null;
  playingBeats?: number;
  onChange: (notes: MelodyNote[]) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef(new Map<string, HTMLDivElement>());
  const drawRef = useRef<{
    anchorBeat: number;
    current: MelodyNote;
  } | null>(null);
  const interactionRef = useRef<NoteInteraction | null>(null);
  const [draft, setDraft] = useState<MelodyNote | null>(null);
  const [moving, setMoving] = useState<MelodyNote | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(max-width: 760px)").matches,
  );
  const [mobileMode, setMobileMode] = useState<"scroll" | "draw">("scroll");
  const [scaleLock, setScaleLock] = useState(false);
  const canEdit = !isMobile || mobileMode === "draw";
  const gridWidth = Math.max(360, totalBeats * BEAT_WIDTH);
  const gridHeight = PITCHES.length * ROW_HEIGHT;
  const beats = useMemo(
    () => Array.from({ length: Math.ceil(totalBeats) }, (_, index) => index),
    [totalBeats],
  );
  const keyPitchClasses = useMemo(
    () => new Set(scale(musicKey).map(pitch)),
    [musicKey.mode, musicKey.tonic],
  );
  const selected = notes.find((note) => note.id === selectedId);

  useEffect(() => {
    const viewport = scrollRef.current;
    if (viewport) viewport.scrollTop = (MAX_NOTE - 76) * ROW_HEIGHT;
  }, []);

  useEffect(() => {
    if (playheadBeat == null) return;
    const viewport = scrollRef.current;
    if (!viewport) return;
    const start = 52 + playheadBeat * BEAT_WIDTH;
    const end = start + (playingBeats ?? 1) * BEAT_WIDTH;
    const visibleStart = viewport.scrollLeft + 52;
    const visibleEnd = viewport.scrollLeft + viewport.clientWidth - 18;
    if (start >= visibleStart && end <= visibleEnd) return;
    viewport.scrollTo({
      left: Math.max(0, start - viewport.clientWidth * 0.3),
      top: viewport.scrollTop,
      behavior: "smooth",
    });
  }, [playheadBeat, playingBeats]);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 760px)");
    const update = () => setIsMobile(query.matches);
    update();
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);

  useEffect(() => {
    if (selectedId && !notes.some((note) => note.id === selectedId))
      setSelectedId(null);
  }, [notes, selectedId]);

  useEffect(() => {
    if (!selectedId) return;
    const selectedNote = noteRefs.current.get(selectedId);
    if (selectedNote && document.activeElement !== selectedNote)
      selectedNote.focus({ preventScroll: true });
  }, [selectedId]);

  function sorted(next: MelodyNote[]) {
    return [...next].sort(
      (a, b) => a.startBeat - b.startBeat || b.note - a.note,
    );
  }

  function isInKey(note: number) {
    return keyPitchClasses.has(((note % 12) + 12) % 12);
  }

  function constrainToKey(note: number) {
    const bounded = clamp(note, MIN_NOTE, MAX_NOTE);
    if (!scaleLock || isInKey(bounded)) return bounded;
    for (let distance = 1; distance < 12; distance++) {
      const lower = bounded - distance;
      if (lower >= MIN_NOTE && isInKey(lower)) return lower;
      const upper = bounded + distance;
      if (upper <= MAX_NOTE && isInKey(upper)) return upper;
    }
    return bounded;
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
    if (!totalBeats || !canEdit) return;
    const point = pointInGrid(event);
    if (scaleLock && !isInKey(point.note)) return;
    const note: MelodyNote = {
      id: newId(),
      note: constrainToKey(point.note),
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
      note: constrainToKey(point.note),
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
    if (!canEdit) return;
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.focus({ preventScroll: true });
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
        note: constrainToKey(interaction.original.note + deltaNotes),
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

  function removeNote(id: string) {
    const index = notes.findIndex((note) => note.id === id);
    if (index < 0) return;
    const previousId = index > 0 ? notes[index - 1].id : null;
    onChange(notes.filter((note) => note.id !== id));
    setSelectedId(previousId);
  }

  function removeSelected() {
    if (selectedId) removeNote(selectedId);
  }

  function handleNoteKeyDown(
    event: ReactKeyboardEvent<HTMLDivElement>,
    id: string,
  ) {
    if (!canEdit || (event.key !== "Delete" && event.key !== "Backspace"))
      return;
    event.preventDefault();
    event.stopPropagation();
    removeNote(id);
  }

  function resetNotes() {
    drawRef.current = null;
    interactionRef.current = null;
    setDraft(null);
    setMoving(null);
    setSelectedId(null);
    onChange([]);
  }

  function changeMobileMode(mode: "scroll" | "draw") {
    drawRef.current = null;
    interactionRef.current = null;
    setDraft(null);
    setMoving(null);
    setMobileMode(mode);
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
          <button
            className="melody-reset"
            aria-label="メロディノートをすべてリセット"
            title="すべてのノートを削除"
            disabled={notes.length === 0}
            onClick={resetNotes}
          >
            <RotateCcw size={13} />
            <span>リセット</span>
          </button>
        </div>
      </div>
      <div className="piano-roll-help">
        <div
          className="piano-roll-mode-toggle"
          role="group"
          aria-label="スマートフォンのピアノロール操作"
        >
          <button
            className={mobileMode === "scroll" ? "active" : ""}
            aria-pressed={mobileMode === "scroll"}
            onClick={() => changeMobileMode("scroll")}
          >
            <Hand size={13} /> スクロール
          </button>
          <button
            className={mobileMode === "draw" ? "active" : ""}
            aria-pressed={mobileMode === "draw"}
            onClick={() => changeMobileMode("draw")}
          >
            <PencilLine size={13} /> ノート作成
          </button>
        </div>
        <PencilLine size={13} />
        <span>空白をドラッグして描画</span>
        <i />
        <span>ノートをドラッグして移動</span>
        <i />
        <span>右端をドラッグして長さを変更</span>
        <button
          className={`scale-lock-toggle ${scaleLock ? "active" : ""}`}
          aria-pressed={scaleLock}
          onClick={() => setScaleLock((locked) => !locked)}
        >
          <LockKeyhole size={12} />
          {pretty(keyName(musicKey))} の音だけ
        </button>
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
                    className={`${BLACK_NOTES.has(note % 12) ? "black" : ""} ${scaleLock && !isInKey(note) ? "scale-disabled" : ""}`}
                    style={{ height: ROW_HEIGHT }}
                  >
                    <span>{noteName(note)}</span>
                  </div>
                ))}
              </div>
              <div
                className={`piano-roll-grid ${canEdit ? "draw-mode" : "scroll-mode"}`}
                aria-label={
                  canEdit
                    ? "メロディノートを描画するピアノロール"
                    : "上下左右にスクロールするピアノロール"
                }
                style={{ width: gridWidth, height: gridHeight }}
                onPointerDown={beginDraw}
                onPointerMove={continueDraw}
                onPointerUp={finishDraw}
                onPointerCancel={cancelDraw}
              >
                {PITCHES.map((note, index) => (
                  <div
                    key={note}
                    className={`piano-roll-row ${BLACK_NOTES.has(note % 12) ? "black" : ""} ${scaleLock && !isInKey(note) ? "scale-disabled" : ""}`}
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
                {playheadBeat != null && (
                  <div
                    className="piano-roll-playing-range"
                    aria-hidden="true"
                    style={{
                      left: playheadBeat * BEAT_WIDTH,
                      width: (playingBeats ?? 1) * BEAT_WIDTH,
                    }}
                  >
                    <i />
                  </div>
                )}
                {visibleNotes.map((note) => (
                  <div
                    key={note.id}
                    ref={(element) => {
                      if (element) noteRefs.current.set(note.id, element);
                      else noteRefs.current.delete(note.id);
                    }}
                    role="button"
                    tabIndex={0}
                    aria-label={`${noteName(note.note)}、${note.startBeat + 1}拍目から${note.durationBeats}拍`}
                    aria-pressed={selectedId === note.id}
                    className={`piano-roll-note ${selectedId === note.id ? "selected" : ""} ${draft?.id === note.id ? "draft" : ""} ${scaleLock && !isInKey(note.note) ? "out-of-key" : ""}`}
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
                    onKeyDown={(event) => handleNoteKeyDown(event, note.id)}
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

import { chordName } from "../music/chords";
import { LETTERS, pitch, pretty } from "../music/notes";
import type { Chord, ChordEntry } from "../music/types";
import { positionForString } from "../guitar/tab";
import { TAB_STRINGS } from "../guitar/tuning";
import type { GuitarVoicing } from "../guitar/types";
import { useEffect, useRef } from "react";

export type ScoreDisplay = "staff" | "tab";

const SYSTEM = {
  staff: { height: 224, top: 82, gap: 16 },
  tab: { height: 270, top: 86, gap: 25 },
} as const;

interface MeasureLayout {
  entry: ChordEntry;
  x: number;
  width: number;
  beats: number;
}

function measureLayouts(entries: ChordEntry[], defaultBeats: number) {
  let x = 0;
  return entries.map((entry): MeasureLayout => {
    const beats = entry.beats ?? defaultBeats;
    const width = Math.max(150, beats * 52);
    const layout = { entry, x, width, beats };
    x += width;
    return layout;
  });
}

const DISPLACED_NOTEHEAD_OFFSET = 16;

export function staffNotes(
  chord: Chord,
  staffTop: number,
  staffGap: number,
) {
  const staffBottom = staffTop + staffGap * 4;
  let previousMidi = 59;
  const notes = chord.notes.map((note) => {
    let midi = 60 + pitch(note);
    while (midi <= previousMidi) midi += 12;
    previousMidi = midi;
    const octave = Math.floor(midi / 12) - 1;
    const diatonic = octave * 7 + LETTERS.indexOf(note[0]);
    const e4 = 4 * 7 + LETTERS.indexOf("E");
    return {
      y: staffBottom - (diatonic - e4) * (staffGap / 2),
      accidental: pretty(note.slice(1)),
      diatonic,
    };
  });

  let displaced = false;
  return notes.map((note, index) => {
    const previous = notes[index - 1];
    if (!previous || note.diatonic - previous.diatonic !== 1) {
      displaced = false;
    } else {
      displaced = !displaced;
    }
    return {
      ...note,
      // 2度で隣接する音符は、下の音を左、上の音を右に交互配置する。
      xOffset: displaced ? DISPLACED_NOTEHEAD_OFFSET : 0,
    };
  });
}

function ledgerLines(
  y: number,
  staffTop: number,
  staffBottom: number,
  staffGap: number,
) {
  const lines: number[] = [];
  if (y > staffBottom + 3)
    for (let line = staffBottom + staffGap; line <= y + 2; line += staffGap)
      lines.push(line);
  if (y < staffTop - 3)
    for (let line = staffTop - staffGap; line >= y - 2; line -= staffGap)
      lines.push(line);
  return lines;
}

export function GuitarScore({
  display,
  entries,
  defaultBeats,
  selectedId,
  playingId,
  voicings,
  onSelect,
}: {
  display: ScoreDisplay;
  entries: ChordEntry[];
  defaultBeats: number;
  selectedId: string | null;
  playingId: string | null;
  voicings?: Map<string, GuitarVoicing | undefined>;
  onSelect: (id: string) => void;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const system = SYSTEM[display];
  const systemBottom = system.top + system.gap * (display === "staff" ? 4 : 5);
  const baseMeasures = measureLayouts(entries, defaultBeats);
  const baseWidth = baseMeasures.reduce(
    (total, measure) => total + measure.width,
    0,
  );
  const scoreWidth = Math.max(960, baseWidth);
  const extraWidth = entries.length
    ? (scoreWidth - baseWidth) / entries.length
    : 0;
  let nextX = 0;
  const measures = baseMeasures.map((measure) => {
    const expanded = {
      ...measure,
      x: nextX,
      width: measure.width + extraWidth,
    };
    nextX += expanded.width;
    return expanded;
  });
  const endX = measures.length
    ? measures.at(-1)!.x + measures.at(-1)!.width
    : 0;

  useEffect(() => {
    if (!playingId) return;
    const viewport = scrollRef.current;
    const measure = viewport
      ? Array.from(
          viewport.querySelectorAll<SVGGElement>("[data-chord-id]"),
        ).find((item) => item.dataset.chordId === playingId)
      : undefined;
    if (!viewport || !measure) return;
    const viewportRect = viewport.getBoundingClientRect();
    const measureRect = measure.getBoundingClientRect();
    const padding = 24;
    if (
      measureRect.left >= viewportRect.left + padding &&
      measureRect.right <= viewportRect.right - padding
    )
      return;
    viewport.scrollTo({
      left:
        viewport.scrollLeft +
        measureRect.left +
        measureRect.width / 2 -
        (viewportRect.left + viewportRect.width / 2),
      behavior: "smooth",
    });
  }, [playingId, display, scoreWidth]);

  return (
    <section
      className={`guitar-score ${display}-only`}
      aria-label={display === "staff" ? "五線譜" : "ギターTAB譜"}
    >
      <div className="guitar-score-heading">
        <strong>{display === "staff" ? "五線譜" : "Guitar TAB譜"}</strong>
        <span>
          {display === "staff"
            ? "コードの構成音を五線譜で確認できます"
            : "上から1弦 e、下が6弦 Eです。小さい数字は指番号です"}
        </span>
      </div>
      <div className="guitar-score-body">
        <div className="guitar-score-gutter" aria-hidden="true">
          {display === "staff" ? (
            <>
              <span className="score-label">SCORE</span>
              <span className="score-clef">𝄞</span>
            </>
          ) : (
            <>
              <span className="score-label">GUITAR TAB</span>
              <span className="score-tab-mark">
                <span>T</span>
                <span>A</span>
                <span>B</span>
              </span>
              <span className="score-string-labels">
                {(["e", "B", "G", "D", "A", "E"] as const).map(
                  (label, index) => (
                    <span
                      key={`${label}-${index}`}
                      style={{ top: system.top - 8 + index * system.gap }}
                    >
                      {label}
                    </span>
                  ),
                )}
              </span>
            </>
          )}
        </div>
        <div className="guitar-score-scroll" ref={scrollRef}>
          <svg
            className="guitar-score-svg"
            width={scoreWidth}
            height={system.height}
            viewBox={`0 0 ${scoreWidth} ${system.height}`}
            role="img"
            aria-label={
              display === "staff"
                ? "コード進行の五線譜"
                : "コード進行の六線ギターTAB譜"
            }
          >
            <rect width={scoreWidth} height={system.height} fill="#fff" />
            {display === "staff" &&
              Array.from({ length: 5 }, (_, index) => (
                <line
                  key={`staff-${index}`}
                  x1="0"
                  x2={scoreWidth}
                  y1={system.top + index * system.gap}
                  y2={system.top + index * system.gap}
                  className="score-staff-line"
                />
              ))}
            {display === "tab" &&
              TAB_STRINGS.map((string, index) => (
                <line
                  key={`tab-${string}`}
                  x1="0"
                  x2={scoreWidth}
                  y1={system.top + index * system.gap}
                  y2={system.top + index * system.gap}
                  className="score-tab-line"
                />
              ))}

            {measures.map(({ entry, x, width, beats }) => {
              const voicing = voicings?.get(entry.id);
              const noteX = x + width / 2;
              const notes = staffNotes(entry.chord, system.top, system.gap);
              const rightmostNoteX = Math.max(
                noteX,
                ...notes.map((note) => noteX + note.xOffset),
              );
              const selected = entry.id === selectedId;
              return (
                <g
                  key={entry.id}
                  data-chord-id={entry.id}
                  className={`guitar-score-measure${selected ? " selected" : ""}${entry.id === playingId ? " is-playing" : ""}`}
                  role="button"
                  tabIndex={0}
                  aria-label={`${pretty(chordName(entry.chord))} ${beats}拍`}
                  onClick={() => onSelect(entry.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      onSelect(entry.id);
                    }
                  }}
                >
                  <rect
                    className="score-measure-hit"
                    x={x + 1}
                    y="1"
                    width={width - 2}
                    height={system.height - 2}
                    rx="7"
                  />
                  <text x={x + 15} y="32" className="score-chord-name">
                    {pretty(chordName(entry.chord))}
                  </text>
                  <text
                    x={x + width - 13}
                    y="30"
                    textAnchor="end"
                    className="score-beats"
                  >
                    {beats}拍
                  </text>
                  <line
                    x1={x}
                    x2={x}
                    y1={system.top}
                    y2={systemBottom}
                    className="score-bar-line"
                  />
                  {Array.from({ length: Math.max(0, beats - 1) }, (_, beat) => {
                    const beatX = x + (width / beats) * (beat + 1);
                    return (
                      <line
                        key={beat}
                        x1={beatX}
                        x2={beatX}
                        y1={system.top - 10}
                        y2={systemBottom + 10}
                        className="score-beat-guide"
                      />
                    );
                  })}

                  {display === "staff" &&
                    notes.flatMap((note, index) => {
                      const headX = noteX + note.xOffset;
                      return [
                        ...ledgerLines(
                          note.y,
                          system.top,
                          systemBottom,
                          system.gap,
                        ).map((ledgerY) => (
                          <line
                            key={`ledger-${index}-${ledgerY}`}
                            x1={headX - 17}
                            x2={headX + 17}
                            y1={ledgerY}
                            y2={ledgerY}
                            className="score-ledger-line"
                          />
                        )),
                        note.accidental ? (
                          <text
                            key={`accidental-${index}`}
                            x={noteX - 22}
                            y={note.y + 5}
                            className="score-accidental"
                          >
                            {note.accidental}
                          </text>
                        ) : null,
                        <ellipse
                          key={`note-${index}`}
                          cx={headX}
                          cy={note.y}
                          rx="9"
                          ry="6"
                          transform={`rotate(-16 ${headX} ${note.y})`}
                          className={
                            beats >= 2 ? "score-note open" : "score-note"
                          }
                        />,
                      ];
                    })}
                  {display === "staff" && beats < 4 && notes.length > 0 && (
                    <line
                      x1={noteX + 8}
                      x2={noteX + 8}
                      y1={Math.min(...notes.map((note) => note.y)) - 34}
                      y2={Math.max(...notes.map((note) => note.y))}
                      className="score-note-stem"
                    />
                  )}
                  {display === "staff" && beats === 3 && (
                    <circle
                      cx={rightmostNoteX + 17}
                      cy={notes.at(-1)?.y ?? systemBottom}
                      r="2.6"
                      className="score-duration-dot"
                    />
                  )}

                  {display === "tab" &&
                    TAB_STRINGS.map((string, index) => {
                      const position = voicing
                        ? positionForString(voicing, string)
                        : undefined;
                      const value =
                        position?.fret == null ? "x" : String(position.fret);
                      const y = system.top + index * system.gap;
                      return (
                        <g key={string}>
                          <rect
                            x={noteX - 16}
                            y={y - 12}
                            width="32"
                            height="24"
                            rx="4"
                            className="score-tab-number-bg"
                          />
                          <text
                            x={noteX}
                            y={y + 6}
                            textAnchor="middle"
                            className="score-tab-number"
                          >
                            {value}
                          </text>
                          {position?.finger != null && position.fret !== 0 && (
                            <text
                              x={noteX + 18}
                              y={y - 9}
                              className="score-finger-number"
                            >
                              {position.finger}
                            </text>
                          )}
                        </g>
                      );
                    })}
                </g>
              );
            })}
            {measures.length > 0 && (
              <line
                x1={endX}
                x2={endX}
                y1={system.top}
                y2={systemBottom}
                className="score-end-line"
              />
            )}
          </svg>
        </div>
      </div>
      <div className="guitar-score-legend" aria-hidden="true">
        {display === "staff" ? (
          <>
            <span>五線上：コードの構成音</span>
            <span>コード名を押すと選択できます</span>
          </>
        ) : (
          <>
            <span>1弦 e → 6弦 E</span>
            <span>数字：フレット</span>
            <span>右上の数字：指番号</span>
            <span>x：ミュート</span>
          </>
        )}
      </div>
    </section>
  );
}

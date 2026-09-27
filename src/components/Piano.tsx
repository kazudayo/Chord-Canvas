import type { Chord } from "../music/types";
import { pitch } from "../music/notes";
export function Piano({ chord }: { chord?: Chord }) {
  const whites = [0, 2, 4, 5, 7, 9, 11, 12, 14, 16, 17, 19, 21, 23];
  const blacks = [
    { pc: 1, pos: 1 },
    { pc: 3, pos: 2 },
    { pc: 6, pos: 4 },
    { pc: 8, pos: 5 },
    { pc: 10, pos: 6 },
    { pc: 13, pos: 8 },
    { pc: 15, pos: 9 },
    { pc: 18, pos: 11 },
    { pc: 20, pos: 12 },
    { pc: 22, pos: 13 },
  ];
  const notes = chord?.notes.map(pitch) ?? [];
  const active = (pc: number) =>
    chord && pitch(chord.root) === pc % 12
      ? "root"
      : notes.includes(pc % 12)
        ? "tone"
        : "";
  return (
    <div
      className="piano"
      role="img"
      aria-label={
        chord
          ? `鍵盤上の構成音: ${chord.notes.join(", ")}。ルート音: ${chord.root}`
          : "コードを選択すると構成音が表示されます"
      }
    >
      {whites.map((pc) => (
        <div key={pc} className={`white-key ${active(pc)}`}>
          <span>
            {active(pc)
              ? ["C", "", "D", "", "E", "F", "", "G", "", "A", "", "B"][pc % 12]
              : ""}
          </span>
        </div>
      ))}
      {blacks.map(({ pc, pos }) => (
        <div
          key={pc}
          className={`black-key ${active(pc)}`}
          style={{ left: `calc(${(pos / 14) * 100}% - 2.1%)` }}
        >
          <span>{active(pc) ? "●" : ""}</span>
        </div>
      ))}
    </div>
  );
}

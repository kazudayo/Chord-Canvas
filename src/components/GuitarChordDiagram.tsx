import { STRING_LABELS, TAB_STRINGS } from "../guitar/tuning";
import type { GuitarStringNumber, GuitarVoicing } from "../guitar/types";
import { positionForString } from "../guitar/tab";

const FRET_LEFT = 72;
const FRET_WIDTH = 48;
const STRING_TOP = 40;
const STRING_GAP = 23;
const X = (fret: number, baseFret: number) =>
  FRET_LEFT + (fret - baseFret + 0.5) * FRET_WIDTH;
const Y = (string: GuitarStringNumber) =>
  STRING_TOP + (string - 1) * STRING_GAP;

export function GuitarChordDiagram({ voicing }: { voicing: GuitarVoicing }) {
  const fretted = voicing.positions
    .map((position) => position.fret)
    .filter((fret): fret is number => fret != null && fret > 0);
  const baseFret =
    fretted.length && Math.min(...fretted) >= 5 ? Math.min(...fretted) : 1;

  return (
    <div
      className="guitar-diagram horizontal"
      aria-label="横向きギターコードダイアグラム"
    >
      <svg viewBox="0 0 345 184" role="img">
        <title>横向きギターコードダイアグラム</title>
        {baseFret > 1 && (
          <text x={FRET_LEFT + 4} y="19" className="diagram-base-fret">
            {baseFret}fr
          </text>
        )}

        {TAB_STRINGS.map((string) => {
          const position = positionForString(voicing, string);
          const marker =
            position?.fret == null ? "×" : position.fret === 0 ? "○" : "";
          return (
            <g key={string}>
              <text x="14" y={Y(string) + 4} className="diagram-string-name">
                {STRING_LABELS[string]}
              </text>
              <text
                x="45"
                y={Y(string) + 5}
                textAnchor="middle"
                className="diagram-marker"
              >
                {marker}
              </text>
              <line
                x1={FRET_LEFT}
                x2={FRET_LEFT + FRET_WIDTH * 5}
                y1={Y(string)}
                y2={Y(string)}
                className="diagram-string"
              />
            </g>
          );
        })}

        {Array.from({ length: 6 }, (_, index) => (
          <line
            key={index}
            x1={FRET_LEFT + index * FRET_WIDTH}
            x2={FRET_LEFT + index * FRET_WIDTH}
            y1={STRING_TOP}
            y2={STRING_TOP + STRING_GAP * 5}
            className={
              index === 0 && baseFret === 1 ? "diagram-nut" : "diagram-fret"
            }
          />
        ))}

        {voicing.barres?.map((barre, index) => {
          const x = X(barre.fret, baseFret);
          return (
            <line
              key={`${barre.fret}-${index}`}
              x1={x}
              x2={x}
              y1={Y(barre.fromString)}
              y2={Y(barre.toString)}
              className="diagram-barre"
            />
          );
        })}

        {voicing.positions.map((position) => {
          if (position.fret == null || position.fret === 0) return null;
          const x = X(position.fret, baseFret);
          if (x < FRET_LEFT || x > FRET_LEFT + FRET_WIDTH * 5) return null;
          return (
            <g key={position.string}>
              <circle
                cx={x}
                cy={Y(position.string)}
                r="11"
                className="diagram-dot"
              />
              <text
                x={x}
                y={Y(position.string) + 4}
                textAnchor="middle"
                className="diagram-finger"
              >
                {position.finger}
              </text>
            </g>
          );
        })}
      </svg>
      <div className="diagram-legend">
        <span>● 押弦</span>
        <span>○ 開放</span>
        <span>× ミュート</span>
      </div>
    </div>
  );
}

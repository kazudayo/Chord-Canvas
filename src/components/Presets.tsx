import { Play, Plus, Replace } from "lucide-react";
import { PRESETS, presetChords } from "../music/presets";
import { chordName } from "../music/chords";
import { pretty } from "../music/notes";
import type { Chord, Key } from "../music/types";
export function Presets({
  musicKey,
  preview,
  apply,
}: {
  musicKey: Key;
  preview: (chords: Chord[]) => void;
  apply: (chords: Chord[], replace: boolean) => void;
}) {
  return (
    <div className="presets">
      <div className="eyebrow">START WITH A FAMILIAR SHAPE</div>
      <h2>定番から、あなたの進行へ</h2>
      <p className="muted">
        現在のキーに合わせた定番進行。適用後は、ひとつずつ自由に編集できます。
      </p>
      <div className="preset-grid">
        {PRESETS.filter((p) => p.mode === musicKey.mode).map((p) => {
          const chords = presetChords(p, musicKey);
          return (
            <article className="preset-card" key={p.id}>
              <span className="eyebrow">{p.mood}</span>
              <h3>{p.name}</h3>
              {p.aliases && <small>{p.aliases.join(" / ")}</small>}
              <div className="preset-degrees">{p.degrees.join(" → ")}</div>
              <div className="preset-chords">
                {chords.map((c) => pretty(chordName(c))).join(" · ")}
              </div>
              <p>{p.description}</p>
              <div className="preset-actions">
                <button
                  className="text-button"
                  aria-label={`${p.name}を試聴`}
                  onClick={() => preview(chords)}
                >
                  <Play size={13} />
                  試聴
                </button>
                <button
                  className="small-button"
                  aria-label={`${p.name}を追加`}
                  onClick={() => apply(chords, false)}
                >
                  <Plus size={13} />
                  追加
                </button>
                <button
                  className="text-button"
                  aria-label={`${p.name}でセクションを置換`}
                  onClick={() => apply(chords, true)}
                >
                  <Replace size={13} />
                  置換
                </button>
              </div>
            </article>
          );
        })}
      </div>
      <p className="micro-copy">
        長調・短調を切り替えると、それぞれのプリセットが表示されます。置換は現在のセクションのみ対象です。「元に戻す」で復元できます。
      </p>
    </div>
  );
}

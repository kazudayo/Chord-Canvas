import { AudioLines, Lightbulb, Play, Repeat2 } from "lucide-react";
import type { Chord, Key } from "../music/types";
import { chordName, invert } from "../music/chords";
import { pretty } from "../music/notes";
import { bestInversion } from "../music/voiceLeading";
import { substitutes } from "../music/recommendation";
import { Piano } from "./Piano";
import { functionClass, functionShort } from "../music/functions";
import { keyName } from "../music/keys";
export function ChordDetail({
  chord,
  previous,
  musicKey,
  preview,
  change,
}: {
  chord?: Chord;
  previous?: Chord;
  musicKey: Key;
  preview: (c: Chord) => void;
  change: (c: Chord) => void;
}) {
  const suggestion =
    chord && previous ? bestInversion(previous, chord) : undefined;
  const alternatives = chord ? substitutes(chord, musicKey) : [];
  return (
    <aside className="inspector panel">
      <div className="eyebrow">
        <AudioLines size={15} /> CHORD INSPECTOR
      </div>
      <h2>コードを知る</h2>
      {chord ? (
        <>
          <div className="detail-chord">
            <div>
              <span className="detail-degree">{chord.degree}</span>
              <h3>{pretty(chordName(chord))}</h3>
            </div>
            <button
              className="round-play"
              aria-label="選択コードを試聴"
              onClick={() => preview(chord)}
            >
              <Play size={18} fill="currentColor" />
            </button>
          </div>
          <span className={`function-tag ${functionClass(chord)}`}>
            <i />
            {functionShort(chord)}
          </span>
          {chord.interpretations && (
            <div className="interpretations">
              {chord.interpretations.map((a, i) => (
                <p key={i}>
                  <strong>{keyName(a.key)}</strong> · {a.degree} / {a.function}
                </p>
              ))}
              <small>
                現在の分析キー：{keyName(chord.analysisKey ?? musicKey)}
              </small>
            </div>
          )}
          {chord.contextualReasons?.map((reason, i) => (
            <p className="micro-copy" key={i}>
              {reason}
            </p>
          ))}
          <p className="function-explanation">
            {chord.function === "Tonic"
              ? "安定感のある、帰る場所。曲の中心を感じさせる響きです。"
              : chord.function === "Predominant"
                ? "響きを広げる、展開の入り口。次のドミナントへ自然につながります。"
                : "次へ向かう、心地よい緊張感。トニックへの解決を予感させます。"}
          </p>
          <div className="detail-divider" />
          <div className="minor-heading">
            構成音 <span>CHORD TONES</span>
          </div>
          <div className="note-chips">
            {chord.notes.map((n, i) => (
              <span key={i} className={i === 0 ? "root-note" : ""}>
                {pretty(n)}
                <small>{i === 0 ? "ROOT" : ""}</small>
              </span>
            ))}
          </div>
          <Piano chord={chord} />
          <div className="piano-legend">
            <span>
              <i className="root-dot" />
              ルート
            </span>
            <span>
              <i className="tone-dot" />
              構成音
            </span>
          </div>
          <div className="detail-divider" />
          <label className="minor-heading" htmlFor="inversion">
            転回形 <span>INVERSION</span>
          </label>
          <select
            id="inversion"
            value={chord.inversion}
            onChange={(e) => change(invert(chord, Number(e.target.value)))}
          >
            {chord.notes.map((_, i) => (
              <option key={i} value={i}>
                {i === 0 ? "基本形" : `第${i}転回形`} ·{" "}
                {pretty(chordName(invert(chord, i)))}
              </option>
            ))}
          </select>
          {suggestion && (
            <div className="voice-tip">
              <Lightbulb size={16} />
              <div>
                <strong>おすすめ：{pretty(chordName(suggestion.chord))}</strong>
                <p>{suggestion.reason}</p>
                {suggestion.chord.inversion !== chord.inversion && (
                  <button
                    className="text-button"
                    onClick={() => change(suggestion.chord)}
                  >
                    この転回形を使う →
                  </button>
                )}
              </div>
            </div>
          )}
          {!!alternatives.length && (
            <>
              <div className="minor-heading substitute-heading">
                <Repeat2 size={14} /> 代理コード
              </div>
              <div className="substitutes">
                {alternatives.map((c) => (
                  <button
                    key={chordName(c)}
                    title="選択コードを置き換え"
                    onClick={() => change(c)}
                  >
                    {pretty(chordName(c))}
                  </button>
                ))}
              </div>
              <p className="micro-copy">
                近い機能を持つ候補です。響きを聴いて選びましょう。
              </p>
            </>
          )}
        </>
      ) : (
        <div className="detail-empty">
          <Piano />
          <p>
            進行にコードを追加すると、
            <br />
            構成音や転回形を確認できます。
          </p>
        </div>
      )}
    </aside>
  );
}

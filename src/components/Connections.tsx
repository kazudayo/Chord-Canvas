import { useState } from "react";
import { ArrowRight, GitBranch, Plus, Play } from "lucide-react";
import type { Chord, Key, Section } from "../music/types";
import { chordName } from "../music/chords";
import { keyName } from "../music/keys";
import { pretty } from "../music/notes";
import {
  findConnectionRoutes,
  modulationRoutes,
  pivots,
  relatedKeys,
  type ConnectionMood,
} from "../music/modulation";
function Route({
  chords,
  onPreview,
  onUse,
  reason,
  label,
}: {
  chords: Chord[];
  onPreview: () => void;
  onUse: () => void;
  reason: string;
  label: string;
}) {
  return (
    <article className="route-card">
      <div className="route-notes">
        {chords.map((c, i) => (
          <span key={i}>
            {i > 0 && <ArrowRight size={14} />}
            <strong>{pretty(chordName(c))}</strong>
            <small>{c.degree}</small>
          </span>
        ))}
      </div>
      {chords[0]?.interpretations && (
        <div className="route-context">
          {chords[0].interpretations.map((a, i) => (
            <span key={i}>
              {pretty(keyName(a.key))}: {a.degree}
              {i === 0 ? " → " : ""}
            </span>
          ))}
        </div>
      )}
      <p>{reason}</p>
      <div className="route-actions">
        <button className="text-button" onClick={onPreview}>
          <Play size={13} /> 試聴
        </button>
        <button className="small-button" onClick={onUse}>
          <Plus size={14} />
          {label}
        </button>
      </div>
    </article>
  );
}
export function Modulation({
  section,
  preview,
  apply,
}: {
  section: Section;
  preview: (chords: Chord[]) => void;
  apply: (key: Key, chords: Chord[]) => void;
}) {
  const related = relatedKeys(section.key);
  const [targetIndex, setTargetIndex] = useState(0);
  const target = related[targetIndex];
  const common = pivots(section.key, target.key);
  const routes = modulationRoutes(section.key, target.key);
  return (
    <div className="explore-panel">
      <div className="section-heading">
        <div>
          <div className="eyebrow">EXPLORE A NEW KEY</div>
          <h2>別のキーへ、物語を広げる</h2>
        </div>
        <GitBranch size={22} />
      </div>
      <p className="muted">
        転調先とつなぎ方を選んで、新しいセクションを作成します。
      </p>
      <div className="related-grid">
        {related.map((r, i) => (
          <button
            key={i}
            className={`related-key ${targetIndex === i ? "active" : ""}`}
            onClick={() => setTargetIndex(i)}
          >
            <strong>{pretty(keyName(r.key))}</strong>
            <small>{r.relation}</small>
          </button>
        ))}
      </div>
      <div className="pivot-box">
        <h3>
          共通和音 <span>Pivot chords</span>
        </h3>
        {common.length ? (
          <>
            <div className="pivot-list">
              {common.map((p) => (
                <div key={chordName(p.chord)}>
                  <strong>{pretty(chordName(p.chord))}</strong>
                  <span>
                    {p.currentDegree} <ArrowRight size={12} /> {p.targetDegree}
                  </span>
                </div>
              ))}
            </div>
            <p>
              {pretty(keyName(section.key))} と {pretty(keyName(target.key))}{" "}
              の両方で使えます。度数は「現在 → 転調先」です。
            </p>
          </>
        ) : (
          <p>
            この2つのキーには、同じ構成音のダイアトニック三和音がありません。ドミナント経由や直接の転調を試せます。
          </p>
        )}
      </div>
      <div className="route-list">
        {routes.map((r, i) => (
          <Route
            key={i}
            {...r}
            label="新セクションに追加"
            onPreview={() => preview(r.chords)}
            onUse={() => apply(target.key, r.chords)}
          />
        ))}
      </div>
    </div>
  );
}
export function Connections({
  section,
  sections,
  preview,
  apply,
}: {
  section: Section;
  sections: Section[];
  preview: (chords: Chord[]) => void;
  apply: (chords: Chord[], targetId: string) => void;
}) {
  const others = sections.filter((s) => s.id !== section.id);
  const [targetId, setTargetId] = useState(others[0]?.id ?? "");
  const [mood, setMood] = useState<ConnectionMood>("自然");
  const target = others.find((s) => s.id === targetId) ?? others[0];
  const routes = target
    ? findConnectionRoutes(
        {
          sourceKey: section.key,
          targetKey: target.key,
          sourceChord: section.chords.at(-1)?.chord,
          targetChord: target.chords[0]?.chord,
        },
        mood,
      )
    : [];
  return (
    <div className="explore-panel">
      <div className="eyebrow">CONNECT YOUR SECTIONS</div>
      <h2>セクションを、自然につなぐ</h2>
      <p className="muted">
        最後のコードと次のセクションの最初のコードから、間に入れる和音を探します。
      </p>
      {target ? (
        <>
          <div className="connection-controls">
            <div>
              <small>現在のセクション</small>
              <strong>
                {section.name} ·{" "}
                {pretty(
                  chordName(
                    section.chords.at(-1)?.chord ??
                      target.chords[0]?.chord ??
                      routes[0].chords[0],
                  ),
                )}
              </strong>
            </div>
            <ArrowRight size={18} />
            <label>
              接続先
              <select
                aria-label="接続先セクション"
                value={target.id}
                onChange={(e) => setTargetId(e.target.value)}
              >
                {others.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} · {keyName(s.key)}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="filter-chips">
            {(
              [
                "自然",
                "盛り上げる",
                "落ち着かせる",
                "意外性",
                "転調",
              ] as ConnectionMood[]
            ).map((m) => (
              <button
                key={m}
                className={mood === m ? "active" : ""}
                onClick={() => setMood(m)}
              >
                {m}
              </button>
            ))}
          </div>
          <p className="micro-copy">
            接続コードを現在の末尾に追加し、接続先セクションをその次に並べます。末尾の着地コードは接続先で鳴らします。
          </p>
          <div className="route-list">
            {routes.map((r, i) => (
              <Route
                key={i}
                {...r}
                label="この接続を使う"
                onPreview={() => preview(r.chords)}
                onUse={() => apply(r.chords, target.id)}
              />
            ))}
          </div>
        </>
      ) : (
        <div className="empty-state">
          <GitBranch size={32} />
          <h3>次のセクションを追加しましょう</h3>
          <p>
            上の「＋」からサビやBメロを追加すると、つなぎの候補を表示します。
          </p>
        </div>
      )}
    </div>
  );
}

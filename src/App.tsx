import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine,
  ArrowLeft,
  ArrowRight,
  AudioLines,
  BookOpen,
  Check,
  CircleHelp,
  Copy,
  Download,
  Ellipsis,
  FolderOpen,
  GitBranch,
  GripVertical,
  Headphones,
  Lightbulb,
  Link2,
  ListMusic,
  Music2,
  Pause,
  Play,
  Plus,
  Redo2,
  Repeat2,
  Settings2,
  Shuffle,
  Sparkles,
  Square,
  Trash2,
  Undo2,
  Volume2,
  X,
} from "lucide-react";
import type {
  Chord,
  Key,
  MelodyNote,
  Mood,
  Quality,
  Section,
  Song,
} from "./music/types";
import {
  borrowed,
  chordName,
  classify,
  diatonic,
  harmonicDominants,
  invert,
  makeChord,
  QUALITIES,
  secondaryDominants,
  transpose,
} from "./music/chords";
import { chromaticName, KEY_OPTIONS, mod, pitch, pretty } from "./music/notes";
import { keyName, scale } from "./music/keys";
import { cadence, MOODS, recommendations } from "./music/recommendation";
import { entry, exportSong, uid, useWorkspace } from "./state/workspace";
import { type PlaybackState } from "./audio/engine";
import { useSoundEngine } from "./state/sound";
import { SoundSettings } from "./components/SoundSettings";
import { Presets } from "./components/Presets";
import { createSongPlaybackEvents } from "./audio/events";
import { downloadMidi } from "./midi/export";
import { ChordDetail } from "./components/ChordDetail";
import { functionClass, functionShort } from "./music/functions";
import { connectionChord } from "./music/modulation";
import { Modal } from "./components/Modal";
import { Connections, Modulation } from "./components/Connections";
import { MelodyEditor } from "./components/MelodyEditor";

type View = "compose" | "connect" | "modulate" | "presets";
type Dialog =
  | "library"
  | "export"
  | "transpose"
  | "section"
  | "custom"
  | "help"
  | "sound"
  | null;
const SOURCE_LABELS = {
  diatonic: "ダイアトニック",
  borrowed: "借用和音",
  secondaryDominant: "セカンダリードミナント",
  harmonicMinor: "ハーモニック・マイナー",
  custom: "自由なコード",
  modulation: "転調",
};
function KeySelect({
  value,
  onChange,
  label,
}: {
  value: Key;
  onChange: (key: Key) => void;
  label: string;
}) {
  return (
    <div className="key-select">
      <select
        aria-label={`${label}の主音`}
        value={value.tonic}
        onChange={(e) => onChange({ ...value, tonic: e.target.value })}
      >
        {KEY_OPTIONS.map((k) => (
          <option key={k} value={k}>
            {pretty(k)}
          </option>
        ))}
      </select>
      <select
        aria-label={`${label}の調性`}
        value={value.mode}
        onChange={(e) =>
          onChange({ ...value, mode: e.target.value as Key["mode"] })
        }
      >
        <option value="major">Major</option>
        <option value="minor">Minor</option>
      </select>
    </div>
  );
}
export default function App() {
  const workspace = useWorkspace();
  const { song } = workspace;
  const [sectionId, setSectionId] = useState(song.sections[0].id);
  const section =
    song.sections.find((s) => s.id === sectionId) ?? song.sections[0];
  const [selectedId, setSelectedId] = useState<string | null>(
    section.chords.at(-1)?.id ?? null,
  );
  const selectedIndex = section.chords.findIndex((e) => e.id === selectedId);
  const selected = section.chords[selectedIndex]?.chord;
  useEffect(() => {
    if (!section.chords.some((e) => e.id === selectedId))
      setSelectedId(section.chords.at(-1)?.id ?? null);
  }, [section.id, section.chords, selectedId]);
  const [seventh, setSeventh] = useState(true);
  const [palette, setPalette] = useState("diatonic");
  const [category, setCategory] = useState("すべて");
  const [mood, setMood] = useState<Mood>("すべて");
  const [view, setView] = useState<View>("compose");
  const [dialog, setDialog] = useState<Dialog>(null);
  const [toast, setToast] = useState("");
  const [editMode, setEditMode] = useState<"append" | "replace">("append");
  const [exportDegrees, setExportDegrees] = useState(false);
  const [targetTonic, setTargetTonic] = useState("D");
  const [sectionName, setSectionName] = useState("Bメロ");
  const [renameSection, setRenameSection] = useState(false);
  const [customRoot, setCustomRoot] = useState("C");
  const [customQuality, setCustomQuality] = useState<Quality>("major");
  const [deleteTarget, setDeleteTarget] = useState<{
    type: "song" | "section";
    id: string;
    name: string;
  } | null>(null);
  const [playState, setPlayState] = useState<PlaybackState>("stopped");
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [scope, setScope] = useState("section");
  const [volume, setVolume] = useState(0.6);
  const [audioLoading, setAudioLoading] = useState(false);
  const [bpmDraft, setBpmDraft] = useState(String(song.bpm));
  const sound = useSoundEngine();
  const dragId = useRef<string | null>(null);
  const audio = sound.engine;
  const stop = () => {
    sound.stop();
    setPlayState("stopped");
    setPlayingId(null);
  };
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(""), 3400);
    return () => clearTimeout(timer);
  }, [toast]);
  useEffect(() => setBpmDraft(String(song.bpm)), [song.id, song.bpm]);
  const notify = (text: string) => setToast(text);
  function updateSong(next: Song) {
    stop();
    workspace.update(next);
  }
  function updateSection(next: Section) {
    updateSong({
      ...song,
      sections: song.sections.map((s) => (s.id === section.id ? next : s)),
    });
  }
  function commitBpm() {
    const parsed = bpmDraft.trim() ? Number(bpmDraft) : Number.NaN;
    const bpm = Number.isFinite(parsed)
      ? Math.max(30, Math.min(240, Math.round(parsed)))
      : song.bpm;
    setBpmDraft(String(bpm));
    if (bpm !== song.bpm) updateSong({ ...song, bpm });
  }
  function chooseSection(s: Section) {
    stop();
    setSectionId(s.id);
    setSelectedId(s.chords.at(-1)?.id ?? null);
    setEditMode("append");
  }
  function setKey(key: Key) {
    updateSection({
      ...section,
      key,
      chords: section.chords.map((e) => ({
        ...e,
        chord: invert(
          classify(e.chord.root, e.chord.quality, key),
          e.chord.inversion,
        ),
      })),
    });
    notify("キーを変更しました。既存コードの音高は維持しています。");
  }
  async function preview(chord: Chord) {
    stop();
    setAudioLoading(true);
    try {
      audio().setVolume(volume);
      await audio().preview(chord, song.pattern);
    } catch {
      notify("音声を開始できませんでした。もう一度試聴を押してください。");
    } finally {
      setAudioLoading(false);
    }
  }
  async function previewRoute(chords: Chord[]) {
    stop();
    setAudioLoading(true);
    try {
      audio().setVolume(volume);
      await audio().previewRoute(chords, song.pattern, song.bpm, song.beats);
    } catch {
      notify("音声を開始できませんでした。");
    } finally {
      setAudioLoading(false);
    }
  }
  async function testNote() {
    stop();
    setAudioLoading(true);
    try {
      audio().setVolume(volume);
      await audio().previewNote();
    } catch {
      notify("テスト音を再生できませんでした。音源と接続をご確認ください。");
    } finally {
      setAudioLoading(false);
    }
  }
  function addChord(
    chord: Chord,
    origin: "manual" | "recommendation" = "manual",
  ) {
    const next = entry(chord, origin, song.beats);
    if (editMode === "replace" && selectedIndex >= 0) {
      next.id = section.chords[selectedIndex].id;
      next.beats = section.chords[selectedIndex].beats ?? song.beats;
      updateSection({
        ...section,
        chords: section.chords.map((e, i) => (i === selectedIndex ? next : e)),
      });
      setEditMode("append");
      notify(`${pretty(chordName(chord))}に置き換えました`);
    } else {
      const index =
        selectedIndex >= 0 ? selectedIndex + 1 : section.chords.length;
      const chords = [...section.chords];
      chords.splice(index, 0, next);
      updateSection({ ...section, chords });
    }
    setSelectedId(next.id);
  }
  function changeSelected(chord: Chord) {
    if (selectedIndex >= 0)
      updateSection({
        ...section,
        chords: section.chords.map((e, i) =>
          i === selectedIndex ? { ...e, chord } : e,
        ),
      });
  }
  function removeChord(id: string) {
    const index = section.chords.findIndex((e) => e.id === id),
      chords = section.chords.filter((e) => e.id !== id);
    updateSection({ ...section, chords });
    if (id === selectedId)
      setSelectedId(chords[Math.max(0, index - 1)]?.id ?? null);
  }
  function changeChordBeats(id: string, beats: number) {
    updateSection({
      ...section,
      chords: section.chords.map((item) =>
        item.id === id ? { ...item, beats } : item,
      ),
    });
  }
  function updateMelody(melody: MelodyNote[]) {
    updateSection({ ...section, melody });
  }
  function moveChord(id: string, to: number) {
    const index = section.chords.findIndex((e) => e.id === id);
    if (index < 0 || to < 0 || to >= section.chords.length || index === to)
      return;
    const chords = [...section.chords];
    const [moving] = chords.splice(index, 1);
    chords.splice(to, 0, moving);
    updateSection({ ...section, chords });
  }
  async function togglePlay() {
    if (playState === "playing") {
      audio().pause();
      return;
    }
    const playbackItems =
      scope === "song"
        ? song.sections.flatMap((s) =>
            s.chords.map((item) => ({ item, sectionId: s.id })),
          )
        : section.chords.map((item) => ({ item, sectionId: section.id }));
    if (!playbackItems.length) {
      notify("まずコードを追加してください");
      return;
    }
    setAudioLoading(true);
    try {
      if (playState !== "paused") audio().prepare();
      audio().setVolume(volume);
      await audio().playSequence(
        createSongPlaybackEvents(scope === "song" ? song.sections : [section], {
          beats: song.beats,
          pattern: song.pattern,
          rhythm: song.rhythm ?? "off",
          velocity: sound.settings.velocity,
        }),
        song.bpm,
        song.loop,
        (index, state) => {
          const current = playbackItems[index];
          setPlayState(state);
          setPlayingId(current?.item.id ?? null);
          if (scope === "song" && current && state !== "stopped")
            setSectionId(current.sectionId);
        },
      );
    } catch (error) {
      notify(
        error instanceof Error
          ? `再生を開始できませんでした。${error.message}`
          : "再生を開始できませんでした。もう一度再生を押してください。",
      );
    } finally {
      setAudioLoading(false);
    }
  }
  function undo() {
    stop();
    workspace.undo();
  }
  function redo() {
    stop();
    workspace.redo();
  }
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        ["INPUT", "TEXTAREA", "SELECT", "BUTTON"].includes(target.tagName) ||
        target.isContentEditable ||
        dialog ||
        deleteTarget
      )
        return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) redo();
        else undo();
      }
      if (e.code === "Space") {
        e.preventDefault();
        void togglePlay();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  });
  const available = useMemo(
    () =>
      palette === "borrowed"
        ? borrowed(section.key, seventh)
        : palette === "secondary"
          ? secondaryDominants(section.key)
          : [
              ...diatonic(section.key, seventh),
              ...harmonicDominants(section.key, seventh),
            ],
    [section.key, seventh, palette],
  );
  const suggested = useMemo(
    () =>
      recommendations(
        selected,
        selected?.analysisKey ?? section.key,
        seventh,
        category,
        mood,
      ).slice(0, 6),
    [selected, section.key, seventh, category, mood],
  );
  const totalChords = song.sections.reduce((n, s) => n + s.chords.length, 0);
  const sectionBeats = section.chords.reduce(
    (total, item) => total + (item.beats ?? song.beats),
    0,
  );
  const bassLine = section.chords.map((e) => pretty(e.chord.bassNote));
  const transition =
    selectedIndex > 0 && selected
      ? cadence(
          section.chords[selectedIndex - 1].chord,
          selected,
          selected.analysisKey ?? section.key,
        )
      : undefined;
  function addSection() {
    const name = sectionName.trim();
    if (!name) return;
    if (renameSection) {
      updateSection({ ...section, name });
    } else {
      const next: Section = {
        id: uid(),
        name,
        key: { ...section.key },
        chords: [],
        melody: [],
      };
      updateSong({ ...song, sections: [...song.sections, next] });
      setSectionId(next.id);
      setSelectedId(null);
    }
    setDialog(null);
  }
  function applyModulation(key: Key, chords: Chord[]) {
    const next: Section = {
      id: uid(),
      name: `転調 · ${pretty(keyName(key))}`,
      key,
      melody: [],
      chords: chords.map((c) =>
        entry(connectionChord(c, section.key, key), "modulation", song.beats),
      ),
    };
    const sections = [...song.sections];
    sections.splice(
      sections.findIndex((s) => s.id === section.id) + 1,
      0,
      next,
    );
    updateSong({ ...song, sections });
    setSectionId(next.id);
    setSelectedId(next.chords.at(-1)?.id ?? null);
    setView("compose");
    notify("転調先のセクションを追加しました");
  }
  function applyConnection(chords: Chord[], targetId: string) {
    const target = song.sections.find((s) => s.id === targetId)!;
    const bridge = chords
      .slice(0, -1)
      .map((c) => entry(c, "sectionConnection", song.beats));
    const sections = song.sections
      .filter((s) => s.id !== targetId)
      .map((s) =>
        s.id === section.id ? { ...s, chords: [...s.chords, ...bridge] } : s,
      );
    sections.splice(sections.findIndex((s) => s.id === section.id) + 1, 0, {
      ...target,
      chords: target.chords.length
        ? target.chords
        : [entry(chords.at(-1)!, "manual", song.beats)],
    });
    updateSong({ ...song, sections });
    setSelectedId(bridge.at(-1)?.id ?? selectedId);
    setView("compose");
    notify("接続コードを追加し、セクションをつなぎました");
  }
  function transposeSong() {
    const from = song.sections[0].key,
      shift = mod(pitch(targetTonic) - pitch(from.tonic));
    const sections = song.sections.map((s, i) => {
      const key = {
        ...s.key,
        tonic:
          i === 0
            ? targetTonic
            : chromaticName(
                pitch(s.key.tonic) + shift,
                targetTonic.includes("b") || targetTonic === "F",
              ),
      };
      return {
        ...s,
        key,
        melody: s.melody?.map((note) => ({
          ...note,
          note: Math.max(0, Math.min(127, note.note + shift)),
        })),
        chords: s.chords.map((e) => ({
          ...e,
          chord: transpose(e.chord, s.key, key),
        })),
      };
    });
    updateSong({ ...song, sections });
    setDialog(null);
    notify("すべてのセクションを移調しました");
  }
  async function copyExport() {
    try {
      await navigator.clipboard.writeText(exportSong(song, exportDegrees));
      notify("クリップボードにコピーしました");
    } catch {
      notify(
        "コピーできませんでした。表示されたテキストを選択してコピーしてください。",
      );
    }
  }
  function downloadExport() {
    const url = URL.createObjectURL(
      new Blob([exportSong(song, exportDegrees)], {
        type: "text/plain;charset=utf-8",
      }),
    );
    const a = document.createElement("a");
    a.href = url;
    a.download = `${song.title || "chord-progression"}.txt`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <div className="app-shell">
      <header className="topbar">
        <a
          className="brand"
          href="#"
          onClick={(e) => {
            e.preventDefault();
            setView("compose");
          }}
        >
          <span className="brand-icon">
            <AudioLines size={23} />
          </span>
          <span>
            Harmo<span className="brand-light">Trail</span>
            <small>コード進行アシスト</small>
          </span>
        </a>
        <div className="topbar-center">
          <span className="status-dot" /> YOUR COMPOSITION SPACE
        </div>
        <div className="header-actions">
          <button
            className="plain-button"
            aria-label="マイソング"
            onClick={() => setDialog("library")}
          >
            <FolderOpen size={17} />
            <span>マイソング</span>
          </button>
          <button
            className="icon-button help-button"
            aria-label="使い方"
            onClick={() => setDialog("help")}
          >
            <CircleHelp size={19} />
          </button>
          <button
            className="outline-button"
            onClick={() => setDialog("export")}
          >
            <ArrowDownToLine size={16} />
            <span>書き出し</span>
          </button>
        </div>
      </header>
      <div className="workspace-heading">
        <div>
          <div className="breadcrumb">
            WORKSPACE <span>/</span> MY COMPOSITION
          </div>
          <div className="song-title-row">
            <input
              aria-label="曲名"
              className="song-title"
              value={song.title}
              maxLength={80}
              onChange={(e) => updateSong({ ...song, title: e.target.value })}
            />
            <span className="song-title-pencil">✎</span>
          </div>
          <p>ひとつずつ選ぶ。聴いてみる。あなたらしい響きが、つながる。</p>
        </div>
        <div className="save-status">
          <Check size={14} />
          {workspace.saveError
            ? "保存を確認してください"
            : "このブラウザに自動保存"}
          <span>
            {totalChords} chords · {song.sections.length} section
            {song.sections.length !== 1 ? "s" : ""}
          </span>
        </div>
      </div>
      {workspace.saveError && (
        <div className="save-error" role="alert">
          {workspace.saveError}
        </div>
      )}
      <main className="workspace-grid">
        <aside className="palette-panel panel">
          <div className="key-area">
            <div className="eyebrow">
              <Music2 size={15} /> KEY & SCALE
            </div>
            <div className="section-heading">
              <h2>キーを選ぶ</h2>
              <button
                className="icon-button"
                title="曲全体を移調"
                aria-label="曲全体を移調"
                onClick={() => {
                  setTargetTonic(section.key.tonic);
                  setDialog("transpose");
                }}
              >
                <Shuffle size={16} />
              </button>
            </div>
            <KeySelect
              value={section.key}
              label="セクションのキー"
              onChange={setKey}
            />
            <div className="scale-notes">
              {scale(section.key).map((n, i) => (
                <span key={i} className={i === 0 ? "scale-root" : ""}>
                  {pretty(n)}
                </span>
              ))}
            </div>
          </div>
          <div className="palette-area">
            <div className="section-heading">
              <h2>使えるコード</h2>
              <span className="tiny-label">CHORDS</span>
            </div>
            <div className="segmented">
              <button
                className={!seventh ? "active" : ""}
                onClick={() => setSeventh(false)}
              >
                Triad
              </button>
              <button
                className={seventh ? "active" : ""}
                onClick={() => setSeventh(true)}
              >
                7th
              </button>
            </div>
            <select
              aria-label="コード一覧の種類"
              className="palette-select"
              value={palette}
              onChange={(e) => setPalette(e.target.value)}
            >
              <option value="diatonic">ダイアトニック</option>
              <option value="borrowed">借用和音</option>
              <option value="secondary">セカンダリードミナント</option>
            </select>
            <div className="palette-chords">
              {available.map((c, i) => (
                <div
                  className={`palette-chord ${functionClass(c)}`}
                  key={`${chordName(c)}-${i}`}
                >
                  <button
                    className="palette-add"
                    aria-label={`${chordName(c)}を追加`}
                    onClick={() => addChord(c)}
                  >
                    <span className="palette-degree">{c.degree}</span>
                    <span className="palette-name">
                      {pretty(chordName(c))}
                      <small>{functionShort(c)}</small>
                    </span>
                    <Plus size={15} />
                  </button>
                  <button
                    className="palette-play"
                    aria-label={`${chordName(c)}を試聴`}
                    onClick={() => void preview(c)}
                  >
                    <Play size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button
              className="custom-chord-button"
              onClick={() => setDialog("custom")}
            >
              <Plus size={15} /> 自由なコード・テンション
            </button>
            <p className="micro-copy palette-hint">
              コードを押すと進行に追加。
              <br />▷ で響きを確かめられます。
            </p>
          </div>
          <div className="function-legend">
            <span>
              <i className="tonic-dot" />
              Tonic
            </span>
            <span>
              <i className="predominant-dot" />
              Subdominant
            </span>
            <span>
              <i className="dominant-dot" />
              Dominant
            </span>
          </div>
        </aside>
        <div className="composition-column">
          <section className="editor-panel panel">
            <div className="editor-topline">
              <div className="eyebrow">
                <ListMusic size={15} /> YOUR PROGRESSION
              </div>
              <div className="history-actions">
                <button
                  className="icon-button"
                  aria-label="元に戻す"
                  title="元に戻す ⌘Z / Ctrl+Z"
                  disabled={!workspace.canUndo}
                  onClick={undo}
                >
                  <Undo2 size={17} />
                </button>
                <button
                  className="icon-button"
                  aria-label="やり直す"
                  disabled={!workspace.canRedo}
                  onClick={redo}
                >
                  <Redo2 size={17} />
                </button>
                <span className="vertical-divider" />
                <button
                  className="icon-button"
                  aria-label="セクション名を変更"
                  onClick={() => {
                    setRenameSection(true);
                    setSectionName(section.name);
                    setDialog("section");
                  }}
                >
                  <Ellipsis size={19} />
                </button>
              </div>
            </div>
            <div
              className="sections-bar"
              role="tablist"
              aria-label="曲のセクション"
            >
              {song.sections.map((s, i) => (
                <button
                  role="tab"
                  aria-selected={section.id === s.id}
                  key={s.id}
                  className={`section-tab ${section.id === s.id ? "active" : ""}`}
                  onClick={() => chooseSection(s)}
                >
                  <span className="section-number">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  {s.name}
                  <span className="section-count">{s.chords.length}</span>
                  {s.chords.some((e) => e.id === playingId) && (
                    <span className="playing-dot" />
                  )}
                </button>
              ))}
              <button
                className="add-section"
                aria-label="セクションを追加"
                onClick={() => {
                  setRenameSection(false);
                  setSectionName(
                    ["Aメロ", "Bメロ", "サビ", "Bridge", "Outro"][
                      Math.min(song.sections.length, 4)
                    ],
                  );
                  setDialog("section");
                }}
              >
                <Plus size={18} />
              </button>
            </div>
            <div className="progression-toolbar">
              <span>
                {pretty(keyName(section.key))}
                <i /> {section.chords.length} chords <i /> 合計
                {sectionBeats}拍
              </span>
              <button
                className={`text-button ${editMode === "replace" ? "accent-text" : ""}`}
                disabled={!selected}
                onClick={() =>
                  setEditMode(editMode === "replace" ? "append" : "replace")
                }
              >
                <Repeat2 size={13} />
                {editMode === "replace"
                  ? "置換をキャンセル"
                  : "選択コードを置換"}
              </button>
            </div>
            {editMode === "replace" && (
              <div className="replace-banner">
                一覧や候補から、置き換えるコードを選んでください。
              </div>
            )}
            {section.chords.length ? (
              <div className="progression-cards">
                {section.chords.map(({ id, chord: c, beats }, i) => (
                  <article
                    key={id}
                    draggable
                    className={`progression-card ${functionClass(c)} ${selectedId === id ? "selected" : ""} ${playingId === id ? "is-playing" : ""}`}
                    onDragStart={(e) => {
                      dragId.current = id;
                      e.dataTransfer.effectAllowed = "move";
                      e.dataTransfer.setData("text/plain", id);
                    }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => {
                      e.preventDefault();
                      if (dragId.current) moveChord(dragId.current, i);
                      dragId.current = null;
                    }}
                    onDragEnd={() => {
                      dragId.current = null;
                    }}
                  >
                    <div className="card-top">
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      <GripVertical size={13} />
                    </div>
                    <button
                      className="select-chord"
                      aria-label={`進行${i + 1}: ${chordName(c)}を選択`}
                      aria-pressed={selectedId === id}
                      onClick={() => {
                        setSelectedId(id);
                      }}
                    >
                      <strong>{pretty(chordName(c))}</strong>
                      <span>{c.degree}</span>
                      <small>{functionShort(c)}</small>
                    </button>
                    <label className="card-beats">
                      <span>長さ</span>
                      <select
                        aria-label={`${i + 1}番目のコードの拍数`}
                        value={beats ?? song.beats}
                        onPointerDown={(e) => e.stopPropagation()}
                        onChange={(e) =>
                          changeChordBeats(id, Number(e.target.value))
                        }
                      >
                        {[1, 2, 3, 4, 6, 8].map((n) => (
                          <option key={n} value={n}>
                            {n}拍
                          </option>
                        ))}
                      </select>
                    </label>
                    <div className="card-actions">
                      <button
                        aria-label={`${i + 1}番目を左へ移動`}
                        disabled={i === 0}
                        onClick={() => moveChord(id, i - 1)}
                      >
                        <ArrowLeft size={12} />
                      </button>
                      <button
                        aria-label={`${i + 1}番目を試聴`}
                        onClick={() => void preview(c)}
                      >
                        <Play size={12} />
                      </button>
                      <button
                        aria-label={`${i + 1}番目を右へ移動`}
                        disabled={i === section.chords.length - 1}
                        onClick={() => moveChord(id, i + 1)}
                      >
                        <ArrowRight size={12} />
                      </button>
                      <button
                        aria-label={`${i + 1}番目を削除`}
                        onClick={() => removeChord(id)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                  </article>
                ))}
                <button
                  className="next-slot"
                  onClick={() => {
                    setSelectedId(section.chords.at(-1)?.id ?? null);
                    setEditMode("append");
                    document
                      .getElementById("suggestions")
                      ?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }}
                >
                  <Plus size={22} />
                  <span>次のコード</span>
                </button>
              </div>
            ) : (
              <div className="empty-state">
                <Music2 size={32} />
                <h3>最初の響きから、はじめよう。</h3>
                <p>下の候補やコード一覧から、好きなコードを選んでください。</p>
                <button
                  className="primary-button"
                  onClick={() => addChord(diatonic(section.key, seventh)[0])}
                >
                  {pretty(chordName(diatonic(section.key, seventh)[0]))}{" "}
                  からはじめる <ArrowRight size={16} />
                </button>
              </div>
            )}
            <MelodyEditor
              key={section.id}
              notes={section.melody ?? []}
              totalBeats={sectionBeats}
              onChange={updateMelody}
            />
            <div className="bass-line">
              <AudioLines size={15} />
              <span>BASS</span>
              <div>
                {bassLine.length
                  ? bassLine.join("  →  ")
                  : "まだコードがありません"}
              </div>
              <small>{transition ?? "選択して、響きを確かめよう"}</small>
            </div>
          </section>
          <nav className="view-tabs" aria-label="作曲サポート">
            <button
              className={view === "presets" ? "active" : ""}
              onClick={() => setView("presets")}
            >
              <ListMusic size={16} />
              定番進行
            </button>
            <button
              className={view === "compose" ? "active" : ""}
              onClick={() => setView("compose")}
            >
              <Sparkles size={16} />
              次のコード
            </button>
            <button
              className={view === "connect" ? "active" : ""}
              onClick={() => setView("connect")}
            >
              <Link2 size={16} />
              セクション接続
            </button>
            <button
              className={view === "modulate" ? "active" : ""}
              onClick={() => setView("modulate")}
            >
              <GitBranch size={16} />
              転調を探す
            </button>
          </nav>
          <section className="suggestions-panel panel" id="suggestions">
            {view === "compose" ? (
              <>
                <div className="section-heading">
                  <div>
                    <div className="eyebrow">FIND YOUR NEXT CHORD</div>
                    <h2>
                      {selected ? (
                        <>
                          {pretty(chordName(selected))}
                          <span className="heading-arrow">
                            から、次の響きへ
                          </span>
                        </>
                      ) : (
                        "最初のコードを選ぶ"
                      )}
                    </h2>
                  </div>
                  <span className="theory-badge">
                    <Sparkles size={12} />
                    音楽理論のヒント
                  </span>
                </div>
                <p className="suggestion-intro">
                  {selected
                    ? "気になる響きを試聴して、あなたの進行につなげましょう。"
                    : "主調を感じる響きからも、意外な響きからも。自由に始められます。"}
                </p>
                {selected?.analysisKey &&
                  keyName(selected.analysisKey) !== keyName(section.key) && (
                    <p className="micro-copy">
                      接続先の {pretty(keyName(selected.analysisKey))}{" "}
                      として候補を表示しています。
                    </p>
                  )}
                <div className="recommendation-filters">
                  <div className="filter-chips">
                    {[
                      "すべて",
                      "ダイアトニック",
                      "借用和音",
                      "セカンダリードミナント",
                    ].map((c) => (
                      <button
                        key={c}
                        className={category === c ? "active" : ""}
                        onClick={() => setCategory(c)}
                      >
                        {c === "セカンダリードミナント" ? "Secondary V" : c}
                      </button>
                    ))}
                  </div>
                  <label className="mood-select">
                    <Settings2 size={13} />
                    <select
                      aria-label="候補の雰囲気"
                      value={mood}
                      onChange={(e) => setMood(e.target.value as Mood)}
                    >
                      {MOODS.map((m) => (
                        <option key={m} value={m}>
                          {m === "すべて" ? "雰囲気から探す" : m}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                {mood !== "すべて" && (
                  <p className="micro-copy mood-note">
                    「{mood}
                    」を感じやすい候補を優先しています。印象はテンポや前後の響きでも変わります。
                  </p>
                )}
                <div className="recommendation-grid">
                  {suggested.map((r, i) => (
                    <article
                      className={`recommendation-card ${functionClass(r.chord)}`}
                      key={`${chordName(r.chord)}-${r.chord.source}`}
                    >
                      <div className="recommendation-top">
                        <span
                          className={`recommendation-category ${r.category === "強い解決" ? "strong-resolution" : ""}`}
                        >
                          {r.category === "強い解決" && <Sparkles size={11} />}{" "}
                          {r.category}
                        </span>
                        {i === 0 && category === "すべて" && (
                          <span className="recommended-label">おすすめ</span>
                        )}
                      </div>
                      <div className="recommendation-name">
                        <div>
                          <strong>{pretty(chordName(r.chord))}</strong>
                          <span>{r.chord.degree}</span>
                        </div>
                        <button
                          className="mini-play"
                          aria-label={`候補${chordName(r.chord)}を試聴`}
                          onClick={() => void preview(r.chord)}
                        >
                          <Play size={14} />
                        </button>
                      </div>
                      <div
                        className={`small-function ${functionClass(r.chord)}`}
                      >
                        <i />
                        {functionShort(r.chord)}
                      </div>
                      <ol className="reason-list">
                        {r.explanations.map((reason) => (
                          <li key={reason.id}>
                            <strong>{reason.title}</strong>
                            <span>{reason.explanation}</span>
                          </li>
                        ))}
                      </ol>
                      <button
                        className="add-recommendation"
                        aria-label={`候補${chordName(r.chord)}を${editMode === "replace" ? "置換" : "追加"}`}
                        onClick={() => addChord(r.chord, "recommendation")}
                      >
                        <Plus size={14} />
                        {editMode === "replace"
                          ? "このコードに置き換え"
                          : "進行に追加"}
                      </button>
                    </article>
                  ))}
                </div>
                <div className="gentle-note">
                  <Lightbulb size={17} />
                  <p>
                    理論は、選択肢を広げるためのヒント。
                    <br className="mobile-break" />{" "}
                    最後に決めるのは、あなたの耳です。
                  </p>
                </div>
              </>
            ) : view === "presets" ? (
              <Presets
                musicKey={section.key}
                preview={(chords) => void previewRoute(chords)}
                apply={(chords, replace) => {
                  const added = chords.map((c) =>
                    entry(c, "preset", song.beats),
                  );
                  updateSection({
                    ...section,
                    chords: replace ? added : [...section.chords, ...added],
                  });
                  setSelectedId(added.at(-1)?.id ?? null);
                  notify(
                    replace
                      ? "セクションを定番進行に置き換えました。元に戻すこともできます。"
                      : "定番進行を追加しました",
                  );
                }}
              />
            ) : view === "connect" ? (
              <Connections
                key={section.id}
                section={section}
                sections={song.sections}
                preview={(chords) => void previewRoute(chords)}
                apply={applyConnection}
              />
            ) : (
              <Modulation
                key={`${section.id}-${keyName(section.key)}`}
                section={section}
                preview={(chords) => void previewRoute(chords)}
                apply={applyModulation}
              />
            )}
          </section>
          <div className="workspace-footnote">
            <span>
              <Headphones size={13} />
              ヘッドホンで、響きの違いをもっと。
            </span>
            <span>MADE FOR YOUR MUSICAL IDEAS</span>
          </div>
        </div>
        <ChordDetail
          chord={selected}
          previous={section.chords[selectedIndex - 1]?.chord}
          musicKey={selected?.analysisKey ?? section.key}
          preview={(c) => void preview(c)}
          change={changeSelected}
        />
      </main>
      <footer className="transport">
        <div className="transport-song">
          <span
            className={`transport-icon ${playState === "playing" ? "active" : ""}`}
          >
            <AudioLines size={21} />
          </span>
          <div>
            <strong>{song.title || "無題のスケッチ"}</strong>
            <small>
              {scope === "song" ? "曲全体" : section.name} <span>·</span>{" "}
              {playState === "playing"
                ? "再生中"
                : playState === "paused"
                  ? "一時停止中"
                  : "いつでも、試してみよう"}
            </small>
          </div>
        </div>
        <div className="transport-main">
          <div className="playback-buttons">
            <button className="icon-button" aria-label="停止" onClick={stop}>
              <Square size={17} />
            </button>
            <button
              className="main-play"
              aria-label={
                playState === "playing"
                  ? "一時停止"
                  : playState === "paused"
                    ? "再開"
                    : "コード進行を再生"
              }
              disabled={
                !(scope === "song" ? totalChords : section.chords.length)
              }
              onClick={() => void togglePlay()}
            >
              {playState === "playing" ? (
                <Pause size={19} fill="currentColor" />
              ) : (
                <Play size={19} fill="currentColor" />
              )}
            </button>
            <button
              className={`icon-button loop-button ${song.loop ? "active" : ""}`}
              aria-label="ループ再生"
              aria-pressed={song.loop}
              onClick={() => updateSong({ ...song, loop: !song.loop })}
            >
              <Repeat2 size={19} />
            </button>
          </div>
          <span className="transport-divider" />
          <label className="bpm-control">
            <input
              aria-label="BPM"
              type="number"
              min={30}
              max={240}
              inputMode="numeric"
              value={bpmDraft}
              onChange={(e) => setBpmDraft(e.target.value)}
              onBlur={commitBpm}
              onKeyDown={(e) => {
                if (e.key === "Enter") e.currentTarget.blur();
              }}
            />
            <span>BPM</span>
          </label>
          <label className="beats-control">
            <select
              aria-label="追加するコードの標準拍数"
              value={song.beats}
              onChange={(e) =>
                updateSong({ ...song, beats: Number(e.target.value) })
              }
            >
              {[1, 2, 3, 4, 6, 8].map((n) => (
                <option key={n} value={n}>
                  {n} 拍
                </option>
              ))}
            </select>
            <span>追加時</span>
          </label>
          <select
            className="pattern-select"
            aria-label="再生パターン"
            value={song.pattern}
            onChange={(e) =>
              updateSong({
                ...song,
                pattern: e.target.value as Song["pattern"],
              })
            }
          >
            <option value="block">Block Chord</option>
            <option value="arpeggio">Arpeggio</option>
          </select>
          <select
            className="rhythm-select"
            aria-label="メトロノーム・ドラムパターン"
            value={song.rhythm ?? "off"}
            onChange={(e) =>
              updateSong({
                ...song,
                rhythm: e.target.value as NonNullable<Song["rhythm"]>,
              })
            }
          >
            <option value="off">Rhythm Off</option>
            <option value="metronome">Metronome</option>
            <option value="twoBeat">Drums · 2 Beat</option>
            <option value="fourBeat">Drums · 4 Beat</option>
            <option value="eightBeat">Drums · 8 Beat</option>
          </select>
        </div>
        <div className="transport-extra">
          <button
            className="sound-button outline-button"
            aria-label="音源・MIDI設定"
            onClick={() => setDialog("sound")}
          >
            <Headphones size={16} />
            <span>{sound.effectiveSource === "midi" ? "MIDI" : "Piano"}</span>
          </button>
          <select
            aria-label="再生範囲"
            value={scope}
            onChange={(e) => {
              stop();
              setScope(e.target.value);
            }}
          >
            <option value="section">このセクション</option>
            <option value="song">曲全体</option>
          </select>
          <Volume2 size={17} />
          <input
            aria-label="音量"
            type="range"
            min={0}
            max={1}
            step={0.01}
            value={volume}
            onChange={(e) => {
              setVolume(Number(e.target.value));
              audio().setVolume(Number(e.target.value));
            }}
          />
        </div>
      </footer>
      {audioLoading && (
        <div className="loading-audio" role="status">
          音源を準備しています…
        </div>
      )}
      {toast && (
        <div className="toast" role="status">
          <Check size={17} />
          {toast}
        </div>
      )}
      {dialog === "library" && (
        <Modal title="マイソング" onClose={() => setDialog(null)}>
          <p className="muted">
            曲はこのブラウザに保存されます。大切な進行は書き出して保管できます。
          </p>
          <div className="song-library">
            {workspace.songs.map((s) => (
              <div
                className={`library-song ${s.id === song.id ? "active" : ""}`}
                key={s.id}
              >
                <button
                  onClick={() => {
                    stop();
                    workspace.select(s.id);
                    setSectionId(s.sections[0].id);
                    setSelectedId(s.sections[0].chords.at(-1)?.id ?? null);
                    setDialog(null);
                  }}
                >
                  <Music2 size={21} />
                  <span>
                    <strong>{s.title || "無題のスケッチ"}</strong>
                    <small>
                      {keyName(s.sections[0].key)} · {s.sections.length}
                      セクション · {s.bpm} BPM
                    </small>
                  </span>
                  {s.id === song.id && <Check size={16} />}
                </button>
                <button
                  className="icon-button danger"
                  aria-label={`${s.title}を削除`}
                  onClick={() =>
                    setDeleteTarget({ type: "song", id: s.id, name: s.title })
                  }
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
          <button
            className="primary-button full-width"
            onClick={() => {
              stop();
              workspace.create();
              setSelectedId(null);
              setDialog(null);
              setView("compose");
            }}
          >
            <Plus size={17} />
            新しい曲をつくる
          </button>
        </Modal>
      )}
      {dialog === "export" && (
        <Modal title="コード進行を書き出す" onClose={() => setDialog(null)}>
          <div className="segmented export-switch">
            <button
              className={!exportDegrees ? "active" : ""}
              onClick={() => setExportDegrees(false)}
            >
              コード名
            </button>
            <button
              className={exportDegrees ? "active" : ""}
              onClick={() => setExportDegrees(true)}
            >
              Degree表記
            </button>
          </div>
          <textarea
            className="export-text"
            aria-label="書き出すコード進行"
            readOnly
            value={exportSong(song, exportDegrees)}
            rows={13}
          />
          <div className="modal-actions">
            <button className="outline-button" onClick={downloadExport}>
              <Download size={16} />
              テキストを保存
            </button>
            <button
              className="primary-button"
              onClick={() => void copyExport()}
            >
              <Copy size={16} />
              コピー
            </button>
          </div>
          <div className="midi-export">
            <h3>MIDIでDAWへ</h3>
            <p className="micro-copy">
              コード進行を「Chords」、メロディを「Melody」、選択中のリズムを「Drums」の別トラックで書き出します。ループは1周分、拍子は4/4、分解能は480
              PPQです。
            </p>
            <label className="field-label">
              書き出す範囲
              <select
                aria-label="MIDI書き出し範囲"
                value={scope}
                onChange={(e) => {
                  stop();
                  setScope(e.target.value);
                }}
              >
                <option value="section">現在のセクション</option>
                <option value="song">曲全体</option>
              </select>
            </label>
            <button
              className="primary-button full-width"
              disabled={
                scope === "song" ? !totalChords : !section.chords.length
              }
              onClick={() => {
                downloadMidi(
                  createSongPlaybackEvents(
                    scope === "song" ? song.sections : [section],
                    {
                      beats: song.beats,
                      pattern: song.pattern,
                      rhythm: song.rhythm ?? "off",
                      velocity: sound.settings.velocity,
                    },
                  ),
                  song.bpm,
                  `${song.title}${scope === "section" ? `-${section.name}` : ""}`,
                  sound.settings.midiChannel,
                );
                notify("MIDIファイルを書き出しました");
              }}
            >
              <Download size={16} />
              MIDIファイルを保存
            </button>
          </div>
        </Modal>
      )}
      {dialog === "sound" && (
        <Modal title="音源・MIDI設定" onClose={() => setDialog(null)}>
          <SoundSettings
            sound={sound}
            testNote={() => void testNote()}
            panic={() => {
              stop();
              notify("すべてのノートを停止しました");
            }}
          />
        </Modal>
      )}
      {dialog === "transpose" && (
        <Modal title="曲全体を移調する" onClose={() => setDialog(null)}>
          <p className="muted">
            すべてのセクションを同じ半音数だけ移調します。度数、転回形、各セクションの長調・短調の関係は維持されます。
          </p>
          <div className="transpose-control">
            <strong>{pretty(keyName(song.sections[0].key))}</strong>
            <ArrowRight size={20} />
            <select
              aria-label="移調先の主音"
              value={targetTonic}
              onChange={(e) => setTargetTonic(e.target.value)}
            >
              {KEY_OPTIONS.map((k) => (
                <option key={k} value={k}>
                  {pretty(k)}{" "}
                  {song.sections[0].key.mode === "major" ? "Major" : "Minor"}
                </option>
              ))}
            </select>
          </div>
          <div className="transpose-preview">
            {song.sections[0].chords
              .slice(0, 8)
              .map((e) =>
                pretty(
                  chordName(
                    transpose(e.chord, song.sections[0].key, {
                      ...song.sections[0].key,
                      tonic: targetTonic,
                    }),
                  ),
                ),
              )
              .join(" → ") || "コード追加前でもキーを変更できます"}
          </div>
          <button className="primary-button full-width" onClick={transposeSong}>
            <Shuffle size={16} />
            このキーへ移調
          </button>
        </Modal>
      )}
      {dialog === "section" && (
        <Modal
          title={renameSection ? "セクションを編集" : "セクションを追加"}
          onClose={() => setDialog(null)}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSection();
            }}
          >
            <label className="field-label">
              セクション名
              <input
                autoFocus
                value={sectionName}
                maxLength={40}
                onChange={(e) => setSectionName(e.target.value)}
                placeholder="例：サビ"
                required
              />
            </label>
            <div className="filter-chips section-presets">
              {[
                "Intro",
                "Aメロ",
                "Bメロ",
                "サビ",
                "Cメロ",
                "Bridge",
                "Outro",
              ].map((name) => (
                <button
                  type="button"
                  key={name}
                  onClick={() => setSectionName(name)}
                >
                  {name}
                </button>
              ))}
            </div>
            <div className="modal-actions">
              {renameSection && (
                <button
                  className="text-button danger"
                  type="button"
                  disabled={song.sections.length <= 1}
                  onClick={() =>
                    setDeleteTarget({
                      type: "section",
                      id: section.id,
                      name: section.name,
                    })
                  }
                >
                  <Trash2 size={15} />
                  削除
                </button>
              )}
              <button className="primary-button" type="submit">
                {renameSection ? "変更を保存" : "追加する"}
                <Check size={16} />
              </button>
            </div>
          </form>
        </Modal>
      )}
      {dialog === "custom" && (
        <Modal title="自由な響きを加える" onClose={() => setDialog(null)}>
          <p className="muted">
            キー外のコードやテンションも自由に選べます。響きは試聴して確かめましょう。
          </p>
          <div className="custom-controls">
            <label className="field-label">
              ルート
              <select
                value={customRoot}
                onChange={(e) => setCustomRoot(e.target.value)}
              >
                {KEY_OPTIONS.map((k) => (
                  <option key={k} value={k}>
                    {pretty(k)}
                  </option>
                ))}
              </select>
            </label>
            <label className="field-label">
              コードの種類
              <select
                value={customQuality}
                onChange={(e) => setCustomQuality(e.target.value as Quality)}
              >
                {(Object.keys(QUALITIES) as Quality[]).map((q) => (
                  <option key={q} value={q}>
                    {q === "major"
                      ? "Major"
                      : q === "minor"
                        ? "Minor"
                        : QUALITIES[q].suffix}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="custom-preview">
            <strong>
              {pretty(chordName(makeChord(customRoot, customQuality)))}
            </strong>
            <span>
              {makeChord(customRoot, customQuality)
                .notes.map(pretty)
                .join(" · ")}
            </span>
            <small>
              {
                SOURCE_LABELS[
                  classify(customRoot, customQuality, section.key).source
                ]
              }
            </small>
          </div>
          <div className="modal-actions">
            <button
              className="outline-button"
              onClick={() => void preview(makeChord(customRoot, customQuality))}
            >
              <Play size={15} />
              試聴
            </button>
            <button
              className="primary-button"
              onClick={() => {
                addChord(classify(customRoot, customQuality, section.key));
                setDialog(null);
              }}
            >
              <Plus size={16} />
              {editMode === "replace" ? "置き換える" : "進行に追加"}
            </button>
          </div>
        </Modal>
      )}
      {dialog === "help" && (
        <Modal
          title="あなたの耳で選ぶ、作曲ワークスペース"
          onClose={() => setDialog(null)}
        >
          <div className="help-content">
            <BookOpen size={30} />
            <p>
              ①
              キーとセクションを選び、コード一覧や候補を押して追加します。最初に表示される進行は、すぐ試聴できるサンプルです。
            </p>
            <p>
              ②
              コードを選ぶと構成音・転回形と次の候補が変わります。追加位置は選択コードの直後。「置換」で差し替えもできます。
            </p>
            <p>
              ③ カードをドラッグ、または矢印ボタンで並び替え。⌘Z / Ctrl+Z
              で元に戻せます。空白部分にフォーカスした状態で Space
              を押すと再生・一時停止できます。
            </p>
            <p>
              ④
              セクション接続・転調のタブから、曲の展開を作れます。曲全体の再生は下の再生範囲で切り替えます。
            </p>
            <div className="voice-tip">
              <Lightbulb size={18} />
              <p>
                推薦は機能和声、共通音、声部の移動などから計算しています。終止はコードの組み合わせからの「候補」で、実際の成立は旋律や拍位置にもよります。短調の自然短音階のv・VIIは、導音を持つV・vii°より解決力が弱くなります。
              </p>
            </div>
            <p>
              理論の参考：
              <a
                href="https://viva.pressbooks.pub/openmusictheory/chapter/modal-mixture/"
                target="_blank"
                rel="noreferrer"
              >
                Open Music Theory — Modal Mixture
              </a>
              、
              <a
                href="https://openmusictheory.github.io/appliedChords.html"
                target="_blank"
                rel="noreferrer"
              >
                Applied Chords
              </a>
              。
            </p>
            <p className="micro-copy">
              保存はこのブラウザ・このURL内のみです。別の端末との同期はありません。音源はサンプルベースのピアノです。再生エリアの「Piano」から外部MIDIも選べます。「書き出し」ではテキストとMIDIを保存できます。
            </p>
          </div>
        </Modal>
      )}
      {deleteTarget && (
        <Modal
          title={`「${deleteTarget.name}」を削除しますか？`}
          onClose={() => setDeleteTarget(null)}
        >
          <p className="muted">
            {deleteTarget.type === "song"
              ? "この曲をブラウザの保存領域から削除します。曲の削除は取り消せません。"
              : "セクション内のコードも削除します。「元に戻す」で復元できます。"}
          </p>
          <div className="modal-actions">
            <button
              className="outline-button"
              onClick={() => setDeleteTarget(null)}
            >
              キャンセル
            </button>
            <button
              className="danger-button"
              onClick={() => {
                stop();
                if (deleteTarget.type === "song")
                  workspace.remove(deleteTarget.id);
                else
                  updateSong({
                    ...song,
                    sections: song.sections.filter(
                      (s) => s.id !== deleteTarget.id,
                    ),
                  });
                setDeleteTarget(null);
                setDialog(null);
                setSelectedId(null);
                notify("削除しました");
              }}
            >
              <Trash2 size={15} />
              削除する
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

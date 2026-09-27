import { useEffect, useState } from "react";
import type { Chord, ChordEntry, Key, Song } from "../music/types";
import { withFunction } from "../music/functions";
import { diatonic, QUALITIES } from "../music/chords";
export const uid = (): string => crypto.randomUUID();
export const entry = (
  chord: Chord,
  origin: ChordEntry["origin"] = "manual",
): ChordEntry => ({ id: uid(), chord, origin });
export const STORAGE_KEY = "chord-canvas.workspace.v1";
export function newSong(sample = false): Song {
  const key: Key = { tonic: "C", mode: "major" };
  const chords = diatonic(key, true);
  return {
    id: uid(),
    title: sample ? "はじまりのスケッチ" : "無題のスケッチ",
    sections: [
      {
        id: uid(),
        name: "Aメロ",
        key,
        chords: sample
          ? [chords[0], chords[5], chords[3], chords[4]].map((c) => entry(c))
          : [],
      },
    ],
    bpm: 90,
    beats: 4,
    pattern: "block",
    loop: true,
    updatedAt: new Date().toISOString(),
  };
}
export function validSong(value: unknown): value is Song {
  if (!value || typeof value !== "object") return false;
  const s = value as Song;
  return (
    typeof s.id === "string" &&
    typeof s.title === "string" &&
    Number.isFinite(s.bpm) &&
    s.bpm >= 30 &&
    s.bpm <= 240 &&
    [1, 2, 3, 4, 6, 8].includes(s.beats) &&
    ["block", "arpeggio"].includes(s.pattern) &&
    typeof s.loop === "boolean" &&
    typeof s.updatedAt === "string" &&
    Array.isArray(s.sections) &&
    s.sections.length > 0 &&
    s.sections.every(
      (section) =>
        !!section &&
        typeof section.id === "string" &&
        typeof section.name === "string" &&
        section.key &&
        /^[A-G][#b]{0,2}$/.test(section.key.tonic) &&
        ["major", "minor"].includes(section.key.mode) &&
        Array.isArray(section.chords) &&
        section.chords.every(
          (e) =>
            e &&
            typeof e.id === "string" &&
            e.chord &&
            /^[A-G][#b]{0,3}$/.test(e.chord.root) &&
            Object.hasOwn(QUALITIES, e.chord.quality) &&
            Array.isArray(e.chord.notes) &&
            e.chord.notes.length ===
              QUALITIES[e.chord.quality].intervals.length &&
            e.chord.notes.every(
              (n) => typeof n === "string" && /^[A-G][#b]{0,3}$/.test(n),
            ) &&
            Number.isInteger(e.chord.inversion) &&
            e.chord.inversion >= 0 &&
            e.chord.inversion < e.chord.notes.length &&
            typeof e.chord.bassNote === "string" &&
            typeof e.chord.degree === "string" &&
            ["Tonic", "Predominant", "Dominant"].includes(e.chord.function),
        ),
    )
  );
}
interface Workspace {
  songs: Song[];
  activeId: string;
  recovered?: boolean;
}
function loadWorkspace(): Workspace {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (
        parsed.version === 1 &&
        Array.isArray(parsed.songs) &&
        parsed.songs.length &&
        parsed.songs.every(validSong)
      )
        return {
          songs: parsed.songs.map((song: Song) => ({
            ...song,
            sections: song.sections.map((s) => ({
              ...s,
              chords: s.chords.map((e) => ({
                ...e,
                chord: e.chord.functionStrength
                  ? e.chord
                  : withFunction(e.chord, e.chord.analysisKey ?? s.key),
              })),
            })),
          })),
          activeId: parsed.songs.some((s: Song) => s.id === parsed.activeId)
            ? parsed.activeId
            : parsed.songs[0].id,
        };
      const song = newSong();
      return { songs: [song], activeId: song.id, recovered: true };
    }
  } catch {
    const song = newSong();
    return { songs: [song], activeId: song.id, recovered: true };
  }
  const song = newSong(true);
  return { songs: [song], activeId: song.id };
}
export function useWorkspace() {
  const [workspace, setWorkspace] = useState<Workspace>(loadWorkspace);
  const [past, setPast] = useState<Song[]>([]);
  const [future, setFuture] = useState<Song[]>([]);
  const [saveError, setSaveError] = useState("");
  const song = workspace.songs.find((s) => s.id === workspace.activeId)!;
  const [dirty, setDirty] = useState(false);
  useEffect(() => {
    if (workspace.recovered && !dirty) {
      setSaveError(
        "保存データを読み込めませんでした。元のデータは保持しています。編集を始めると新しく保存します。",
      );
      return;
    }
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ version: 1, ...workspace }),
      );
      setSaveError("");
    } catch {
      setSaveError(
        "ブラウザに保存できません。テキストを書き出して保管してください。",
      );
    }
  }, [workspace, dirty]);
  function put(updated: Song) {
    setWorkspace((w) => ({
      ...w,
      songs: w.songs.map((s) => (s.id === updated.id ? updated : s)),
    }));
    setDirty(true);
  }
  function update(next: Song) {
    setPast((p) => [...p.slice(-79), song]);
    setFuture([]);
    put({ ...next, updatedAt: new Date().toISOString() });
  }
  function undo() {
    const last = past.at(-1);
    if (!last) return;
    setFuture((f) => [...f, song]);
    setPast((p) => p.slice(0, -1));
    put(last);
  }
  function redo() {
    const next = future.at(-1);
    if (!next) return;
    setPast((p) => [...p, song]);
    setFuture((f) => f.slice(0, -1));
    put(next);
  }
  function select(id: string) {
    setWorkspace((w) => ({ ...w, activeId: id }));
    setPast([]);
    setFuture([]);
  }
  function create() {
    const next = newSong();
    setWorkspace((w) => ({ songs: [...w.songs, next], activeId: next.id }));
    setPast([]);
    setFuture([]);
    setDirty(true);
  }
  function remove(id: string) {
    const remaining = workspace.songs.filter((s) => s.id !== id);
    const songs = remaining.length ? remaining : [newSong()];
    setWorkspace({
      songs,
      activeId: songs.some((s) => s.id === workspace.activeId)
        ? workspace.activeId
        : songs[0].id,
    });
    setPast([]);
    setFuture([]);
    setDirty(true);
  }
  return {
    song,
    songs: workspace.songs,
    update,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    select,
    create,
    remove,
    saveError,
  };
}
export function exportSong(song: Song, degrees = false): string {
  return (
    `${song.title}\nBPM: ${song.bpm} / ${song.beats}拍\n\n` +
    song.sections
      .map(
        (section) =>
          `Key: ${section.key.tonic} ${section.key.mode === "major" ? "Major" : "Minor"}\n[${section.name}]\n` +
          section.chords
            .map(({ chord: c }) =>
              degrees
                ? c.degree +
                  (c.inversion
                    ? `/${QUALITIES[c.quality].steps[c.inversion] + 1}`
                    : "") +
                  (c.analysisKey &&
                  (c.analysisKey.tonic !== section.key.tonic ||
                    c.analysisKey.mode !== section.key.mode)
                    ? ` (${c.analysisKey.tonic} ${c.analysisKey.mode})`
                    : "")
                : c.root +
                  QUALITIES[c.quality].suffix +
                  (c.inversion ? "/" + c.bassNote : ""),
            )
            .join(" | "),
      )
      .join("\n\n")
  );
}

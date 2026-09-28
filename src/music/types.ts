export type Mode = "major" | "minor";
export type MinorVariant = "natural" | "harmonic" | "melodic";
export interface Key {
  tonic: string;
  mode: Mode;
}
export type HarmonicFunction = "Tonic" | "Predominant" | "Dominant";
export type Quality =
  | "major"
  | "minor"
  | "dim"
  | "aug"
  | "maj7"
  | "7"
  | "m7"
  | "m7b5"
  | "dim7"
  | "mMaj7"
  | "augMaj7"
  | "sus2"
  | "sus4"
  | "add9"
  | "maj9"
  | "m9"
  | "9"
  | "11"
  | "13";
export type ChordSource =
  | "diatonic"
  | "harmonicMinor"
  | "borrowed"
  | "secondaryDominant"
  | "custom"
  | "modulation";
export interface Chord {
  root: string;
  quality: Quality;
  notes: string[];
  bassNote: string;
  degree: string;
  degreeIndex: number;
  function: HarmonicFunction;
  inversion: number;
  extensions: string[];
  source: ChordSource;
  targetRoot?: string;
  functionStrength?: "weak" | "normal" | "strong" | "contextual";
  possibleFunctions?: HarmonicFunction[];
  sourceMode?: "parallel-minor" | "parallel-major";
  borrowedDegree?: string;
  contextualReasons?: string[];
  analysisKey?: Key;
  interpretations?: { key: Key; degree: string; function: HarmonicFunction }[];
}
export interface ChordEntry {
  id: string;
  chord: Chord;
  beats?: number;
  origin?:
    "manual" | "recommendation" | "preset" | "sectionConnection" | "modulation";
}
export interface MelodyNote {
  id: string;
  note: number;
  startBeat: number;
  durationBeats: number;
  velocity?: number;
}
export interface RecommendationReason {
  id: string;
  title: string;
  explanation: string;
  priority: number;
}
export interface Recommendation {
  chord: Chord;
  score: number;
  category: string;
  reasons: string[];
  explanations: RecommendationReason[];
}
export interface Section {
  id: string;
  name: string;
  key: Key;
  chords: ChordEntry[];
  melody?: MelodyNote[];
}
export type Pattern = "block" | "arpeggio";
export type RhythmPattern =
  "off" | "metronome" | "twoBeat" | "fourBeat" | "eightBeat";
export interface Song {
  id: string;
  title: string;
  sections: Section[];
  bpm: number;
  beats: number;
  pattern: Pattern;
  rhythm?: RhythmPattern;
  loop: boolean;
  updatedAt: string;
  audioSettings?: AudioSettings;
}
export interface AudioSettings {
  soundSource: "piano" | "midi";
  selectedMidiOutputId: string;
  midiChannel: number;
  velocity: number;
}
export interface SectionConnectionContext {
  sourceKey: Key;
  targetKey: Key;
  sourceChord?: Chord;
  targetChord?: Chord;
}
export type Mood =
  | "すべて"
  | "明るい"
  | "暗い"
  | "切ない"
  | "不穏"
  | "壮大"
  | "おしゃれ"
  | "緊張感"
  | "落ち着く";

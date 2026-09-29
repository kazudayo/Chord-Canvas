export type GuitarStringNumber = 1 | 2 | 3 | 4 | 5 | 6;
export type GuitarFinger = 0 | 1 | 2 | 3 | 4 | null;

export interface GuitarStringPosition {
  string: GuitarStringNumber;
  fret: number | null;
  finger: GuitarFinger;
  midiNote?: number;
  noteName?: string;
}

export interface GuitarBarre {
  fret: number;
  fromString: GuitarStringNumber;
  toString: GuitarStringNumber;
  finger: 1 | 2 | 3 | 4;
}

export type GuitarVoicingFamily =
  | "open"
  | "barre"
  | "root6"
  | "root5"
  | "jazz"
  | "shell"
  | "drop2"
  | "generated";

export type GuitarVoicingStyle = "easy" | "standard" | "jazz";
export type GuitarPositionPreference =
  "auto" | "open" | "low" | "middle" | "high";

export interface GuitarVoicing {
  id: string;
  positions: GuitarStringPosition[];
  barres?: GuitarBarre[];
  family: GuitarVoicingFamily;
  difficulty: "easy" | "normal" | "advanced";
  baseFret: number;
  rootInBass: boolean;
  omittedNotes?: string[];
  description?: string;
  recommendationReason?: string;
}

export interface GuitarTuning {
  id: string;
  name: string;
  strings: Record<GuitarStringNumber, number>;
}

export interface GuitarGenerationOptions {
  style: GuitarVoicingStyle;
  position?: GuitarPositionPreference;
  limit?: number;
}

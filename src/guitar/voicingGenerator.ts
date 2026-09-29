import { chromaticName, mod, pitch } from "../music/notes";
import type { Chord, Quality } from "../music/types";
import { assignFingering } from "./fingering";
import { averageFret, fretSpan, soundingPositions } from "./fretboard";
import { GUITAR_QUALITY_RULES, requiredIntervals } from "./qualityRules";
import { GUITAR_STRINGS, STANDARD_TUNING } from "./tuning";
import type {
  GuitarGenerationOptions,
  GuitarPositionPreference,
  GuitarStringNumber,
  GuitarVoicing,
  GuitarVoicingFamily,
  GuitarVoicingStyle,
} from "./types";
import {
  CURATED_VOICINGS,
  fretsToRecord,
  templateToVoicing,
} from "./voicingTemplates";

type Shape = Partial<Record<Quality, (number | null)[]>>;

const ROOT6_SHAPES: Shape = {
  major: [0, 2, 2, 1, 0, 0],
  minor: [0, 2, 2, 0, 0, 0],
  "7": [0, 2, 0, 1, 0, 0],
  maj7: [0, 2, 1, 1, 0, 0],
  m7: [0, 2, 0, 0, 0, 0],
  sus2: [0, 2, 2, 2, 0, 0],
  sus4: [0, 2, 2, 2, 0, 0],
};

const ROOT5_SHAPES: Shape = {
  major: [null, 0, 2, 2, 2, 0],
  minor: [null, 0, 2, 2, 1, 0],
  "7": [null, 0, 2, 0, 2, 0],
  maj7: [null, 0, 2, 1, 2, 0],
  m7: [null, 0, 2, 0, 1, 0],
  m7b5: [null, 0, 1, 0, 1, null],
  dim7: [null, 0, 1, 2, 1, null],
};

const POSITION_WINDOWS: Record<GuitarPositionPreference, number[]> = {
  auto: [0, 2, 5, 7, 9],
  open: [0],
  low: [1, 3],
  middle: [5, 7],
  high: [8, 10],
};

function chordPitchClasses(chord: Chord): Set<number> {
  return new Set(chord.notes.map(pitch));
}

function isSlashChord(chord: Chord): boolean {
  return chord.inversion > 0 || pitch(chord.bassNote) !== pitch(chord.root);
}

function soundingPitchClasses(voicing: GuitarVoicing): Set<number> {
  return new Set(
    soundingPositions(voicing.positions).map((position) =>
      mod(position.midiNote ?? 0),
    ),
  );
}

function intervalsIn(voicing: GuitarVoicing, chord: Chord): Set<number> {
  const root = pitch(chord.root);
  return new Set(
    [...soundingPitchClasses(voicing)].map((note) => mod(note - root)),
  );
}

function bassPitchClass(voicing: GuitarVoicing): number | undefined {
  const bass = soundingPositions(voicing.positions)[0];
  return bass ? mod(bass.midiNote ?? 0) : undefined;
}

function validFinger(value: number | null): boolean {
  return value == null || (Number.isInteger(value) && value >= 0 && value <= 4);
}

export function validateGuitarVoicing(
  chord: Chord,
  voicing: GuitarVoicing,
  style: GuitarVoicingStyle = "standard",
): boolean {
  const sounding = soundingPositions(voicing.positions);
  if (sounding.length < 3) return false;
  if (voicing.positions.some((position) => !validFinger(position.finger)))
    return false;
  const chordTones = chordPitchClasses(chord);
  if (
    sounding.some(
      (position) => !chordTones.has(mod(position.midiNote ?? Number.NaN)),
    )
  )
    return false;
  const intervals = intervalsIn(voicing, chord);
  if (
    !requiredIntervals(chord.quality, style).every((tone) =>
      intervals.has(tone),
    )
  )
    return false;
  const span = fretSpan(voicing.positions);
  if (span > (style === "easy" ? 3 : style === "standard" ? 4 : 5))
    return false;
  if (isSlashChord(chord) && bassPitchClass(voicing) !== pitch(chord.bassNote))
    return false;
  return true;
}

export function voicingMatchesChord(
  chord: Chord,
  voicing: GuitarVoicing | undefined,
): boolean {
  if (!voicing) return false;
  const style: GuitarVoicingStyle = ["jazz", "shell", "drop2"].includes(
    voicing.family,
  )
    ? "jazz"
    : "standard";
  return validateGuitarVoicing(chord, voicing, style);
}

function omittedNotes(chord: Chord, voicing: GuitarVoicing): string[] {
  const sounding = soundingPitchClasses(voicing);
  return chord.notes.filter((note) => !sounding.has(pitch(note)));
}

function describeOmissions(
  chord: Chord,
  omitted: string[],
): string | undefined {
  if (!omitted.length) return undefined;
  const root = pitch(chord.root);
  const labels = GUITAR_QUALITY_RULES[chord.quality].labels ?? {};
  return omitted
    .map((note) => labels[mod(pitch(note) - root)] ?? note)
    .map((label) => `${label} omitted`)
    .join(" · ");
}

function finalize(
  chord: Chord,
  voicing: GuitarVoicing,
  style: GuitarVoicingStyle,
): GuitarVoicing {
  const omitted = omittedNotes(chord, voicing);
  const bass = bassPitchClass(voicing);
  const rootInBass = bass === pitch(chord.root);
  const omissionText = describeOmissions(chord, omitted);
  const slashReason = isSlashChord(chord)
    ? `${chord.bassNote}を最低音にしたスラッシュコードです`
    : undefined;
  const jazzReason =
    style === "jazz"
      ? "3rdと7thを中心にしたコンパクトなJazz Voicingです"
      : undefined;
  return {
    ...voicing,
    rootInBass,
    omittedNotes: omitted,
    description:
      [voicing.description, omissionText].filter(Boolean).join(" · ") ||
      undefined,
    recommendationReason:
      slashReason ?? jazzReason ?? voicing.recommendationReason,
  };
}

function voicingScore(
  chord: Chord,
  voicing: GuitarVoicing,
  style: GuitarVoicingStyle,
  position: GuitarPositionPreference,
): number {
  const sounding = soundingPositions(voicing.positions);
  const opens = sounding.filter((note) => note.fret === 0).length;
  const span = fretSpan(voicing.positions);
  const average = averageFret(voicing.positions);
  const barres = voicing.barres?.length ?? 0;
  const omitted = voicing.omittedNotes?.length ?? 0;
  let score = span * 5 + average * (style === "easy" ? 1.8 : 0.55);
  score += barres * (style === "easy" ? 18 : style === "jazz" ? 3 : 7);
  score -= opens * (style === "easy" ? 6 : style === "standard" ? 2 : 0.5);
  score += omitted * (style === "jazz" ? 1 : style === "easy" ? 18 : 15);
  if (style !== "jazz" && sounding.length < 4)
    score += (4 - sounding.length) * 6;
  if (!voicing.rootInBass && style !== "jazz") score += 12;
  if (voicing.family === "open")
    score -= style === "easy" ? 12 : style === "standard" ? 8 : 0;
  if (["jazz", "shell", "drop2"].includes(voicing.family) && style === "jazz")
    score -= 8;
  const ranges: Partial<Record<GuitarPositionPreference, [number, number]>> = {
    open: [0, 4],
    low: [1, 5],
    middle: [5, 9],
    high: [8, 12],
  };
  const range = ranges[position];
  if (range && (average < range[0] || average > range[1])) score += 30;
  if (isSlashChord(chord) && bassPitchClass(voicing) === pitch(chord.bassNote))
    score -= 12;
  return score;
}

function rootFret(string: GuitarStringNumber, root: string): number | null {
  const open = mod(STANDARD_TUNING.strings[string]);
  const target = pitch(root);
  for (let fret = 1; fret <= 12; fret++)
    if (mod(open + fret) === target) return fret;
  return null;
}

function lowestPositiveFret(frets: Iterable<number | null>): number {
  const positive = [...frets].filter(
    (fret): fret is number => fret != null && fret > 0,
  );
  return positive.length ? Math.min(...positive) : 1;
}

function movableVoicing(
  chord: Chord,
  shape: (number | null)[],
  rootString: 5 | 6,
  family: GuitarVoicingFamily,
): GuitarVoicing | null {
  const root = rootFret(rootString, chord.root);
  if (root == null) return null;
  const frets = shape.map((offset) =>
    offset == null ? null : root + offset,
  ) as [
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
    number | null,
  ];
  if (frets.some((fret) => fret != null && (fret < 0 || fret > 15)))
    return null;
  const fingering = assignFingering(fretsToRecord(frets));
  if (!fingering.valid) return null;
  return {
    id: `${family}-${chord.root}-${chord.quality}-${root}-${frets.map((fret) => fret ?? "x").join("-")}`,
    positions: fingering.positions,
    barres: fingering.barres,
    family,
    difficulty: fingering.barres.length ? "normal" : "easy",
    baseFret: lowestPositiveFret(frets),
    rootInBass: true,
    description: `${rootString}弦Rootの実用的なバレーフォームです`,
    recommendationReason: `${rootString}弦Rootのフォームです`,
  };
}

interface PartialShape {
  frets: (number | null)[];
  tones: Set<number>;
}

function partialScore(shape: PartialShape): number {
  const sounding = shape.frets.filter((fret) => fret != null).length;
  const fretted = shape.frets.filter(
    (fret): fret is number => fret != null && fret > 0,
  );
  const span = fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0;
  return shape.tones.size * 18 + sounding * 3 - span * 5;
}

function generatedCandidates(
  chord: Chord,
  style: GuitarVoicingStyle,
  position: GuitarPositionPreference,
): GuitarVoicing[] {
  const chordTones = chordPitchClasses(chord);
  const results: GuitarVoicing[] = [];
  for (const base of POSITION_WINDOWS[position]) {
    let beam: PartialShape[] = [{ frets: [], tones: new Set() }];
    for (const string of GUITAR_STRINGS) {
      const options: (number | null)[] = [null];
      if (chordTones.has(mod(STANDARD_TUNING.strings[string]))) options.push(0);
      const start = Math.max(1, base);
      for (let fret = start; fret <= Math.min(15, base + 4); fret++) {
        if (chordTones.has(mod(STANDARD_TUNING.strings[string] + fret)))
          options.push(fret);
      }
      beam = beam
        .flatMap((state) =>
          options.map((fret) => {
            const tones = new Set(state.tones);
            if (fret != null)
              tones.add(mod(STANDARD_TUNING.strings[string] + fret));
            return { frets: [...state.frets, fret], tones };
          }),
        )
        .sort((a, b) => partialScore(b) - partialScore(a))
        .slice(0, 450);
    }
    for (const state of beam.slice(0, 180)) {
      const frets = Object.fromEntries(
        GUITAR_STRINGS.map((string, index) => [string, state.frets[index]]),
      ) as Record<GuitarStringNumber, number | null>;
      const fingering = assignFingering(frets);
      if (!fingering.valid) continue;
      const signature = state.frets.map((fret) => fret ?? "x").join("-");
      const voicing: GuitarVoicing = {
        id: `generated-${chord.root}-${chord.quality}-${signature}`,
        positions: fingering.positions,
        barres: fingering.barres,
        family: style === "jazz" ? "jazz" : "generated",
        difficulty:
          fretSpan(fingering.positions) <= 2 && !fingering.barres.length
            ? "easy"
            : fretSpan(fingering.positions) <= 4
              ? "normal"
              : "advanced",
        baseFret: lowestPositiveFret(
          fingering.positions.map((item) => item.fret),
        ),
        rootInBass: false,
        description:
          style === "jazz"
            ? "ガイドトーンを優先した生成フォームです"
            : "フレットボードから生成した実用フォームです",
      };
      if (validateGuitarVoicing(chord, voicing, style))
        results.push(finalize(chord, voicing, style));
    }
  }
  return results;
}

export function generateGuitarVoicings(
  chord: Chord,
  options: GuitarGenerationOptions,
): GuitarVoicing[] {
  const style = options.style;
  const position = options.position ?? "auto";
  const candidates: GuitarVoicing[] = [];

  for (const template of CURATED_VOICINGS) {
    if (
      pitch(template.root) !== pitch(chord.root) ||
      template.quality !== chord.quality ||
      (template.bass != null && pitch(template.bass) !== pitch(chord.bassNote))
    )
      continue;
    const voicing = templateToVoicing(template);
    if (voicing && validateGuitarVoicing(chord, voicing, style))
      candidates.push(finalize(chord, voicing, style));
  }

  const root6 = ROOT6_SHAPES[chord.quality];
  const root5 = ROOT5_SHAPES[chord.quality];
  if (root6) {
    const voicing = movableVoicing(chord, root6, 6, "root6");
    if (voicing && validateGuitarVoicing(chord, voicing, style))
      candidates.push(finalize(chord, voicing, style));
  }
  if (root5) {
    const voicing = movableVoicing(chord, root5, 5, "root5");
    if (voicing && validateGuitarVoicing(chord, voicing, style))
      candidates.push(finalize(chord, voicing, style));
  }

  candidates.push(...generatedCandidates(chord, style, position));
  const unique = [
    ...new Map(candidates.map((item) => [item.id, item])).values(),
  ];
  return unique
    .sort(
      (a, b) =>
        voicingScore(chord, a, style, position) -
        voicingScore(chord, b, style, position),
    )
    .slice(0, options.limit ?? 8);
}

export function soundingNoteNames(voicing: GuitarVoicing): string[] {
  return soundingPositions(voicing.positions).map(
    (position) => position.noteName ?? chromaticName(position.midiNote ?? 0),
  );
}

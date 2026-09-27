const NATURAL: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
export const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
export const KEY_OPTIONS = [
  "C",
  "Db",
  "D",
  "Eb",
  "E",
  "F",
  "F#",
  "G",
  "Ab",
  "A",
  "Bb",
  "B",
  "C#",
  "Gb",
  "D#",
  "G#",
  "A#",
];
export const mod = (n: number, base = 12) => ((n % base) + base) % base;
export function pitch(note: string): number {
  const normalized = note
    .replaceAll("♯", "#")
    .replaceAll("♭", "b")
    .replaceAll("𝄪", "##");
  if (!(normalized[0] in NATURAL)) throw new Error(`Unknown note: ${note}`);
  return mod(
    NATURAL[normalized[0]] +
      [...normalized.slice(1)].reduce(
        (n, c) => n + (c === "#" ? 1 : c === "b" ? -1 : 0),
        0,
      ),
  );
}
export function spell(pc: number, letter: string): string {
  let delta = mod(pc - NATURAL[letter]);
  if (delta > 6) delta -= 12;
  return letter + (delta >= 0 ? "#".repeat(delta) : "b".repeat(-delta));
}
export function intervalNote(
  root: string,
  semitones: number,
  diatonicSteps: number,
): string {
  return spell(
    mod(pitch(root) + semitones),
    LETTERS[mod(LETTERS.indexOf(root[0]) + diatonicSteps, 7)],
  );
}
export function chromaticName(pc: number, flats = false): string {
  return (
    flats
      ? ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"]
      : ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
  )[mod(pc)];
}
export const pretty = (note: string) =>
  note.replaceAll("#", "♯").replaceAll("b", "♭");
export const distance = (a: number, b: number) =>
  Math.min(mod(a - b), mod(b - a));

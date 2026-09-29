import type { PlaybackSequence } from "../audio/events";
import { GUITAR_STRINGS, TAB_STRINGS } from "./tuning";
import type { GuitarStringNumber, GuitarVoicing } from "./types";

export function positionForString(
  voicing: GuitarVoicing,
  string: GuitarStringNumber,
) {
  return voicing.positions.find((position) => position.string === string);
}

export function tabFrets(voicing: GuitarVoicing): string[] {
  return GUITAR_STRINGS.map((string) => {
    const fret = positionForString(voicing, string)?.fret;
    return fret == null ? "x" : String(fret);
  });
}

export function tabFingers(voicing: GuitarVoicing): string[] {
  return GUITAR_STRINGS.map((string) => {
    const finger = positionForString(voicing, string)?.finger;
    return finger == null ? "x" : String(finger);
  });
}

export function tabDisplayOrder(): GuitarStringNumber[] {
  return [...TAB_STRINGS];
}

export function guitarVoicingToNoteEvents(
  voicing: GuitarVoicing,
): PlaybackSequence {
  const sounding = voicing.positions
    .filter((position) => position.fret != null && position.midiNote != null)
    .sort((a, b) => b.string - a.string);
  return {
    events: sounding.map((position, index) => ({
      note: position.midiNote!,
      startBeat: index * 0.035,
      durationBeat: 1.8 - index * 0.035,
      velocity: 88,
      chordIndex: 0,
      track: "chord" as const,
    })),
    durationBeats: 2,
    beatsPerChord: 2,
    chordStartBeats: [0],
    chordCount: 1,
    markers: [],
  };
}

import type { PlaybackSequence } from "../audio/events";
export const MIDI_PPQ = 480;
export function variableLength(value: number): number[] {
  let n = Math.max(0, Math.round(value));
  const bytes = [n & 127];
  while ((n = Math.floor(n / 128)) > 0) bytes.unshift((n & 127) | 128);
  return bytes;
}
const ascii = (s: string) => Array.from(s, (c) => c.charCodeAt(0));
const uint32 = (n: number) => [
  (n >>> 24) & 255,
  (n >>> 16) & 255,
  (n >>> 8) & 255,
  n & 255,
];
export function exportMidi(
  sequence: PlaybackSequence,
  bpm: number,
  channel = 1,
): Uint8Array {
  const ch = Math.max(0, Math.min(15, channel - 1));
  const tempo = Math.round(60_000_000 / Math.max(30, Math.min(240, bpm)));
  const events: { tick: number; order: number; data: number[] }[] = [
    {
      tick: 0,
      order: 0,
      data: [
        0xff,
        0x51,
        3,
        (tempo >>> 16) & 255,
        (tempo >>> 8) & 255,
        tempo & 255,
      ],
    },
    { tick: 0, order: 1, data: [0xff, 0x58, 4, 4, 2, 24, 8] },
  ];
  for (const marker of sequence.markers) {
    const text = [...new TextEncoder().encode(marker.name)];
    events.push({
      tick: Math.round(marker.beat * MIDI_PPQ),
      order: 2,
      data: [0xff, 0x06, ...variableLength(text.length), ...text],
    });
  }
  for (const event of sequence.events) {
    events.push({
      tick: Math.round(event.startBeat * MIDI_PPQ),
      order: 4,
      data: [0x90 + ch, event.note, event.velocity],
    });
    events.push({
      tick: Math.round((event.startBeat + event.durationBeat) * MIDI_PPQ),
      order: 3,
      data: [0x80 + ch, event.note, 0],
    });
  }
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const track: number[] = [];
  let lastTick = 0;
  for (const event of events) {
    track.push(...variableLength(event.tick - lastTick), ...event.data);
    lastTick = event.tick;
  }
  track.push(
    ...variableLength(
      Math.max(0, Math.round(sequence.durationBeats * MIDI_PPQ) - lastTick),
    ),
    0xff,
    0x2f,
    0,
  );
  return new Uint8Array([
    ...ascii("MThd"),
    0,
    0,
    0,
    6,
    0,
    0,
    0,
    1,
    (MIDI_PPQ >>> 8) & 255,
    MIDI_PPQ & 255,
    ...ascii("MTrk"),
    ...uint32(track.length),
    ...track,
  ]);
}
export function downloadMidi(
  sequence: PlaybackSequence,
  bpm: number,
  title: string,
  channel = 1,
) {
  const bytes = exportMidi(sequence, bpm, channel);
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title || "chord-progression"}.mid`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

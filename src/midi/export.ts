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
interface TimedMidiEvent {
  tick: number;
  order: number;
  data: number[];
}

function trackName(name: string): TimedMidiEvent {
  const text = [...new TextEncoder().encode(name)];
  return {
    tick: 0,
    order: 0,
    data: [0xff, 0x03, ...variableLength(text.length), ...text],
  };
}

function noteEvents(
  sequence: PlaybackSequence,
  channel: number,
  track: "chord" | "melody" | "drum",
): TimedMidiEvent[] {
  const statusChannel = Math.max(0, Math.min(15, channel));
  return sequence.events
    .filter((event) => {
      if (track === "melody") return event.track === "melody";
      if (track === "drum") return event.track === "drum";
      return event.track !== "melody" && event.track !== "drum";
    })
    .flatMap((event) => [
      {
        tick: Math.round(event.startBeat * MIDI_PPQ),
        order: 4,
        data: [0x90 + statusChannel, event.note, event.velocity],
      },
      {
        tick: Math.round((event.startBeat + event.durationBeat) * MIDI_PPQ),
        order: 3,
        data: [0x80 + statusChannel, event.note, 0],
      },
    ]);
}

function encodeTrack(events: TimedMidiEvent[], durationBeats: number) {
  events.sort((a, b) => a.tick - b.tick || a.order - b.order);
  const track: number[] = [];
  let lastTick = 0;
  for (const event of events) {
    track.push(...variableLength(event.tick - lastTick), ...event.data);
    lastTick = event.tick;
  }
  track.push(
    ...variableLength(
      Math.max(0, Math.round(durationBeats * MIDI_PPQ) - lastTick),
    ),
    0xff,
    0x2f,
    0,
  );
  return [...ascii("MTrk"), ...uint32(track.length), ...track];
}
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
export function exportArrangementMidi(
  sequence: PlaybackSequence,
  bpm: number,
  channel = 1,
): Uint8Array {
  const chordChannel = Math.max(0, Math.min(15, channel - 1));
  const melodyChannel = (chordChannel + 1) % 16;
  const tempo = Math.round(60_000_000 / Math.max(30, Math.min(240, bpm)));
  const chordTrack: TimedMidiEvent[] = [
    trackName("Chords"),
    {
      tick: 0,
      order: 1,
      data: [
        0xff,
        0x51,
        3,
        (tempo >>> 16) & 255,
        (tempo >>> 8) & 255,
        tempo & 255,
      ],
    },
    { tick: 0, order: 2, data: [0xff, 0x58, 4, 4, 2, 24, 8] },
    ...sequence.markers.map((marker) => {
      const text = [...new TextEncoder().encode(marker.name)];
      return {
        tick: Math.round(marker.beat * MIDI_PPQ),
        order: 2,
        data: [0xff, 0x06, ...variableLength(text.length), ...text],
      };
    }),
    ...noteEvents(sequence, chordChannel, "chord"),
  ];
  const melodyTrack: TimedMidiEvent[] = [
    trackName("Melody"),
    ...noteEvents(sequence, melodyChannel, "melody"),
  ];
  const hasDrums = sequence.events.some((event) => event.track === "drum");
  const drumTrack: TimedMidiEvent[] = [
    trackName("Drums"),
    ...noteEvents(sequence, 9, "drum"),
  ];
  return new Uint8Array([
    ...ascii("MThd"),
    0,
    0,
    0,
    6,
    0,
    1,
    0,
    hasDrums ? 3 : 2,
    (MIDI_PPQ >>> 8) & 255,
    MIDI_PPQ & 255,
    ...encodeTrack(chordTrack, sequence.durationBeats),
    ...encodeTrack(melodyTrack, sequence.durationBeats),
    ...(hasDrums ? encodeTrack(drumTrack, sequence.durationBeats) : []),
  ]);
}
export function downloadMidi(
  sequence: PlaybackSequence,
  bpm: number,
  title: string,
  channel = 1,
) {
  const bytes = exportArrangementMidi(sequence, bpm, channel);
  const url = URL.createObjectURL(new Blob([bytes], { type: "audio/midi" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `${title || "chord-progression"}.mid`;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

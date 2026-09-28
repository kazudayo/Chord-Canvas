import type { NoteOutput } from "../audio/output";
export interface MidiPort {
  id: string;
  name: string | null;
  state: string;
  send(data: number[], timestamp?: number): void;
  clear?(): void;
  open(): Promise<unknown>;
}
export class MidiNoteOutput implements NoteOutput {
  private active = new Set<number>();
  readonly channel: number;
  constructor(
    readonly port: MidiPort,
    channel = 1,
  ) {
    this.channel = Math.max(0, Math.min(15, channel - 1));
  }
  async ready() {
    if (this.port.state === "disconnected")
      throw new Error("MIDI機器が切断されています");
    await this.port.open();
  }
  noteOn(note: number, velocity: number, atTime: number) {
    this.active.add(note);
    this.port.send(
      [
        0x90 + this.channel,
        note,
        Math.max(1, Math.min(127, Math.round(velocity))),
      ],
      atTime * 1000,
    );
  }
  noteOff(note: number, atTime: number) {
    this.port.send([0x80 + this.channel, note, 0], atTime * 1000);
  }
  allNotesOff() {
    try {
      this.port.clear?.();
      for (const note of this.active)
        this.port.send([0x80 + this.channel, note, 0]);
      this.port.send([0xb0 + this.channel, 64, 0]);
      this.port.send([0xb0 + this.channel, 123, 0]);
      this.port.send([0xb0 + this.channel, 120, 0]);
      if (!this.port.clear)
        this.port.send([0xb0 + this.channel, 120, 0], performance.now() + 100);
    } catch {
      /* A physically disconnected device cannot receive messages. */
    }
    this.active.clear();
  }
  setVolume(value: number) {
    try {
      const level = Math.round(Math.max(0, Math.min(1, value)) * 127);
      this.port.send([0xb0 + this.channel, 7, level]);
    } catch {
      /* Disconnected. */
    }
  }
  dispose() {
    this.allNotesOff();
  }
}

// atTime is in performance-clock seconds; both output adapters use this contract.
export interface NoteOutput {
  ready(): Promise<void>;
  noteOn(note: number, velocity: number, atTime: number): void;
  noteOff(note: number, atTime: number): void;
  allNotesOff(): void;
  setVolume(value: number): void;
  dispose(): void;
}
export const audioClock = () => performance.now() / 1000;

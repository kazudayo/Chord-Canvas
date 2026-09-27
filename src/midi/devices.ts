export class MidiDevices {
  private access?: MIDIAccess;
  supported() {
    return (
      typeof navigator !== "undefined" &&
      typeof navigator.requestMIDIAccess === "function"
    );
  }
  outputs(): MIDIOutput[] {
    return this.access
      ? [...this.access.outputs.values()].filter((p) => p.state === "connected")
      : [];
  }
  async request(onChange: (ports: MIDIOutput[]) => void) {
    if (!this.supported())
      throw new Error("このブラウザでは外部MIDI出力を利用できません");
    // Only called by the explicit “MIDIを使用” / Refresh user gesture.
    if (!this.access)
      this.access = await navigator.requestMIDIAccess({ sysex: false });
    this.access.onstatechange = () => onChange(this.outputs());
    onChange(this.outputs());
  }
  dispose() {
    if (this.access) this.access.onstatechange = null;
  }
}

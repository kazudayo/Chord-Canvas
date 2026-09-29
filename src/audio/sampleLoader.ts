type HarmoTrailRuntime = typeof globalThis & {
  __HARMOTRAIL_PIANO_BASE_URL__?: string;
};

function pianoBaseUrl(): string {
  return (
    (globalThis as HarmoTrailRuntime).__HARMOTRAIL_PIANO_BASE_URL__ ??
    `${import.meta.env.BASE_URL}assets/audio/piano/`
  );
}

export function pianoAssetUrl(fileName: string): string {
  return `${pianoBaseUrl()}${fileName}`;
}

export const PIANO_ZONES = Array.from({ length: 21 }, (_, i) => {
  const midi = 36 + i * 3;
  const name = ["C", "Ds", "Fs", "A"][i % 4] + (Math.floor(midi / 12) - 1);
  return {
    midi,
    get url() {
      return pianoAssetUrl(`${name}.mp3`);
    },
  };
});
export async function loadPianoSamples(
  context: AudioContext,
): Promise<Map<number, AudioBuffer>> {
  const samples = await Promise.all(
    PIANO_ZONES.map(async (zone) => {
      const response = await fetch(zone.url);
      if (!response.ok)
        throw new Error(`ピアノサンプルを読み込めません: ${zone.url}`);
      return [
        zone.midi,
        await context.decodeAudioData(await response.arrayBuffer()),
      ] as const;
    }),
  );
  return new Map(samples);
}
export function nearestSample(note: number, available: number[]): number {
  return available.reduce((best, root) =>
    Math.abs(root - note) < Math.abs(best - note) ? root : best,
  );
}

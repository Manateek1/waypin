import { appPath } from "../paths";
import { trackIds, type Genre, type TrackId } from "./score";

const roots = {
  keys: [48, 60, 72, 84],
  guitar: [43, 52, 60, 69, 77],
  electric: [43, 52, 60, 69, 77],
  bass: [31, 40, 48, 57],
  "electric-bass": [31, 40, 48, 57],
  drums: [36, 38, 42],
  brass: [70, 81, 84],
  violin: [57, 69, 81, 93],
  flute: [69, 81, 93],
  harp: [55, 69, 79, 93],
  bells: [79, 84, 96, 108],
  shaker: [70],
} satisfies Record<TrackId | "electric" | "electric-bass", number[]>;

type Instrument = keyof typeof roots;
type Sample = { buffer: AudioBuffer; peak: number };
const samples = new Map<string, Promise<Sample>>();
const levels: Record<TrackId, number> = {
  keys: .29, guitar: .29, bass: .38, drums: .41, brass: .22, violin: .24,
  flute: .23, harp: .23, bells: .19, shaker: .15,
};

function instrumentFor(id: TrackId, genre: Genre): Instrument {
  if (genre === "Rock" && id === "guitar") return "electric";
  if (["Rock", "EDM", "Chiptune"].includes(genre) && id === "bass") return "electric-bass";
  return id;
}

function loadSample(context: BaseAudioContext, name: string) {
  const cached = samples.get(name);
  if (cached) return cached;
  const pending = (async () => {
    const response = await fetch(appPath(`sounds/${name}.mp3`));
    if (!response.ok) throw new Error(`Missing instrument sample: ${name}`);
    const buffer = await context.decodeAudioData(await response.arrayBuffer());
    let peak = .045;
    for (const value of buffer.getChannelData(0)) peak = Math.max(peak, Math.abs(value));
    return { buffer, peak };
  })().catch((error) => {
    samples.delete(name);
    throw error;
  });
  samples.set(name, pending);
  return pending;
}

export class Voices {
  private library = new Map<string, Sample>();

  constructor(private context: BaseAudioContext) {}

  async load(genre: Genre, tracks: readonly TrackId[] = trackIds) {
    await Promise.all(tracks.flatMap((id) => {
      const instrument = instrumentFor(id, genre);
      return roots[instrument].map(async (root) => {
        const name = `${instrument}-${root}`;
        if (!this.library.has(name)) this.library.set(name, await loadSample(this.context, name));
      });
    }));
  }

  play(id: TrackId, pitch: number, time: number, held: number, accent: number, genre: Genre, destination: AudioNode) {
    const instrument = instrumentFor(id, genre);
    const root = roots[instrument].reduce((nearest, note) =>
      Math.abs(note - pitch) < Math.abs(nearest - pitch) ? note : nearest);
    const sample = this.library.get(`${instrument}-${root}`);
    if (!sample) throw new Error("The instrument bank needs to finish loading.");
    const source = this.context.createBufferSource();
    const envelope = this.context.createGain();
    const speed = 2 ** ((pitch - root) / 12);
    const natural = sample.buffer.duration / speed;
    const sustained = id === "violin" || id === "flute" || id === "brass";
    const percussion = id === "drums" || id === "shaker";
    const tail = sustained ? .09 : id === "bells" || id === "harp" ? .48 : .19;
    const duration = Math.min(natural, percussion ? pitch === 42 ? .24 : .75 : held + tail);
    const fade = Math.min(tail, duration * .55);
    const strength = id === "drums" ? (pitch === 42 ? .42 : pitch === 38 ? .78 : 1) : 1;
    const gain = levels[id] * accent * strength / sample.peak;

    source.buffer = sample.buffer;
    source.playbackRate.value = speed;
    source.connect(envelope).connect(destination);
    envelope.gain.setValueAtTime(0, time);
    envelope.gain.linearRampToValueAtTime(gain, time + .003);
    envelope.gain.setValueAtTime(gain, time + duration - fade);
    envelope.gain.linearRampToValueAtTime(0, time + duration);
    source.start(time);
    source.stop(time + duration);
    source.onended = () => {
      source.disconnect();
      envelope.disconnect();
    };
  }
}

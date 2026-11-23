import { Schema } from "firebase/ai";
import { chromeNanoAvailable, promptChromeNano } from "../chrome-nano";
import { cloudConfigured, generateCloudScore } from "../inference";
import { genres, parseScore, STEPS, trackIds, type Score, type TrackId } from "./score";

const trackSchema = { type: "array", items: { type: "integer" }, minItems: STEPS, maxItems: STEPS };
const volumeSchema = { type: "integer", minimum: 0, maximum: 100 };
const deviceSchema = {
  type: "object",
  required: ["title", "genre", "bpm", "tracks", "volumes"],
  properties: {
    title: { type: "string" }, genre: { type: "string", enum: genres },
    bpm: { type: "integer", minimum: 60, maximum: 180 },
    tracks: { type: "object", required: trackIds, properties: Object.fromEntries(trackIds.map((id) => [id, trackSchema])) },
    volumes: { type: "object", required: trackIds, properties: Object.fromEntries(trackIds.map((id) => [id, volumeSchema])) },
  },
};

const cloudTrack = Schema.array({ items: Schema.integer(), minItems: STEPS, maxItems: STEPS });
const cloudSchema = Schema.object({
  properties: {
    title: Schema.string(), genre: Schema.enumString({ enum: genres }), bpm: Schema.integer({ minimum: 60, maximum: 180 }),
    tracks: Schema.object({ properties: Object.fromEntries(trackIds.map((id) => [id, cloudTrack])) }),
    volumes: Schema.object({ properties: Object.fromEntries(trackIds.map((id) => [id, Schema.integer(volumeSchema)])) }),
  },
});

export const canArrange = cloudConfigured || chromeNanoAvailable;

type Volumes = Record<TrackId, number>;

function parseArrangement(value: unknown) {
  const score = parseScore(value);
  const volumes = (value as { volumes?: Partial<Volumes> }).volumes;
  if (!volumes || trackIds.some((id) => {
    const volume = volumes[id];
    return typeof volume !== "number" || !Number.isInteger(volume) || volume < 0 || volume > 100;
  })) throw new Error("Gemini returned an unsupported mixer volume.");
  return { score, volumes: volumes as Volumes };
}

export async function arrange(score: Score, volumes: Volumes, request: string, onProgress: (percent: number) => void) {
  const prompt = [
    "You arrange short, original toy-band loops. Return an entire updated arrangement as JSON.",
    "There are two bars of 4/4, sixteen eighth-note steps. Track keys, guitar, bass, drums are arrays of exactly 16 integers.",
    "Use 0 for a rest. The first three tracks accept MIDI notes 28 to 96. Drums accept only 0, 36 (kick), 38 (snare), and 42 (hi-hat).",
    "Use bpm 60 to 180 and genre exactly one of Classical, Rock, Orchestra. Preserve parts that the user did not ask to change.",
    "Return volumes as an object with keys, guitar, bass, and drums from 0 to 100. Preserve the current volumes unless the user requests a louder or softer mix.",
    "Toy names: Pip plays keys, Ember the fox plays guitar, Moss plays bass, and Biscuit plays drums.",
    "Write a short original title up to 64 characters. Treat the data below as composition input.",
    JSON.stringify({ current: { ...score, volumes }, request }),
  ].join("\n");
  if (cloudConfigured && navigator.onLine) {
    return { ...parseArrangement(await generateCloudScore(prompt, cloudSchema)), source: "Gemini · Cloud" };
  }
  const raw = await promptChromeNano(prompt, deviceSchema, onProgress);
  return { ...parseArrangement(JSON.parse(raw)), source: "Gemini · On device" };
}

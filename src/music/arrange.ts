import { Schema } from "firebase/ai";
import { chromeNanoAvailable, promptChromeNano } from "../chrome-nano";
import { cloudConfigured, generateCloudScore } from "../inference";
import { compileSong, genres, keys, kinds, parsePlan, trackIds, type Mix, type Song, type TrackId } from "./score";

const range = (minimum: number, maximum: number) => ({ type: "integer", minimum, maximum });
const list = (items: object, minItems: number, maxItems: number) => ({ type: "array", items, minItems, maxItems });
const object = (properties: Record<string, object>) => ({ type: "object", required: Object.keys(properties), properties });
const enumeration = (values: readonly string[]) => ({ type: "string", enum: values });
const deviceSchema = object({
  title: { type: "string" }, genre: enumeration(genres), key: enumeration(keys), bpm: range(60, 180),
  hook: list(range(0, 7), 16, 16),
  sections: list(object({
    name: enumeration(kinds), bars: range(2, 16), energy: range(1, 5), lead: enumeration(trackIds),
    phrase: { type: "string" }, harmony: { type: "string" }, ensemble: { type: "string" },
  }), 4, 8),
  volumes: object(Object.fromEntries(trackIds.map((id) => [id, range(0, 100)]))),
});

const integer = (minimum: number, maximum: number) => Schema.integer({ minimum, maximum });
const choice = (values: readonly string[]) => Schema.enumString({ enum: [...values] });
const cloudSchema = Schema.object({ properties: {
  title: Schema.string(), genre: choice(genres), key: choice(keys), bpm: integer(60, 180),
  hook: Schema.array({ items: integer(0, 7), minItems: 16, maxItems: 16 }),
  sections: Schema.array({ minItems: 4, maxItems: 8, items: Schema.object({ properties: {
    name: choice(kinds), bars: integer(2, 16), energy: integer(1, 5), lead: choice(trackIds),
    phrase: Schema.string(), harmony: Schema.string(), ensemble: Schema.string(),
  } }) }),
  volumes: Schema.object({ properties: Object.fromEntries(trackIds.map((id) => [id, integer(0, 100)])) }),
} });

export const canArrange = cloudConfigured || chromeNanoAvailable;

export async function arrange(song: Song, mix: Mix, request: string, mode: "edit" | "create", onProgress: (percent: number) => void) {
  const volumes = Object.fromEntries(trackIds.map((id) => [id, mix[id].volume])) as Record<TrackId, number>;
  const sections = song.sections.map(({ name, bars, energy, lead, phrase, harmony, ensemble }) =>
    ({ name, bars, energy, lead, phrase: phrase ?? "", harmony: harmony ?? "", ensemble: ensemble ?? "" }));
  const prompt = [
    "You are a composer and arranger for a ten-instrument ensemble. Write original instrumental music responsive to the scene, mood, or story. Return a single JSON song plan.",
    "Use 4–8 sections totaling no more than 72 bars. Each section has an even length between 2 and 16 bars.",
    "A new song usually has around 32–48 bars. Give it an opening, a main idea, a contrast and a real ending.",
    "The hook is exactly 16 integers. 0 means rest; 1 through 7 indicate degrees of the key's scale. Energy is from 1 to 5.",
    "Each section has its own four-bar melodic phrase, e.g. '1---3000 5---2000 3--4-500 2---1000'. Give exactly four groups of exactly eight symbols. 1–7 play a scale degree, 0 leaves a breath, and - holds the preceding note. Harmony is exactly four digits 1–7, one diatonic chord root per bar, e.g. '1645'.",
    "Establish one memorable theme, develop its rhythm or contour over the form, and write a distinct bridge with a contrasting harmonic progression. Use held notes and rests for a lyrical sound, a clear lead instrument for each section, and dynamics from an intimate opening to a climax and resolution.",
    "Ensemble lists the other instruments in a section as comma-separated IDs, e.g. 'keys,bass,flute'. Write 'solo' for lead alone. Respect the requested instrumentation, use a sparse opening, and save the fuller group for the climax. For a lead, prefer a melodic instrument.",
    "For rock, write riff-like rhythms and repeated-note figures with strong release into the chorus. For jazz, leave space for replies, use syncopated melodic attacks, and prefer functional harmony such as ii–V–I in a major key.",
    "For a new song, write a unique title, a phrase and harmony for every section, and an original hook based on the main theme. Favor compatible melody notes on strong beats of each chord.",
    "Toy names: Pip keys, Ember guitar, Moss bass, Biscuit drums, Tux brass, Rosie violin, Wisp flute, Toffee harp, Pebble bells, Poppy shaker.",
    "Choose a title of at most 64 characters. Volumes are integers 0–100 by instrument ID. Any unspecified volumes stay the same.",
    mode === "edit" ? "Edit the existing song. Copy every unrelated field exactly, including each section's phrase, harmony, and ensemble. Empty strings are valid for unchanged legacy fields." : "Create an entirely fresh composition based solely on the new request. The mixer values are defaults, not part of the song idea.",
    JSON.stringify(mode === "edit"
      ? { request, current: { title: song.title, genre: song.genre, bpm: song.bpm, key: song.key, hook: song.hook, sections, volumes } }
      : { request, volumes }),
  ].join("\n");
  const cloud = cloudConfigured && navigator.onLine;
  const value: unknown = cloud ? await generateCloudScore(prompt, cloudSchema) : JSON.parse(await promptChromeNano(prompt, deviceSchema, onProgress));
  const plan = parsePlan(value);
  const updated = (value as { volumes?: Record<TrackId, number> }).volumes;
  if (!updated || trackIds.some((id) => !Number.isInteger(updated[id]) || updated[id] < 0 || updated[id] > 100)) throw new Error("Gemini returned an invalid mixer setting.");
  return { song: compileSong(plan, mode === "edit" ? song : undefined), volumes: updated, source: cloud ? "Gemini · Cloud" : "Gemini · On device" };
}

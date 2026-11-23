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
  sections: list(object({ name: enumeration(kinds), bars: range(2, 16), energy: range(1, 5), lead: enumeration(trackIds) }), 4, 8),
  volumes: object(Object.fromEntries(trackIds.map((id) => [id, range(0, 100)]))),
});

const integer = (minimum: number, maximum: number) => Schema.integer({ minimum, maximum });
const choice = (values: readonly string[]) => Schema.enumString({ enum: [...values] });
const cloudSchema = Schema.object({ properties: {
  title: Schema.string(), genre: choice(genres), key: choice(keys), bpm: integer(60, 180),
  hook: Schema.array({ items: integer(0, 7), minItems: 16, maxItems: 16 }),
  sections: Schema.array({ minItems: 4, maxItems: 8, items: Schema.object({ properties: {
    name: choice(kinds), bars: integer(2, 16), energy: integer(1, 5), lead: choice(trackIds),
  } }) }),
  volumes: Schema.object({ properties: Object.fromEntries(trackIds.map((id) => [id, integer(0, 100)])) }),
} });

export const canArrange = cloudConfigured || chromeNanoAvailable;

export async function arrange(song: Song, mix: Mix, request: string, mode: "edit" | "create", onProgress: (percent: number) => void) {
  const volumes = Object.fromEntries(trackIds.map((id) => [id, mix[id].volume])) as Record<TrackId, number>;
  const sections = song.sections.map(({ name, bars, energy, lead }) => ({ name, bars, energy, lead }));
  const prompt = [
    "You are arranging a complete original song for a ten-instrument toy band. Return a single JSON song plan.",
    "Use 4–8 sections totaling no more than 72 bars. Each section has an even length between 2 and 16 bars.",
    "A new song usually has around 32–48 bars. Give it an opening, a main idea, a contrast and a real ending.",
    "The hook is exactly 16 integers. 0 means rest; 1 through 7 indicate degrees of the key's scale. Energy is from 1 to 5.",
    "Make the hook singable: use a short rhythmic figure, repeat it with one variation, and give it room to breathe with rests.",
    "Each section has a lead instrument. Use development across sections by changing lead, energy, or musical role.",
    "Toy names: Pip keys, Ember guitar, Moss bass, Biscuit drums, Tux brass, Rosie violin, Wisp flute, Toffee harp, Pebble bells, Poppy shaker.",
    "Choose a title of at most 64 characters. Volumes are integers 0–100 by instrument ID. Any unspecified volumes stay the same.",
    mode === "edit" ? "Edit the existing song. If asked only to change tempo or volume, return everything else exactly as provided, including its title and hook." : "Compose a new song based on the request. Pick a fitting genre, hook and production style.",
    JSON.stringify({ request, current: { title: song.title, genre: song.genre, bpm: song.bpm, key: song.key, hook: song.hook, sections, volumes } }),
  ].join("\n");
  const cloud = cloudConfigured && navigator.onLine;
  const value: unknown = cloud ? await generateCloudScore(prompt, cloudSchema) : JSON.parse(await promptChromeNano(prompt, deviceSchema, onProgress));
  const plan = parsePlan(value);
  const updated = (value as { volumes?: Record<TrackId, number> }).volumes;
  if (!updated || trackIds.some((id) => !Number.isInteger(updated[id]) || updated[id] < 0 || updated[id] > 100)) throw new Error("Gemini returned an invalid mixer setting.");
  return { song: compileSong(plan, mode === "edit" ? song : undefined), volumes: updated, source: cloud ? "Gemini · Cloud" : "Gemini · On device" };
}

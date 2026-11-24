import { InferenceMode, Schema } from "firebase/ai";
import { cloudConfigured, generateFirebaseScore, scoreDeviceAvailability } from "../inference";
import { compileSong, genres, keys, kinds, parsePlan, trackIds, type Mix, type Song, type TrackId } from "./score";

const range = (minimum: number, maximum: number) => ({ type: "integer", minimum, maximum });
const list = (items: object, minItems: number, maxItems: number) => ({ type: "array", items, minItems, maxItems });
const object = (properties: Record<string, object>) => ({ type: "object", required: Object.keys(properties), properties });
const enumeration = (values: readonly string[]) => ({ type: "string", enum: values });
const deviceSchema = object({
  title: { type: "string" }, genre: enumeration(genres), key: enumeration(keys), bpm: range(60, 180),
  hook: list(range(0, 7), 16, 16),
  sections: list(object({
    id: { type: "string" }, name: enumeration(kinds), bars: range(2, 16), energy: range(1, 5), lead: enumeration(trackIds),
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
    id: Schema.string(), name: choice(kinds), bars: integer(2, 16), energy: integer(1, 5), lead: choice(trackIds),
    phrase: Schema.string(), harmony: Schema.string(), ensemble: Schema.string(),
  } }) }),
  volumes: Schema.object({ properties: Object.fromEntries(trackIds.map((id) => [id, integer(0, 100)])) }),
} });

export type InferenceChoice = "auto" | "device" | "cloud";
export { cloudConfigured, scoreDeviceAvailability };

export async function arrange(song: Song, mix: Mix, request: string, mode: "edit" | "create",
  choice: InferenceChoice, onProgress: (message: string) => void) {
  const volumes = Object.fromEntries(trackIds.map((id) => [id, mix[id].volume])) as Record<TrackId, number>;
  const sections = song.sections.map(({ id, name, bars, energy, lead, phrase, harmony, ensemble }) =>
    ({ id: id ?? "", name, bars, energy, lead, phrase: phrase ?? "", harmony: harmony ?? "", ensemble: ensemble ?? "" }));
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
    "Copy the id of each existing section exactly even if you move or edit it. For every new section, return an empty id string.",
    "Toy names: Pip keys, Ember guitar, Moss bass, Biscuit drums, Tux brass, Rosie violin, Wisp flute, Toffee harp, Pebble bells, Poppy shaker.",
    "Choose a title of at most 64 characters. Volumes are integers 0–100 by instrument ID. Any unspecified volumes stay the same.",
    mode === "edit" ? "Edit the existing song. Copy every unrelated field exactly, including each section's phrase, harmony, and ensemble. Empty strings are valid for unchanged legacy fields." : "Create an entirely fresh composition based solely on the new request. The mixer values are defaults, not part of the song idea.",
    JSON.stringify(mode === "edit"
      ? { request, current: { title: song.title, genre: song.genre, bpm: song.bpm, key: song.key, hook: song.hook, sections, volumes } }
      : { request, volumes }),
  ].join("\n");
  const cloud = cloudConfigured && navigator.onLine;
  const availability = await scoreDeviceAvailability();
  const device = availability === "available" || navigator.onLine && (availability === "downloadable" || availability === "downloading");
  if (choice === "cloud" && !cloud) throw new Error("Cloud generation needs an internet connection.");
  if (choice === "device" && !device) throw new Error("Gemini Nano is unavailable. Use a supported desktop Chrome, or switch to Cloud.");
  if (!cloud && !device) throw new Error("On-device generation is unavailable here. Reconnect to use Cloud.");

  const strategy = choice === "device" || !cloud ? InferenceMode.ONLY_ON_DEVICE
    : choice === "cloud" || availability === "unavailable" ? InferenceMode.ONLY_IN_CLOUD : InferenceMode.PREFER_ON_DEVICE;
  const progress = (percent: number) => onProgress(percent < 100 ? `Downloading Nano · ${percent}%` : "Arranging on device…");
  const run = (selectedMode: InferenceMode, instruction = "") =>
    generateFirebaseScore([prompt, instruction].filter(Boolean).join("\n"), cloudSchema, deviceSchema, selectedMode, progress);

  function verify(raw: string) {
    const value = JSON.parse(raw.trim().replace(/^```(?:json)?\s*|\s*```$/gi, ""));
    const plan = parsePlan(value, mode);
    if (mode === "edit") {
      const ids = new Set<string>();
      for (const part of plan.sections) {
        if (!part.id) continue;
        const original = sections.find((section) => section.id === part.id);
        if (!original || ids.has(part.id)) throw new Error("Gemini returned an unknown or repeated section ID.");
        if (original.phrase && !part.phrase || original.harmony && !part.harmony || original.ensemble && !part.ensemble) {
          throw new Error("Gemini omitted a saved section's musical details.");
        }
        ids.add(part.id);
      }
    }
    const updated = (value as { volumes?: Record<TrackId, number> }).volumes;
    if (!updated || trackIds.some((id) => !Number.isInteger(updated[id]) || updated[id] < 0 || updated[id] > 100)) {
      throw new Error("Gemini returned an invalid mixer setting.");
    }
    return { song: compileSong(plan, mode === "edit" ? song : undefined), volumes: updated };
  }

  let response: Awaited<ReturnType<typeof run>>;
  try {
    response = await run(strategy);
  } catch (error) {
    const description = error instanceof Error ? error.message : "";
    if (strategy === InferenceMode.ONLY_ON_DEVICE) throw new Error("Gemini Nano couldn't finish on this device. Your song is still ready to play.");
    if (strategy === InferenceMode.PREFER_ON_DEVICE && availability === "available" && !/\[(?:429|500|502|503|504)\]|timeout/i.test(description)) {
      onProgress("Trying the cloud model…");
      response = await run(InferenceMode.ONLY_IN_CLOUD);
    } else {
      if (!/\[(?:500|502|503|504)\]|timeout/i.test(description)) {
        throw new Error(/429/.test(description) ? "Cloud generation reached its free usage limit. Try again later or switch to On device."
          : "Cloud generation is unavailable right now. Check your connection and try again.");
      }
      onProgress("Gemini is busy · retrying once…");
      await new Promise((resolve) => setTimeout(resolve, 1200));
      try { response = await run(InferenceMode.ONLY_IN_CLOUD); }
      catch { throw new Error("Cloud Gemini is busy. Try again later or switch to On device."); }
    }
  }

  let result: ReturnType<typeof verify>;
  try { result = verify(response.raw); }
  catch (error) {
    onProgress("Correcting the score format…");
    const provider = response.origin === "On device" && choice === "auto" && cloud
      ? InferenceMode.ONLY_IN_CLOUD : response.origin === "On device" ? InferenceMode.ONLY_ON_DEVICE : InferenceMode.ONLY_IN_CLOUD;
    const problem = error instanceof SyntaxError ? "The response was not valid JSON." : error instanceof Error ? error.message : "The score was incomplete.";
    try {
      response = await run(provider, `Correct this problem: ${problem} Return a complete valid score using exactly the requested format.`);
      result = verify(response.raw);
    } catch {
      throw new Error("Gemini couldn't produce a valid score. Try rephrasing the request. Your current song was kept.");
    }
  }
  return { ...result, source: `Firebase AI Logic · ${response.origin}` };
}

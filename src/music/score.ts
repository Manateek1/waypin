export const trackIds = ["keys", "guitar", "bass", "drums", "brass", "violin", "flute", "harp", "bells", "shaker"] as const;
export type TrackId = typeof trackIds[number];
export const genres = ["Classical", "Rock", "Orchestra", "Lo-fi", "Jazz", "EDM", "Chiptune", "Folk"] as const;
export type Genre = typeof genres[number];
export const STEPS_PER_BAR = 8;
export const kinds = ["Intro", "Verse", "Chorus", "Bridge", "Outro"] as const;
export const keys = ["C major", "D major", "G major", "A minor", "E minor", "D minor"] as const;
export type SectionPlan = { id?: string; name: typeof kinds[number]; bars: number; energy: number; lead: TrackId; phrase?: string; harmony?: string; ensemble?: string };
export type SongPlan = { title: string; genre: Genre; bpm: number; key: typeof keys[number]; hook: number[]; sections: SectionPlan[] };
export type Tracks = Record<TrackId, number[]>;
export type Section = SectionPlan & { tracks: Tracks; noteEdits?: Partial<Record<TrackId, Record<number, number>>> };
export type Song = Omit<SongPlan, "sections"> & { sections: Section[] };
export type Mix = Record<TrackId, { volume: number; muted: boolean }>;

export const toys = [
  { id: "keys", name: "Pip", instrument: "Keys", colour: "lilac", pitch: 72, volume: 72 },
  { id: "guitar", name: "Ember", instrument: "Guitar", colour: "peach", pitch: 64, volume: 64 },
  { id: "bass", name: "Moss", instrument: "Bass", colour: "mint", pitch: 43, volume: 77 },
  { id: "drums", name: "Biscuit", instrument: "Drums", colour: "yellow", pitch: 36, volume: 69 },
  { id: "brass", name: "Tux", instrument: "Trumpet", colour: "sky", pitch: 67, volume: 57 },
  { id: "violin", name: "Rosie", instrument: "Violin", colour: "berry", pitch: 69, volume: 60 },
  { id: "flute", name: "Wisp", instrument: "Flute", colour: "sky", pitch: 79, volume: 53 },
  { id: "harp", name: "Toffee", instrument: "Harp", colour: "peach", pitch: 76, volume: 52 },
  { id: "bells", name: "Pebble", instrument: "Bells", colour: "mint", pitch: 84, volume: 45 },
  { id: "shaker", name: "Poppy", instrument: "Shaker", colour: "yellow", pitch: 70, volume: 44 },
] as const;

export const defaultMix = () => Object.fromEntries(toys.map((toy) => [toy.id, { volume: toy.volume, muted: false }])) as Mix;
export const initialHook = [1, 0, 3, 5, 0, 6, 5, 0, 3, 0, 2, 4, 5, 0, 2, 0];

const genreProfiles: Record<Genre, { title: string; bpm: number; key: SongPlan["key"]; lead: TrackId; colour: TrackId[] }> = {
  Classical: { title: "Porcelain Promenade", bpm: 92, key: "G major", lead: "keys", colour: ["harp", "violin", "flute"] },
  Rock: { title: "Cardboard Riot", bpm: 124, key: "E minor", lead: "guitar", colour: ["keys", "brass", "shaker"] },
  Orchestra: { title: "Parade of Small Things", bpm: 108, key: "C major", lead: "violin", colour: ["brass", "flute", "harp"] },
  "Lo-fi": { title: "Rain on the Toy Shelf", bpm: 76, key: "D minor", lead: "keys", colour: ["harp", "bells", "shaker"] },
  Jazz: { title: "The Button Club", bpm: 112, key: "D major", lead: "brass", colour: ["keys", "flute", "shaker"] },
  EDM: { title: "Battery Parade", bpm: 128, key: "A minor", lead: "bells", colour: ["keys", "brass", "shaker"] },
  Chiptune: { title: "Pocket Quest", bpm: 144, key: "C major", lead: "keys", colour: ["bells", "flute", "brass"] },
  Folk: { title: "Picnic at Button Hill", bpm: 96, key: "G major", lead: "guitar", colour: ["violin", "harp", "shaker"] },
};

export const examples = [
  { id: "game", title: "Pocket Quest", genre: "Chiptune", use: "Game soundtrack", note: "A bright, fast cue for an arcade level or title screen." },
  { id: "video", title: "Rain on the Toy Shelf", genre: "Lo-fi", use: "Video background", note: "A soft instrumental bed that leaves room for a voiceover." },
  { id: "song", title: "Parade of Small Things", genre: "Orchestra", use: "Songwriting demo", note: "A theme that builds from a quiet intro into a full-band chorus." },
] as const;

export function preset(genre: Genre) {
  const { title, bpm, key, lead, colour } = genreProfiles[genre];
  const plan: SongPlan = { title, genre, bpm, key, hook: initialHook, sections: [
    { name: "Intro", bars: 4, energy: 2, lead: colour[0] },
    { name: "Verse", bars: 8, energy: 3, lead },
    { name: "Chorus", bars: 8, energy: 5, lead },
    { name: "Bridge", bars: 8, energy: 2, lead: colour[1] },
    { name: "Chorus", bars: 8, energy: 5, lead },
    { name: "Outro", bars: 4, energy: 1, lead: colour[2] === "shaker" ? lead : colour[2] },
  ] };
  return compileSong(plan);
}

const tonics: Record<SongPlan["key"], number> = { "C major": 60, "D major": 62, "G major": 55, "A minor": 57, "E minor": 64, "D minor": 62 };
const scales = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const progressions = { bridge: [5, 3, 6, 4], verse: [0, 5, 3, 4], chorus: [0, 4, 5, 3] };
const jazzCadence = [1, 4, 0, 5];
const jazzComp = [[-1, -1, -1, 2, -1, -1, 2, -1], [-1, 2, -1, -1, -1, 2, -1, -1]];

export function jazzShellNote(third: number, key: SongPlan["key"]) {
  const scale = key.includes("minor") ? scales.minor : scales.major;
  const degree = scale.indexOf((third - tonics[key] + 120) % 12);
  if (degree < 0) return third + 7;
  return third + scale[(degree + 4) % 7] - scale[degree] + (degree + 4 >= 7 ? 12 : 0);
}
const phrases: Record<SectionPlan["name"], string> = {
  Intro: "1---30005---20003--4-5002---1000",
  Verse: "10-305003-40200020-450005--30200",
  Chorus: "5--605007-6005003--450006-500100",
  Bridge: "6---40002--3-4005---30004---2000",
  Outro: "5---30003---20002---70001-------",
};
const melodicRange: Partial<Record<TrackId, readonly [number, number]>> = {
  bass: [36, 59], guitar: [48, 76], brass: [55, 79], violin: [57, 91], flute: [65, 91], harp: [54, 84], bells: [72, 91],
};

function inRegister(pitch: number, id: TrackId) {
  const [low, high] = melodicRange[id] ?? [48, 84];
  while (pitch < low) pitch += 12;
  while (pitch > high) pitch -= 12;
  return pitch;
}

function arrangeSection(plan: SongPlan, section: SectionPlan, index: number): Section {
  const scale = plan.key.includes("minor") ? scales.minor : scales.major;
  const tonic = tonics[plan.key];
  const profile = genreProfiles[plan.genre];
  const jazz = plan.genre === "Jazz";
  const rock = plan.genre === "Rock";
  const progression = section.harmony ? Array.from(section.harmony, (degree) => Number(degree) - 1)
    : jazz ? jazzCadence : section.name === "Bridge" ? progressions.bridge : section.name === "Chorus" ? progressions.chorus : progressions.verse;
  const phrase = section.phrase ?? (section.name === "Verse"
    ? plan.hook.join("") + phrases.Verse.slice(16) : phrases[section.name]);
  const pitches = (degree: number, octave = 0) => tonic + scale[(degree % 7 + 7) % 7] + 12 * (Math.floor(degree / 7) + octave);
  const bright = ["Rock", "EDM", "Chiptune"].includes(plan.genre);
  const acoustic = ["Classical", "Folk", "Orchestra"].includes(plan.genre);
  const tracks = Object.fromEntries(trackIds.map((id) => [id, Array<number>(section.bars * STEPS_PER_BAR).fill(0)])) as Tracks;
  const pianoVoicing = acoustic ? [0, -1, 2, -1, 4, -1, 2, -1] : [0, -1, -1, 2, 4, -1, -1, -1];
  const guitarVoicing = bright ? [0, -1, 4, -1, 0, -1, 4, -1] : [-1, -1, 2, -1, -1, -1, 4, -1];
  const lead = section.lead === "drums" || section.lead === "shaker" ? profile.lead : section.lead;
  const ensemble = section.ensemble === "solo" ? [] : section.ensemble?.split(",") as TrackId[] | undefined;
  const allowed = (id: TrackId) => !ensemble || ensemble.includes(id);
  const colour = (ensemble ?? profile.colour).filter((id) => ![lead, "keys", "bass", "guitar", "drums"].includes(id));
  const swell = section.name === "Chorus" && index >= 3;
  const harmonyVoice = acoustic ? (lead === "violin" ? "flute" : "violin") : (lead === "keys" ? "guitar" : "keys");
  for (let bar = 0; bar < section.bars; bar++) {
    const closing = section.name === "Outro" && bar === section.bars - 1;
    const cadence = bar === section.bars - 1 || section.name === "Outro" && bar === section.bars - 2;
    const root = closing ? 0 : section.name === "Outro" && cadence ? 4 : progression[bar % 4];
    const nextRoot = section.name === "Outro" && bar >= section.bars - 2 ? 0 : progression[(bar + 1) % 4];
    const bassRoot = pitches(root, -2);
    const arrival = pitches(nextRoot, -2);
    const approach = arrival + (arrival > bassRoot ? -1 : 1);
    const comp = jazz && !closing ? jazzComp[bar % jazzComp.length] : pianoVoicing;
    const indexOf = (step: number) => bar * STEPS_PER_BAR + step;
    const fill = bar % 4 === 3 && !closing;
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const position = indexOf(step);
      const motifStep = (bar % 4) * STEPS_PER_BAR + step;
      const accent = step === 0 || step === 4;
      const theme = closing ? step === 0 ? 1 : 0 : Number(phrase[motifStep]);
      if (theme) {
        const degree = theme - 1;
        const chord = [root - 7, root - 5, root - 3, root, root + 2, root + 4, root + 7];
        const voiced = accent && !closing ? chord.reduce((closest, next) =>
          Math.abs(next - degree) < Math.abs(closest - degree) ? next : closest) : degree;
        tracks[lead][position] = inRegister(pitches(voiced, swell && voiced <= 4 ? 1 : 0), lead);
      }
      if (lead !== "keys" && allowed("keys") && comp[step] >= 0 && !(closing && step)) tracks.keys[position] = pitches(root + comp[step], -1);
      if (lead !== "guitar" && allowed("guitar") && guitarVoicing[step] >= 0 && (ensemble || section.energy >= 3) && !(closing && step)) {
        tracks.guitar[position] = pitches(root + guitarVoicing[step], -1);
      }
      if (lead !== "bass" && allowed("bass")) {
        if (jazz && !closing && step % 2 === 0) {
          tracks.bass[position] = step === 6 ? approach : pitches(root + step, -2);
        } else if (!jazz && !closing && rock && step % 2 === 0) {
          tracks.bass[position] = pitches(root + (step === 6 && fill ? 4 : 0), -2);
        } else if (step === 0 || !closing && (step === 4 && section.energy > 1 || bright && step === 6 && section.energy > 3)) {
          tracks.bass[position] = pitches(root + (step === 6 ? 4 : 0), -2);
        }
      }
      if (!closing && allowed("drums") && (ensemble || section.energy >= 4 || !acoustic && section.energy >= 3 || bright && section.energy >= 2)) {
        tracks.drums[position] = jazz ? (step === 2 || step === 3 || step === 4 || step === 6 || step === 7 ? 42
          : step === 0 ? 36 : step === 5 && fill ? 38 : 0)
          : rock ? (step === 2 || step === 6 ? 38 : step === 0 || step === 4 || step === 5 && fill ? 36 : 42)
          : acoustic ? step === 0 || step === 4 && swell ? 36 : fill && step === 6 ? 42 : 0
          : step === 0 || step === 4 ? 36 : step === 2 || step === 6 || fill && step === 7 ? 38 : 42;
      }
      if (!jazz && allowed(harmonyVoice) && (step === 0 && (acoustic || section.energy >= 4) || step === 5 && acoustic && section.energy >= 3 && !closing)) {
        tracks[harmonyVoice][position] = inRegister(pitches(root + (step ? 4 : 2)), harmonyVoice);
      }
      for (const [layer, id] of colour.entries()) {
        if (!ensemble && section.energy < layer + 2 || closing || (step + 2 * layer) % (layer >= 2 ? 8 : 4) !== 0 || tracks[id][position]) continue;
        if (bar === 0 && section.name === "Intro" && layer > 0) continue;
        tracks[id][position] = id === "shaker" ? 70 : inRegister(pitches(root + 2 * (layer + 1), id === "bells" ? 1 : 0), id);
      }
      if (allowed("shaker") && section.energy === 5 && fill && step === 7) tracks.shaker[position] = 70;
    }
  }
  return { ...section, tracks };
}

export function validNote(id: TrackId, note: unknown): note is number {
  return typeof note === "number" && Number.isInteger(note)
    && (note === 0 || (id === "drums" ? [36, 38, 42].includes(note) : id === "shaker" ? note === 70 : note >= 28 && note <= 96));
}

export function parsePlan(value: unknown, mode: "stored" | "create" | "edit" = "stored"): SongPlan {
  if (!value || typeof value !== "object") throw new Error("The arrangement could not be read.");
  const plan = value as Partial<SongPlan>;
  if (typeof plan.title !== "string" || !plan.title.trim() || plan.title.length > 64 || !plan.genre || !genres.includes(plan.genre)
    || !plan.key || !keys.includes(plan.key) || !Number.isInteger(plan.bpm) || plan.bpm! < 60 || plan.bpm! > 180) {
    throw new Error("The song needs a title, musical key, and a tempo from 60 to 180 BPM.");
  }
  if (!Array.isArray(plan.hook) || plan.hook.length !== 16 || plan.hook.some((n) => !Number.isInteger(n) || n < 0 || n > 7)
    || mode === "create" && !plan.hook.some(Boolean)) throw new Error("Gemini returned an invalid melody.");
  if (!Array.isArray(plan.sections) || plan.sections.length < 4 || plan.sections.length > 8
    || plan.sections.some((s) => !s || !kinds.includes(s.name) || !trackIds.includes(s.lead)
       || ![2, 4, 6, 8, 10, 12, 14, 16].includes(s.bars) || ![1, 2, 3, 4, 5].includes(s.energy))
    || plan.sections.reduce((sum, s) => sum + s.bars, 0) > 72) throw new Error("The song needs four to eight sections and at most 72 bars.");
  const sections = plan.sections.map((part) => {
    const phrase = typeof part.phrase === "string" ? part.phrase.replace(/\s/g, "") : undefined;
    const harmony = typeof part.harmony === "string" ? part.harmony.replace(/\s/g, "") : undefined;
    const palette = typeof part.ensemble === "string" ? part.ensemble.toLowerCase().replace(/\s/g, "") : undefined;
    const instruments = palette?.split(",") ?? [];
    const ensemble = palette === "solo" ? palette : instruments.length <= 9 && instruments.length > 0
      && instruments.every((id) => trackIds.includes(id as TrackId)) ? [...new Set(instruments)].join(",") : undefined;
    const validPhrase = phrase && /^[0-7-]{32}$/.test(phrase) && /[1-7]/.test(phrase) ? phrase : undefined;
    const validHarmony = harmony && /^[1-7]{4}$/.test(harmony) ? harmony : undefined;
    if (mode !== "stored" && (
      (mode === "create" || part.phrase) && !validPhrase ||
      (mode === "create" || part.harmony) && !validHarmony ||
      (mode === "create" || part.ensemble) && !ensemble
    )) throw new Error(`Gemini returned an invalid ${part.name.toLowerCase()} phrase, chord progression, or instrument list.`);
    const id = typeof part.id === "string" && /^[a-zA-Z0-9_-]{1,64}$/.test(part.id) ? part.id : undefined;
    return { id, name: part.name, bars: part.bars, energy: part.energy, lead: part.lead, phrase: validPhrase, harmony: validHarmony, ensemble };
  });
  return { title: plan.title.trim(), genre: plan.genre, key: plan.key, bpm: plan.bpm!, hook: plan.hook, sections };
}

export function compileSong(plan: SongPlan, previous?: Song): Song {
  const sameKey = previous && plan.genre === previous.genre && plan.key === previous.key;
  const sameHook = previous && plan.hook.every((value, index) => value === previous.hook[index]);
  const used = new Set<Section>();
  const reserved = new Set(plan.sections.map((part) => part.id).filter(Boolean));
  const sameArrangement = (left: SectionPlan, right: SectionPlan) => left.name === right.name && left.bars === right.bars
    && left.energy === right.energy && left.lead === right.lead && left.phrase === right.phrase && left.harmony === right.harmony
    && left.ensemble === right.ensemble;
  return {
    ...plan,
    sections: plan.sections.map((section, index) => {
      const old = previous?.sections.find((candidate) => !used.has(candidate) && (section.id
        ? candidate.id === section.id
        : !reserved.has(candidate.id) && sameArrangement(section, candidate)));
      if (old) used.add(old);
      const id = old?.id ?? crypto.randomUUID();
      if (sameKey && (section.phrase || section.name !== "Verse" || sameHook) && old && sameArrangement(section, old)) return { ...old, id };
      const arranged = arrangeSection(plan, { ...section, id }, index);
      if (old?.noteEdits && sameKey) {
        arranged.noteEdits = old.noteEdits;
        for (const track of trackIds) {
          for (const [offset, pitch] of Object.entries(old.noteEdits[track] ?? {})) {
            const step = Number(offset);
            if (step < arranged.tracks[track].length) arranged.tracks[track][step] = pitch;
          }
        }
      }
      return arranged;
    }),
  };
}

export function planFromDeviceSketch(value: unknown): SongPlan {
  if (!value || typeof value !== "object") throw new Error("The device sketch could not be read.");
  const sketch = value as Partial<SongPlan> & { bars?: number; theme?: number[]; contrast?: number[]; lead?: TrackId; ensemble?: TrackId[] };
  const usableMotif = (notes: unknown): notes is number[] => Array.isArray(notes) && notes.length === 8
    && notes.every((note) => Number.isInteger(note) && note >= 0 && note <= 7) && notes.some(Boolean);
  if (!usableMotif(sketch.theme) || !usableMotif(sketch.contrast)) throw new Error("The sketch needs two eight-step motifs with notes.");
  if (!Number.isInteger(sketch.bars) || sketch.bars! < 8 || sketch.bars! > 72 || sketch.bars! % 2) {
    throw new Error("The sketch needs an even song length from 8 through 72 bars.");
  }
  if (!sketch.lead || !trackIds.includes(sketch.lead) || sketch.lead === "drums" || sketch.lead === "shaker"
    || !Array.isArray(sketch.ensemble) || sketch.ensemble.length > 5 || sketch.ensemble.some((id) => !trackIds.includes(id))) {
    throw new Error("The sketch needs a melodic instrument and a valid backing group.");
  }
  const theme = sketch.theme.join("");
  const contrast = sketch.contrast.join("");
  const ensemble = [...new Set(sketch.ensemble.filter((id) => id !== sketch.lead))];
  const total = sketch.bars!;
  const names = total < 24 ? (["Intro", "Verse", "Bridge", "Outro"] as const)
    : (["Intro", "Verse", "Chorus", "Bridge", "Chorus", "Outro"] as const);
  const units = total / 2;
  const base = Math.floor(units / names.length);
  const extra = units % names.length;
  return parsePlan({
    title: sketch.title, genre: sketch.genre, key: sketch.key, bpm: sketch.bpm, hook: [...sketch.theme, ...sketch.contrast],
    sections: names.map((name, index) => {
      const phrase = name === "Bridge" ? contrast + theme + contrast + contrast
        : name === "Chorus" ? theme + theme + contrast + theme
        : name === "Outro" ? contrast + theme + contrast + "1-------" : theme + contrast + theme + contrast;
      const harmony = sketch.genre === "Jazz" ? (name === "Bridge" ? "3625" : "2516")
        : name === "Bridge" ? "6345" : name === "Chorus" ? "1564" : "1645";
      return {
        name, bars: 2 * (base + (index < extra ? 1 : 0)), energy: name === "Intro" || name === "Outro" ? 2 : name === "Chorus" ? 5 : 3,
        lead: sketch.lead, phrase, harmony, ensemble: ensemble.join(",") || "solo",
      };
    }),
  }, "create");
}

export const durationBars = (song: Song) => song.sections.reduce((sum, section) => sum + section.bars, 0);
export const durationSecs = (song: Song) => durationBars(song) * 240 / song.bpm;
export const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

function readSaved<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? "null");
  } catch {
    return null;
  }
}

function savedSong(song: Song | null | undefined) {
  try {
    const plan = parsePlan(song);
    if (song?.sections.every((section) => trackIds.every((id) => {
      const notes = section.tracks?.[id];
      return Array.isArray(notes) && notes.length === section.bars * STEPS_PER_BAR && notes.every((note) => validNote(id, note));
    }))) {
      const ids = new Set<string>();
      return { ...plan, sections: song.sections.map((section, index) => {
        const part = plan.sections[index];
        const id = part.id && !ids.has(part.id) ? part.id : crypto.randomUUID();
        ids.add(id);
        return { ...part, id, tracks: section.tracks, noteEdits: section.noteEdits };
      }) };
    }
  } catch { /* Fall back to an earlier save or a preset. */ }
}

function legacySong() {
  const old = readSaved<Partial<SongPlan> & { tracks?: Partial<Tracks> }>("waypin-toybox-score");
  if (!old?.genre || !genres.includes(old.genre) || typeof old.title !== "string"
    || !old.title.trim() || typeof old.bpm !== "number" || !Number.isInteger(old.bpm) || old.bpm < 60 || old.bpm > 180) return;
  const song = preset(old.genre);
  song.title = old.title.trim().slice(0, 64);
  song.bpm = old.bpm;
  for (const id of ["keys", "guitar", "bass", "drums"] as const) {
    const notes = old.tracks?.[id];
    if (Array.isArray(notes) && notes.length === 16 && notes.every((note) => validNote(id, note))) {
      song.sections[0].tracks[id].splice(0, 16, ...notes);
    }
  }
  return song;
}

type StudioSettings = { song: Song; mix: Mix; master: number; loop: boolean };
type StoredSettings = StudioSettings & { revision?: string };
const savedPrefix = "toybox-studio:project:";
const volumeInRange = (value: unknown): value is number => typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= 100;

export function loadStudio() {
  const params = new URLSearchParams(location.search);
  const example = examples.find(({ id }) => id === params.get("example"));
  const draft = params.get("draft");
  const key = draft && /^[a-zA-Z0-9_-]{1,64}$/.test(draft) ? savedPrefix + draft : example ? `toybox-studio:${example.id}` : "toybox-studio";
  const saved = readSaved<Partial<StoredSettings>>(key);
  const song = savedSong(saved?.song) ?? (example
    ? preset(example.genre)
    : savedSong(readSaved<Song>("toybox-full-song")) ?? legacySong() ?? preset("Orchestra"));
  const mix = defaultMix();
  for (const id of trackIds) {
    const track = saved?.mix?.[id];
    if (track && volumeInRange(track.volume) && typeof track.muted === "boolean") {
      mix[id] = track;
    }
  }
  return { key, revision: saved?.revision, song, mix, master: volumeInRange(saved?.master) ? saved.master : 82, loop: saved?.loop === true };
}

export const newDraftKey = () => savedPrefix + crypto.randomUUID();

export function draftQuery(key: string) {
  if (key.startsWith(savedPrefix)) return "?draft=" + encodeURIComponent(key.slice(savedPrefix.length));
  return key === "toybox-studio" ? "" : "?example=" + encodeURIComponent(key.slice("toybox-studio:".length));
}

export function listDrafts() {
  try {
    const result: { key: string; title: string }[] = [];
    for (let index = 0; index < localStorage.length; index++) {
      const key = localStorage.key(index);
      if (!key?.startsWith("toybox-studio")) continue;
      const title = readSaved<Partial<StoredSettings>>(key)?.song?.title;
      if (typeof title === "string" && title.trim()) result.push({ key, title });
    }
    return result.sort((a, b) => a.title.localeCompare(b.title));
  } catch { return []; }
}

export function saveStudio(key: string, settings: StudioSettings, expectedRevision?: string) {
  try {
    const current = readSaved<Partial<StoredSettings>>(key);
    const forked = current?.revision !== expectedRevision;
    const destination = forked ? newDraftKey() : key;
    const revision = crypto.randomUUID();
    localStorage.setItem(destination, JSON.stringify({ ...settings, revision }));
    return { key: destination, revision, forked };
  } catch { return null; }
}

const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export function noteLabel(id: TrackId, note: number) {
  if (!note) return "Rest";
  if (id === "drums") return ({ 36: "Kick", 38: "Snare", 42: "Hat" })[note] ?? "Drum";
  if (id === "shaker") return "Shake";
  return `${noteNames[note % 12]}${Math.floor(note / 12) - 1}`;
}

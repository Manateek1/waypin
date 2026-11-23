export const trackIds = ["keys", "guitar", "bass", "drums", "brass", "violin", "flute", "harp", "bells", "shaker"] as const;
export type TrackId = typeof trackIds[number];
export const genres = ["Classical", "Rock", "Orchestra", "Lo-fi", "Jazz", "EDM", "Chiptune", "Folk"] as const;
export type Genre = typeof genres[number];
export const STEPS_PER_BAR = 8;
export const kinds = ["Intro", "Verse", "Chorus", "Bridge", "Outro"] as const;
export const keys = ["C major", "D major", "G major", "A minor", "E minor", "D minor"] as const;
export type SectionPlan = { name: typeof kinds[number]; bars: number; energy: number; lead: TrackId };
export type SongPlan = { title: string; genre: Genre; bpm: number; key: typeof keys[number]; hook: number[]; sections: SectionPlan[] };
export type Tracks = Record<TrackId, number[]>;
export type Section = SectionPlan & { tracks: Tracks };
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
    { name: "Outro", bars: 4, energy: 1, lead: colour[2] },
  ] };
  return compileSong(plan);
}

const tonics: Record<SongPlan["key"], number> = { "C major": 60, "D major": 62, "G major": 55, "A minor": 57, "E minor": 64, "D minor": 62 };
const scales = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const progressions = { bridge: [5, 3, 6, 4], verse: [0, 5, 3, 4], chorus: [0, 4, 5, 3] };

function arrangeSection(plan: SongPlan, section: SectionPlan, index: number): Section {
  const scale = plan.key.includes("minor") ? scales.minor : scales.major;
  const tonic = tonics[plan.key];
  const profile = genreProfiles[plan.genre];
  const progression = section.name === "Bridge" ? progressions.bridge : section.name === "Chorus" ? progressions.chorus : progressions.verse;
  const pitches = (degree: number, octave = 0) => tonic + scale[degree % 7] + 12 * (Math.floor(degree / 7) + octave);
  const bright = ["Rock", "EDM", "Chiptune"].includes(plan.genre);
  const acoustic = ["Classical", "Folk", "Orchestra"].includes(plan.genre);
  const tracks = Object.fromEntries(trackIds.map((id) => [id, Array<number>(section.bars * STEPS_PER_BAR).fill(0)])) as Tracks;
  for (let bar = 0; bar < section.bars; bar++) {
    const closing = section.name === "Outro" && bar === section.bars - 1;
    const root = closing ? 0 : progression[(bar + (section.name === "Bridge" ? 1 : 0)) % progression.length];
    const indexOf = (step: number) => bar * STEPS_PER_BAR + step;
    const fill = bar % 4 === 3 && !closing;
    for (let step = 0; step < STEPS_PER_BAR; step++) {
      const position = indexOf(step);
      const motifStep = (bar % 2) * STEPS_PER_BAR + step;
      const accent = step === 0 || step === 4;
      const theme = plan.hook[motifStep];
      const lead = section.lead === "drums" || section.lead === "shaker" ? profile.lead : section.lead;
      if (theme && (!closing || step === 0) && (section.energy >= 3 || step % 2 === 0)) {
        const degree = closing ? 0 : accent ? root + ((theme - 1) % 3) * 2 : (theme - 1 + (fill ? 1 : 0)) % 7;
        tracks[lead][position] = pitches(degree, section.name === "Chorus" && index > 2 ? 1 : 0);
      }
      if (!tracks.keys[position] && (accent || acoustic && step === 2) && !(closing && step)) tracks.keys[position] = pitches(root + (step ? 2 : 0));
      if (!tracks.guitar[position] && (bright ? step % 2 === 0 : step === 2 || step === 6) && section.energy >= 3) tracks.guitar[position] = pitches(root + (step > 3 ? 4 : 0), -1);
      if (!tracks.bass[position] && (step === 0 || step === 4 && section.energy > 1 || bright && step === 6 && section.energy > 3)) tracks.bass[position] = pitches(root + (step === 6 ? 4 : 0), -2);
      if (section.energy >= 3 || bright && section.energy >= 2) {
        tracks.drums[position] = step === 0 || step === 4 ? 36 : step === 2 || step === 6 || fill && step === 7 ? 38 : 42;
      }
      for (const [layer, id] of profile.colour.entries()) {
        if (section.energy < layer + 2 || closing && step !== 0 || (step + 2 * layer) % (layer === 2 ? 8 : 4) !== 0 || tracks[id][position]) continue;
        tracks[id][position] = id === "shaker" ? 70 : pitches(root + 2 * (layer + 1), id === "bells" ? 1 : 0);
      }
      if (section.energy === 5 && fill && step === 7) tracks.shaker[position] = 70;
    }
  }
  return { ...section, tracks };
}

export function validNote(id: TrackId, note: unknown): note is number {
  return typeof note === "number" && Number.isInteger(note)
    && (note === 0 || (id === "drums" ? [36, 38, 42].includes(note) : id === "shaker" ? note === 70 : note >= 28 && note <= 96));
}

export function parsePlan(value: unknown): SongPlan {
  if (!value || typeof value !== "object") throw new Error("The arrangement could not be read.");
  const plan = value as Partial<SongPlan>;
  if (typeof plan.title !== "string" || !plan.title.trim() || plan.title.length > 64 || !plan.genre || !genres.includes(plan.genre)
    || !plan.key || !keys.includes(plan.key) || !Number.isInteger(plan.bpm) || plan.bpm! < 60 || plan.bpm! > 180) {
    throw new Error("The song needs a title, musical key, and a tempo from 60 to 180 BPM.");
  }
  if (!Array.isArray(plan.hook) || plan.hook.length !== 16 || plan.hook.some((n) => !Number.isInteger(n) || n < 0 || n > 7)) throw new Error("Gemini returned an invalid melody.");
  if (!Array.isArray(plan.sections) || plan.sections.length < 4 || plan.sections.length > 8
    || plan.sections.some((s) => !s || !kinds.includes(s.name) || !trackIds.includes(s.lead)
       || ![2, 4, 6, 8, 10, 12, 14, 16].includes(s.bars) || ![1, 2, 3, 4, 5].includes(s.energy))
    || plan.sections.reduce((sum, s) => sum + s.bars, 0) > 72) throw new Error("The song needs four to eight sections and at most 72 bars.");
  return { title: plan.title.trim(), genre: plan.genre, key: plan.key, bpm: plan.bpm!, hook: plan.hook, sections: plan.sections };
}

export function compileSong(plan: SongPlan, previous?: Song): Song {
  const sameTheme = previous && plan.genre === previous.genre && plan.key === previous.key
    && plan.hook.every((value, index) => value === previous.hook[index]);
  return {
    ...plan,
    sections: plan.sections.map((section, index) => {
      const old = previous?.sections[index];
      return sameTheme && old && section.name === old.name && section.bars === old.bars && section.energy === old.energy && section.lead === old.lead
        ? old : arrangeSection(plan, section, index);
    }),
  };
}
export const durationBars = (song: Song) => song.sections.reduce((sum, section) => sum + section.bars, 0);
export const durationSecs = (song: Song) => durationBars(song) * 240 / song.bpm;
export const timeLabel = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.floor(seconds % 60)).padStart(2, "0")}`;

export function loadSong() {
  const example = examples.find(({ id }) => id === new URLSearchParams(location.search).get("example"));
  if (example) return preset(example.genre);
  try {
    const json = localStorage.getItem("toybox-full-song");
    if (json) {
      const parsed = JSON.parse(json) as Song;
      parsePlan(parsed);
      if (parsed.sections.every((section) => trackIds.every((id) =>
        section.tracks[id].length === section.bars * STEPS_PER_BAR && section.tracks[id].every((note) => validNote(id, note))))) return parsed;
    }
    const old = JSON.parse(localStorage.getItem("waypin-toybox-score") ?? "null");
    if (old && genres.includes(old.genre) && typeof old.title === "string" && Number.isInteger(old.bpm) && old.bpm >= 60 && old.bpm <= 180) {
      const song = preset(old.genre);
      song.title = old.title.slice(0, 64);
      song.bpm = old.bpm;
      for (const id of ["keys", "guitar", "bass", "drums"] as const) {
        const notes: unknown[] | undefined = old.tracks?.[id];
        if (Array.isArray(notes) && notes.length === 16 && notes.every((note) => validNote(id, note))) {
          song.sections[0].tracks[id].splice(0, 16, ...(notes as number[]));
        }
      }
      return song;
    }
  } catch { /* A fresh song also works in browsers that block local storage. */ }
  return preset("Orchestra");
}

const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];
export function noteLabel(id: TrackId, note: number) {
  if (!note) return "Rest";
  if (id === "drums") return ({ 36: "Kick", 38: "Snare", 42: "Hat" })[note] ?? "Drum";
  if (id === "shaker") return "Shake";
  return `${noteNames[note % 12]}${Math.floor(note / 12) - 1}`;
}

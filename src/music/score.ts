export const trackIds = ["keys", "guitar", "bass", "drums"] as const;
export type TrackId = typeof trackIds[number];
export type Genre = "Classical" | "Rock" | "Orchestra";
export type Score = { title: string; genre: Genre; bpm: number; tracks: Record<TrackId, number[]> };

export const STEPS = 16;
export const genres: Genre[] = ["Classical", "Rock", "Orchestra"];
export const toys = [
  { id: "keys", name: "Pip", instrument: "Keys", colour: "lilac", pitch: 72, volume: 76 },
  { id: "guitar", name: "Ember", instrument: "Guitar / strings", colour: "peach", pitch: 64, volume: 58 },
  { id: "bass", name: "Moss", instrument: "Bass", colour: "mint", pitch: 43, volume: 66 },
  { id: "drums", name: "Biscuit", instrument: "Drums", colour: "yellow", pitch: 36, volume: 56 },
] as const;

const presets: Record<Genre, Score> = {
  Classical: {
    title: "Porcelain Waltz", genre: "Classical", bpm: 96,
    tracks: {
      keys: [72, 76, 79, 76, 74, 77, 81, 77, 76, 79, 84, 79, 74, 77, 79, 71],
      guitar: [60, 0, 67, 0, 62, 0, 69, 0, 64, 0, 72, 0, 55, 0, 67, 0],
      bass: [48, 0, 0, 0, 50, 0, 0, 0, 52, 0, 0, 0, 43, 0, 0, 0],
      drums: [0, 0, 42, 0, 0, 0, 42, 0, 0, 0, 42, 0, 0, 0, 42, 0],
    },
  },
  Rock: {
    title: "Cardboard Riot", genre: "Rock", bpm: 122,
    tracks: {
      keys: [0, 0, 72, 0, 0, 0, 70, 0, 0, 0, 72, 0, 74, 0, 75, 0],
      guitar: [52, 52, 55, 52, 57, 0, 55, 52, 52, 52, 55, 59, 57, 55, 52, 0],
      bass: [40, 0, 40, 40, 45, 0, 43, 0, 40, 0, 40, 47, 45, 0, 40, 0],
      drums: [36, 42, 38, 42, 36, 42, 38, 42, 36, 42, 38, 36, 36, 42, 38, 42],
    },
  },
  Orchestra: {
    title: "Parade of Small Things", genre: "Orchestra", bpm: 108,
    tracks: {
      keys: [72, 0, 79, 76, 74, 0, 77, 81, 76, 0, 79, 84, 77, 74, 71, 0],
      guitar: [60, 0, 0, 67, 62, 0, 0, 69, 64, 0, 0, 72, 55, 0, 62, 0],
      bass: [48, 0, 0, 0, 50, 0, 0, 0, 52, 0, 0, 0, 43, 0, 0, 0],
      drums: [36, 0, 0, 42, 36, 0, 0, 42, 36, 0, 0, 42, 38, 0, 36, 0],
    },
  },
};

export const preset = (genre: Genre) => presets[genre];

export function parseScore(value: unknown): Score {
  if (!value || typeof value !== "object") throw new Error("The arrangement could not be read.");
  const candidate = value as Partial<Score>;
  if (typeof candidate.title !== "string" || !candidate.title.trim() || candidate.title.length > 64
    || !candidate.genre || !genres.includes(candidate.genre) || typeof candidate.bpm !== "number"
    || !Number.isInteger(candidate.bpm) || candidate.bpm < 60 || candidate.bpm > 180 || !candidate.tracks) {
    throw new Error("The arrangement needs a title, genre, and a tempo from 60 to 180 BPM.");
  }
  for (const id of trackIds) {
    const notes = candidate.tracks[id];
    if (!Array.isArray(notes) || notes.length !== STEPS || notes.some((note) =>
      !Number.isInteger(note) || (note !== 0 && (id === "drums" ? ![36, 38, 42].includes(note) : note < 28 || note > 96))
    )) throw new Error("The arrangement returned notes the toy band could not play.");
  }
  return { title: candidate.title.trim(), genre: candidate.genre, bpm: candidate.bpm, tracks: candidate.tracks };
}

export function loadScore() {
  try {
    const saved = localStorage.getItem("waypin-toybox-score");
    if (saved) return parseScore(JSON.parse(saved));
  } catch {
    // A fresh scene also works in browsers that block local storage.
  }
  return preset("Orchestra");
}

const noteNames = ["C", "C♯", "D", "D♯", "E", "F", "F♯", "G", "G♯", "A", "A♯", "B"];

export function noteLabel(id: TrackId, note: number) {
  if (!note) return "Rest";
  if (id === "drums") return ({ 36: "Kick", 38: "Snare", 42: "Hat" })[note] ?? "Drum";
  return `${noteNames[note % 12]}${Math.floor(note / 12) - 1}`;
}

import assert from "node:assert/strict";
import { test } from "node:test";
import { compileSong, defaultMix, durationBars, genres, jazzShellNote, parsePlan, planFromDeviceSketch, preset, saveStudio, trackIds, validNote } from "../src/music/score.ts";

const phrases = [
  "1---3000 5---2000 3--4-500 2---1000",
  "5---6000 7---5000 4--3-200 1---1000",
];

test("section phrases and harmony influence the rendered notes", () => {
  const presetSong = preset("Orchestra");
  const sections = presetSong.sections.map((part) => ({ name: part.name, bars: part.bars, energy: part.energy, lead: part.lead }));
  const make = (phrase, harmony) => compileSong(parsePlan({
    ...presetSong, sections: [{ ...sections[1], phrase, harmony }, ...sections.slice(2)],
  }));
  const first = make(phrases[0], "1645");
  const melody = make(phrases[1], "1645");
  const harmony = make(phrases[0], "6251");
  assert.equal(first.sections[0].phrase.length, 32);
  assert.notDeepEqual(first.sections[0].tracks.violin, melody.sections[0].tracks.violin);
  assert.notDeepEqual(first.sections[0].tracks.bass, harmony.sections[0].tracks.bass);
  const soloPlan = parsePlan({ ...first, sections: [{ ...first.sections[0], ensemble: "solo" }, ...first.sections.slice(1)] });
  const solo = compileSong(soloPlan);
  assert.ok(solo.sections[0].tracks.violin.some(Boolean));
  assert.ok(trackIds.filter((id) => id !== "violin").every((id) => !solo.sections[0].tracks[id].some(Boolean)));
});

test("tempo edits keep existing notes and phrase directions", () => {
  const presetSong = preset("Orchestra");
  const plan = parsePlan({
    ...presetSong,
    sections: presetSong.sections.map((part) => ({ ...part, phrase: phrases[0], harmony: "1645" })),
  });
  const song = compileSong(plan);
  song.sections[0].tracks.keys[0] = 59;
  const edited = compileSong({ ...parsePlan(song), bpm: 82 }, song);
  assert.equal(edited.bpm, 82);
  assert.deepEqual(edited.sections, song.sections);
  assert.equal(edited.sections[0].tracks.keys[0], 59);
});

test("every preset voices a full song without producing invalid grid notes", () => {
  for (const genre of genres) {
    const song = preset(genre);
    assert.equal(durationBars(song), 40);
    for (const section of song.sections) {
      for (const id of trackIds) {
        assert.ok(section.tracks[id].every((note) => validNote(id, note)), `${genre} ${section.name} ${id}`);
      }
    }
    const outro = song.sections.at(-1);
    assert.ok(outro.tracks[outro.lead][(outro.bars - 1) * 8]);
  }
});

test("rock backbeat and jazz walking bass use different rhythmic parts", () => {
  const rock = preset("Rock").sections[2].tracks;
  const jazz = preset("Jazz").sections[2].tracks;
  assert.equal(rock.drums[2], 38);
  assert.equal(rock.drums[6], 38);
  assert.deepEqual(jazz.drums.slice(0, 8), [36, 0, 42, 42, 42, 0, 42, 42]);
  assert.deepEqual(rock.bass.slice(0, 8).filter(Boolean), Array(4).fill(rock.bass[0]));
  assert.equal(new Set(jazz.bass.slice(0, 8).filter(Boolean)).size, 4);
  assert.equal(jazz.keys[2], 0);
  assert.ok(jazz.keys[3]);
  assert.equal(jazzShellNote(53, "C major"), 60); // Dm7: F and C.
  assert.equal(jazzShellNote(59, "C major"), 65); // G7: B and F.
});

test("inserting a section keeps the edited verse and doesn't reuse its ID", () => {
  const song = preset("Orchestra");
  song.sections[1].tracks.keys[0] = 95;
  song.sections[1].noteEdits = { keys: { 0: 95 } };
  const plan = parsePlan(song);
  const inserted = { ...plan.sections[0], id: undefined, bars: 2 };
  const edited = compileSong({ ...plan, sections: [inserted, ...plan.sections] }, song);
  assert.notEqual(edited.sections[0].id, song.sections[0].id);
  assert.equal(edited.sections[2].id, song.sections[1].id);
  assert.equal(edited.sections[2].tracks.keys[0], 95);
  plan.sections[1].energy++;
  assert.equal(compileSong(plan, song).sections[1].tracks.keys[0], 95);
});

test("generated scores reject missing or invalid musical choices", () => {
  const song = preset("Orchestra");
  const valid = { ...song, sections: song.sections.map((p) => ({ ...p, phrase: phrases[0], harmony: "1645", ensemble: "solo" })) };
  assert.equal(parsePlan(valid, "create").sections[0].ensemble, "solo");
  for (const changes of [{ phrase: "123" }, { harmony: "1238" }, { ensemble: "drum kit" }, { ensemble: "" }]) {
    assert.throws(() => parsePlan({ ...valid, sections: [{ ...valid.sections[0], ...changes }, ...valid.sections.slice(1)] }, "create"),
      /phrase, chord progression, or instrument list/);
  }
  assert.doesNotThrow(() => parsePlan(song, "stored"));
});

test("a stale tab saves a copy and a storage error is observable", () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const records = new Map();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key) => records.get(key),
    setItem: (key, value) => records.set(key, value),
  } });
  try {
    const settings = { song: preset("Jazz"), mix: defaultMix(), master: 82, loop: false };
    const first = saveStudio("toybox-studio", settings);
    const newer = saveStudio(first.key, settings, first.revision);
    const stale = saveStudio(first.key, { ...settings, master: 55 }, first.revision);
    assert.equal(stale.forked, true);
    assert.notEqual(stale.key, first.key);
    assert.equal(JSON.parse(records.get(first.key)).revision, newer.revision);
    assert.equal(JSON.parse(records.get(stale.key)).master, 55);
    localStorage.setItem = () => { throw new Error("Quota exceeded"); };
    assert.equal(saveStudio(first.key, settings, newer.revision), null);
  } finally {
    if (original) Object.defineProperty(globalThis, "localStorage", original);
    else delete globalThis.localStorage;
  }
});

test("a compact Nano sketch yields a complete arrangement that uses its motifs and instruments", () => {
  const sketch = { title: "Sketch", genre: "Folk", key: "G major", bpm: 92, bars: 18,
    lead: "guitar", ensemble: ["bass"], theme: [1, 0, 2, 3, 0, 5, 6, 0], contrast: [4, 0, 2, 0, 1, 5, 0, 3] };
  const piece = compileSong(planFromDeviceSketch(sketch));
  assert.equal(durationBars(piece), 18);
  assert.ok(piece.sections[1].tracks.guitar.some(Boolean));
  assert.ok(piece.sections[1].tracks.bass.some(Boolean));
  assert.ok(piece.sections.every((part) => !part.tracks.drums.some(Boolean)));
  assert.notDeepEqual(piece.sections[1].phrase, piece.sections[2].phrase);
  assert.throws(() => planFromDeviceSketch({ ...sketch, theme: Array(8).fill(0) }), /eight-step motifs/);
});

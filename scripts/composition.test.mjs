import assert from "node:assert/strict";
import { test } from "node:test";
import { compileSong, durationBars, genres, parsePlan, preset, trackIds, validNote } from "../src/music/score.ts";

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

import { Voices } from "./samples";
import { encodeMp3, encodeWav, type AudioFormat } from "./exportAudio";
import { durationSecs, STEPS_PER_BAR, trackIds, type Genre, type Mix, type Section, type Song, type TrackId } from "./score";

export type Position = { section: number; step: number };
type PlayerState = { song: Song; mix: Mix; master: number; loop: boolean };

const releaseTail = 1;
const swing = (genre: Genre, step: number) => step % 2 ? genre === "Jazz" ? .28 : genre === "Lo-fi" ? .15 : 0 : 0;

function playStep(voices: Voices, id: TrackId, section: Section, step: number, time: number, gap: number, genre: Genre, destination: AudioNode) {
  const notes = section.tracks[id];
  const note = notes[step];
  if (!note) return;
  let length = 1;
  while (length < 4 && !notes[step + length]) length++;
  const beat = step % STEPS_PER_BAR;
  const accent = (beat === 0 ? 1 : beat % 2 === 0 ? .86 : .67) * (.66 + section.energy * .083);
  const start = time + swing(genre, step) * gap;
  const held = (length + swing(genre, step + length) - swing(genre, step)) * gap * .9;
  voices.play(id, note, start, held, accent, genre, destination);
}


export class ToyBand {
  private context?: AudioContext;
  private voices?: Voices;
  private bus?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private tracks?: Record<TrackId, GainNode>;
  private timer?: number;
  private displays = new Set<number>();
  private active = false;
  private playback = 0;

  private getContext() {
    const context = this.context ??= new AudioContext();
    this.voices ??= new Voices(context);
    return context;
  }

  async play(read: () => PlayerState, onStep: (position: Position | null) => void, firstSection = 0) {
    this.stop();
    const playback = this.playback;
    const ctx = this.getContext();
    const voices = this.voices!;
    try {
      await Promise.all([ctx.resume(), voices.load(read().song.genre)]);
    } catch (error) {
      if (playback !== this.playback) return false;
      throw error;
    }
    if (playback !== this.playback) return false;
    const bus = ctx.createGain();
    const limiter = ctx.createDynamicsCompressor();
    bus.connect(limiter).connect(ctx.destination);
    this.bus = bus;
    this.limiter = limiter;
    this.tracks = Object.fromEntries(trackIds.map((id) => {
      const gain = ctx.createGain();
      gain.connect(bus);
      return [id, gain];
    })) as Record<TrackId, GainNode>;
    this.active = true;
    let next = ctx.currentTime + .06;
    let sectionIndex = firstSection;
    let step = 0;

    const schedule = () => {
      if (!this.active) return;
      const { song, mix, master, loop } = read();
      const gap = 30 / song.bpm;
      this.updateMix(mix, master);
      while (next < ctx.currentTime + .1) {
        const section = song.sections[sectionIndex];
        if (!section) {
          if (loop) { sectionIndex = 0; step = 0; continue; }
          window.clearInterval(this.timer);
          this.timer = undefined;
          this.at(next + releaseTail, () => { this.stop(); onStep(null); });
          return;
        }
        if (step >= section.bars * STEPS_PER_BAR) { sectionIndex++; step = 0; continue; }
        const position = { section: sectionIndex, step };
        if (next >= ctx.currentTime) {
          for (const id of trackIds) {
            playStep(voices, id, section, step, next, gap, song.genre, this.tracks![id]);
          }
          this.at(next, () => onStep(position));
        }
        next += gap;
        step++;
      }
    };
    this.timer = window.setInterval(schedule, 25);
    schedule();
    return true;
  }

  updateMix(mix: Mix, master: number) {
    if (!this.context || !this.bus || !this.tracks) return;
    const time = this.context.currentTime;
    this.bus.gain.setTargetAtTime(master / 100, time, .02);
    for (const id of trackIds) this.tracks[id].gain.setTargetAtTime(mix[id].muted ? 0 : mix[id].volume / 100, time, .02);
  }

  stop() {
    this.playback++;
    this.active = false;
    window.clearInterval(this.timer);
    this.timer = undefined;
    for (const id of this.displays) window.clearTimeout(id);
    this.displays.clear();
    this.bus?.disconnect();
    this.limiter?.disconnect();
    this.bus = undefined;
    this.limiter = undefined;
    this.tracks = undefined;
  }

  async close() {
    this.stop();
    const context = this.context;
    this.context = undefined;
    this.voices = undefined;
    await context?.close();
  }

  async preview(id: TrackId, pitch: number, volume: number, master: number, genre: Genre) {
    const ctx = this.getContext();
    const voices = this.voices!;
    await Promise.all([ctx.resume(), voices.load(genre, [id])]);
    if (this.context !== ctx) return;
    const gain = ctx.createGain();
    gain.gain.value = volume * master / 10000;
    gain.connect(ctx.destination);
    voices.play(id, pitch, ctx.currentTime + .008, .7, 1, genre, gain);
    window.setTimeout(() => gain.disconnect(), 1300);
  }

  private at(time: number, callback: () => void) {
    const delay = Math.max(0, 1000 * (time - this.context!.currentTime));
    const id = window.setTimeout(() => { this.displays.delete(id); callback(); }, delay);
    this.displays.add(id);
  }
}

export async function renderSong(song: Song, mix: Mix, master: number, format: AudioFormat) {
  const rate = 44100;
  const ctx = new OfflineAudioContext(1, Math.ceil((durationSecs(song) + releaseTail) * rate), rate);
  const bus = ctx.createGain();
  bus.gain.value = master / 100;
  bus.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
  const voices = new Voices(ctx);
  const audibleTracks = trackIds.filter((id) => !mix[id].muted && mix[id].volume > 0);
  await voices.load(song.genre, audibleTracks);
  const gap = 30 / song.bpm;
  for (const id of audibleTracks) {
    const gain = ctx.createGain();
    gain.gain.value = mix[id].volume / 100;
    gain.connect(bus);
    let offset = 0;
    for (const section of song.sections) {
      section.tracks[id].forEach((_, step) => {
        playStep(voices, id, section, step, .02 + (offset + step) * gap, gap, song.genre, gain);
      });
      offset += section.bars * STEPS_PER_BAR;
    }
  }
  const samples = (await ctx.startRendering()).getChannelData(0);
  return format === "mp3" ? encodeMp3(samples, rate) : encodeWav(samples, rate);
}

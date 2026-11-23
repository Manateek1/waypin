import { Voices } from "./samples";
import { encodeMp3, encodeWav, type AudioFormat } from "./exportAudio";
import { durationSecs, STEPS_PER_BAR, trackIds, type Genre, type Mix, type Section, type Song, type TrackId } from "./score";

export type Position = { section: number; step: number };
type PlayerState = { song: Song; mix: Mix; master: number; loop: boolean };

const releaseTail = 1.25;
const swing = (genre: Genre, step: number) => step % 2 ? genre === "Jazz" ? .28 : genre === "Lo-fi" ? .15 : 0 : 0;
const pan: Record<TrackId, number> = {
  keys: -.36, guitar: .36, bass: 0, drums: .03, brass: .28, violin: -.50, flute: -.18, harp: .46, bells: .26, shaker: -.30,
};

function mixBus(ctx: BaseAudioContext, genre: Genre) {
  const bus = ctx.createGain();
  const limiter = ctx.createDynamicsCompressor();
  bus.connect(limiter).connect(ctx.destination);
  const room = ctx.createConvolver();
  const wet = ctx.createGain();
  wet.gain.value = genre === "Orchestra" || genre === "Classical" ? .20 : .12;
  const impulse = ctx.createBuffer(2, Math.ceil(ctx.sampleRate * .72), ctx.sampleRate);
  let seed = 1879;
  for (let channel = 0; channel < 2; channel++) {
    const data = impulse.getChannelData(channel);
    const start = Math.round(ctx.sampleRate * (.027 + channel * .007));
    for (let sample = start; sample < data.length; sample++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      data[sample] = (seed / 2147483648 - 1) * Math.pow(1 - sample / data.length, 4);
    }
  }
  room.buffer = impulse;
  bus.connect(room).connect(wet).connect(limiter);
  return { bus, limiter };
}

function mixTrack(ctx: BaseAudioContext, bus: AudioNode, id: TrackId) {
  const gain = ctx.createGain();
  const placement = ctx.createStereoPanner();
  placement.pan.value = pan[id];
  gain.connect(placement).connect(bus);
  return gain;
}

function playStep(voices: Voices, id: TrackId, section: Section, step: number, time: number, gap: number, genre: Genre, destination: AudioNode) {
  const notes = section.tracks[id];
  const note = notes[step];
  if (!note) return;
  let length = 1;
  const position = step % 32;
  const leadPhrase = id === section.lead ? section.phrase : undefined;
  const finalBar = section.name === "Outro" && step >= (section.bars - 1) * STEPS_PER_BAR;
  if (leadPhrase && /[1-7]/.test(leadPhrase[position] ?? "") && !finalBar) {
    while (length < 8 && leadPhrase[(position + length) % 32] === "-" && !notes[step + length]) length++;
  } else {
    while (length < (finalBar ? 7 : 4) && !notes[step + length]) length++;
  }
  const beat = step % STEPS_PER_BAR;
  const bar = Math.floor(step / STEPS_PER_BAR);
  const shape = Math.sin(Math.PI * (position + 3) / 38);
  const arc = section.name === "Outro" ? 1 - .23 * bar / section.bars : .88 + .15 * shape;
  const weight = id === section.lead ? 1.15 : .88;
  const accent = (beat === 0 ? 1 : beat % 2 === 0 ? .89 : .75) * (.46 + section.energy * .112) * arc * weight;
  const laidBack = ["Orchestra", "Classical", "Folk", "Jazz", "Lo-fi"].includes(genre);
  const delay = laidBack ? Math.min(.029, (pan[id] + .5) * .015 + (position % 3) * .004) : 0;
  const start = time + swing(genre, step) * gap + delay;
  const held = (length + swing(genre, step + length) - swing(genre, step)) * gap * (laidBack ? .96 : .86);
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
    const { bus, limiter } = mixBus(ctx, read().song.genre);
    this.bus = bus;
    this.limiter = limiter;
    this.tracks = Object.fromEntries(trackIds.map((id) => [id, mixTrack(ctx, bus, id)])) as Record<TrackId, GainNode>;
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
  const ctx = new OfflineAudioContext(2, Math.ceil((durationSecs(song) + releaseTail) * rate), rate);
  const { bus } = mixBus(ctx, song.genre);
  bus.gain.value = master / 100;
  const voices = new Voices(ctx);
  const audibleTracks = trackIds.filter((id) => !mix[id].muted && mix[id].volume > 0);
  await voices.load(song.genre, audibleTracks);
  const gap = 30 / song.bpm;
  for (const id of audibleTracks) {
    const gain = mixTrack(ctx, bus, id);
    gain.gain.value = mix[id].volume / 100;
    let offset = 0;
    for (const section of song.sections) {
      section.tracks[id].forEach((_, step) => {
        playStep(voices, id, section, step, .02 + (offset + step) * gap, gap, song.genre, gain);
      });
      offset += section.bars * STEPS_PER_BAR;
    }
  }
  const rendered = await ctx.startRendering();
  const left = rendered.getChannelData(0);
  const right = rendered.getChannelData(1);
  return format === "mp3" ? encodeMp3(left, right, rate) : encodeWav(left, right, rate);
}

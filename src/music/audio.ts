import { durationSecs, STEPS_PER_BAR, trackIds, type Genre, type Mix, type Song, type TrackId } from "./score";

export type Position = { section: number; step: number };
type PlayerState = { song: Song; mix: Mix; master: number; loop: boolean };

const decays: Record<TrackId, number> = { keys: .98, guitar: .83, bass: .95, drums: .64, brass: 1.13, violin: 1.42, flute: 1.15, harp: 1.5, bells: 1.9, shaker: .45 };
const levels: Record<TrackId, number> = { keys: .20, guitar: .17, bass: .26, drums: .38, brass: .14, violin: .14, flute: .14, harp: .15, bells: .12, shaker: .12 };

class Voices {
  private noise?: AudioBuffer;

  constructor(private context: BaseAudioContext) {}

  play(id: TrackId, pitch: number, time: number, stepTime: number, genre: Genre, destination: AudioNode) {
    const ctx = this.context;
    const envelope = ctx.createGain();
    const duration = Math.max(.055, Math.min(.54, stepTime * decays[id]));
    const bowed = id === "violin" || id === "flute" || id === "brass";
    const attack = bowed ? .047 : .008;
    const end = time + duration;
    envelope.connect(destination);
    envelope.gain.setValueAtTime(.0001, time);
    const level = id === "drums" ? (pitch === 36 ? .38 : pitch === 38 ? .21 : .09) : levels[id];
    envelope.gain.linearRampToValueAtTime(level, time + attack);
    envelope.gain.exponentialRampToValueAtTime(.0001, end);

    if (id === "shaker" || (id === "drums" && pitch !== 36)) {
      if (!this.noise) {
        this.noise = ctx.createBuffer(1, Math.ceil(ctx.sampleRate * .6), ctx.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      const source = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = id === "shaker" ? 4800 : pitch === 42 ? 7000 : 1400;
      source.buffer = this.noise;
      source.connect(filter).connect(envelope);
      source.start(time);
      source.stop(end);
      return;
    }

    const synth = ctx.createOscillator();
    const guitar = id === "guitar" && ["Rock", "EDM"].includes(genre);
    synth.type = id === "brass" || id === "violin" || guitar ? "sawtooth"
      : genre === "Chiptune" && (id === "keys" || id === "bass") ? "square"
      : id === "flute" || id === "drums" || id === "bells" ? "sine" : "triangle";
    let pitchHz = 440 * 2 ** ((pitch - 69) / 12);
    if (id === "drums") pitchHz = 150;
    synth.frequency.setValueAtTime(pitchHz, time);
    if (id === "drums") synth.frequency.exponentialRampToValueAtTime(45, end);
    if (id === "bells" || id === "harp") {
      const partial = ctx.createOscillator();
      const level = ctx.createGain();
      partial.frequency.value = pitchHz * (id === "bells" ? 2.74 : 2);
      level.gain.value = .26;
      partial.connect(level).connect(envelope);
      partial.start(time);
      partial.stop(end);
    }
    if (synth.type === "sawtooth" || synth.type === "square") {
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = id === "violin" ? 1380 : id === "brass" ? 1900 : 2450;
      synth.connect(filter).connect(envelope);
    } else synth.connect(envelope);
    synth.start(time);
    synth.stop(end);
  }
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
    try {
      await ctx.resume();
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
          this.at(next, () => { this.stop(); onStep(null); });
          return;
        }
        if (step >= section.bars * STEPS_PER_BAR) { sectionIndex++; step = 0; continue; }
        const position = { section: sectionIndex, step };
        if (next >= ctx.currentTime) {
          for (const id of trackIds) {
            const note = section.tracks[id][step];
            if (note) this.voices!.play(id, note, next, gap, song.genre, this.tracks![id]);
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
    await ctx.resume();
    const gain = ctx.createGain();
    gain.gain.value = volume * master / 10000;
    gain.connect(ctx.destination);
    this.voices!.play(id, pitch, ctx.currentTime + .008, .28, genre, gain);
    window.setTimeout(() => gain.disconnect(), 600);
  }

  private at(time: number, callback: () => void) {
    const delay = Math.max(0, 1000 * (time - this.context!.currentTime));
    const id = window.setTimeout(() => { this.displays.delete(id); callback(); }, delay);
    this.displays.add(id);
  }
}

export async function renderSong(song: Song, mix: Mix, master: number) {
  const rate = 24000;
  const ctx = new OfflineAudioContext(1, Math.ceil((durationSecs(song) + .45) * rate), rate);
  const bus = ctx.createGain();
  bus.gain.value = master / 100;
  bus.connect(ctx.createDynamicsCompressor()).connect(ctx.destination);
  const voices = new Voices(ctx);
  const gap = 30 / song.bpm;
  for (const id of trackIds) {
    if (mix[id].muted || !mix[id].volume) continue;
    const gain = ctx.createGain();
    gain.gain.value = mix[id].volume / 100;
    gain.connect(bus);
    let offset = 0;
    for (const section of song.sections) {
      section.tracks[id].forEach((note, step) => {
        if (note) voices.play(id, note, .02 + (offset + step) * gap, gap, song.genre, gain);
      });
      offset += section.bars * STEPS_PER_BAR;
    }
  }
  const samples = (await ctx.startRendering()).getChannelData(0);
  const bytes = new DataView(new ArrayBuffer(44 + samples.length * 2));
  const ascii = (start: number, value: string) => [...value].forEach((letter, index) => bytes.setUint8(start + index, letter.charCodeAt(0)));
  ascii(0, "RIFF"); bytes.setUint32(4, bytes.byteLength - 8, true); ascii(8, "WAVE");
  ascii(12, "fmt "); bytes.setUint32(16, 16, true); bytes.setUint16(20, 1, true); bytes.setUint16(22, 1, true);
  bytes.setUint32(24, rate, true); bytes.setUint32(28, rate * 2, true); bytes.setUint16(32, 2, true); bytes.setUint16(34, 16, true);
  ascii(36, "data"); bytes.setUint32(40, samples.length * 2, true);
  samples.forEach((sample, index) => bytes.setInt16(44 + index * 2, Math.round(Math.max(-1, Math.min(1, sample)) * 32767), true));
  return new Blob([bytes.buffer], { type: "audio/wav" });
}

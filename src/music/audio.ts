import { STEPS, trackIds, type Score, type TrackId } from "./score";

export type Mix = Record<TrackId, { volume: number; muted: boolean }>;

export class ToyBand {
  private context?: AudioContext;
  private bus?: GainNode;
  private limiter?: DynamicsCompressorNode;
  private tracks?: Record<TrackId, GainNode>;
  private noise?: AudioBuffer;
  private timer?: number;
  private displays = new Set<number>();
  private active = false;

  async play(read: () => { score: Score; mix: Mix; master: number; loop: boolean }, onStep: (step: number) => void) {
    this.stop();
    const context = this.context ??= new AudioContext();
    await context.resume();
    const bus = context.createGain();
    const limiter = context.createDynamicsCompressor();
    bus.connect(limiter).connect(context.destination);
    this.bus = bus;
    this.limiter = limiter;
    this.tracks = Object.fromEntries(trackIds.map((id) => {
      const gain = context.createGain();
      gain.connect(bus);
      return [id, gain];
    })) as Record<TrackId, GainNode>;
    this.active = true;
    let next = context.currentTime + 0.07;
    let index = 0;
    const schedule = () => {
      if (!this.active) return;
      const { score, mix, master, loop } = read();
      this.updateMix(mix, master);
      while (next < context.currentTime + 0.12) {
        const step = index % STEPS;
        const gap = 30 / score.bpm;
        if (index === STEPS && !loop) {
          window.clearInterval(this.timer);
          this.timer = undefined;
          this.at(next, () => { this.stop(); onStep(-1); });
          return;
        }
        if (next >= context.currentTime) {
          for (const id of trackIds) {
            const note = score.tracks[id][step];
            if (note) this.note(id, note, next, gap, score.genre);
          }
          this.at(next, () => onStep(step));
        }
        next += gap;
        index = step + 1;
      }
    };
    this.timer = window.setInterval(schedule, 25);
    schedule();
  }

  updateMix(mix: Mix, master: number) {
    if (!this.context || !this.bus || !this.tracks) return;
    const time = this.context.currentTime;
    this.bus.gain.setTargetAtTime(master / 100, time, 0.02);
    for (const id of trackIds) {
      this.tracks[id].gain.setTargetAtTime(mix[id].muted ? 0 : mix[id].volume / 100, time, 0.02);
    }
  }

  stop() {
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
    this.noise = undefined;
    await context?.close();
  }

  async preview(id: TrackId, pitch: number, volume: number, master: number, genre: Score["genre"]) {
    const context = this.context ??= new AudioContext();
    await context.resume();
    const gain = context.createGain();
    gain.gain.value = (volume * master) / 10000;
    gain.connect(context.destination);
    this.note(id, pitch, context.currentTime + 0.01, 0.28, genre, gain);
    window.setTimeout(() => gain.disconnect(), 800);
  }

  private at(time: number, callback: () => void) {
    const delay = Math.max(0, 1000 * (time - this.context!.currentTime));
    const id = window.setTimeout(() => { this.displays.delete(id); callback(); }, delay);
    this.displays.add(id);
  }

  private note(id: TrackId, pitch: number, time: number, step: number, genre: Score["genre"], destination = this.tracks![id]) {
    const context = this.context!;
    const amplitude = context.createGain();
    amplitude.connect(destination);
    if (id === "drums" && pitch !== 36) {
      if (!this.noise) {
        this.noise = context.createBuffer(1, Math.round(context.sampleRate * 0.2), context.sampleRate);
        const samples = this.noise.getChannelData(0);
        for (let i = 0; i < samples.length; i++) samples[i] = Math.random() * 2 - 1;
      }
      const source = context.createBufferSource();
      const filter = context.createBiquadFilter();
      source.buffer = this.noise;
      filter.type = "highpass";
      filter.frequency.value = pitch === 42 ? 6500 : 1200;
      source.connect(filter).connect(amplitude);
      const decay = pitch === 42 ? 0.055 : 0.14;
      amplitude.gain.setValueAtTime(pitch === 42 ? 0.11 : 0.23, time);
      amplitude.gain.exponentialRampToValueAtTime(0.001, time + decay);
      source.start(time);
      source.stop(time + decay);
      return;
    }

    const oscillator = context.createOscillator();
    const frequency = 440 * 2 ** ((pitch - 69) / 12);
    const attack = id === "guitar" && genre === "Orchestra" ? 0.06 : 0.008;
    const end = time + (id === "drums" ? 0.17 : id === "guitar" && genre === "Orchestra" ? step * 1.85 : step * 0.94);
    oscillator.type = id === "drums" ? "sine" : id === "guitar" && genre !== "Classical" ? "sawtooth" : "triangle";
    oscillator.frequency.setValueAtTime(id === "drums" ? 150 : frequency, time);
    if (id === "drums") oscillator.frequency.exponentialRampToValueAtTime(42, end);
    if (id === "guitar" && genre !== "Classical") {
      const filter = context.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = genre === "Rock" ? 2300 : 950;
      oscillator.connect(filter).connect(amplitude);
    } else oscillator.connect(amplitude);
    amplitude.gain.setValueAtTime(0.001, time);
    amplitude.gain.linearRampToValueAtTime(id === "drums" ? 0.42 : id === "bass" ? 0.28 : 0.16, time + attack);
    amplitude.gain.exponentialRampToValueAtTime(0.001, end);
    oscillator.start(time);
    oscillator.stop(end + 0.01);
  }
}

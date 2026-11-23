import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowRight, AudioLines, ChevronDown, Guitar, Music2, Piano, Play, Repeat2, RotateCcw, Sparkles, Square, Volume2, VolumeX } from "lucide-react";
import { appPath } from "../paths";
import { arrange, canArrange } from "./arrange";
import { ToyBand, type Mix } from "./audio";
import { genres, loadScore, noteLabel, preset, STEPS, toys, trackIds, type Genre, type Score, type TrackId } from "./score";
import "./studio.css";

const prompts = ["Make it sound like a tiny orchestra", "Give the fox a rock solo", "Make it slower and softer"];
const palette = { Classical: "classical", Rock: "rock", Orchestra: "orchestra" } as const;
const trackIcons = { keys: Piano, guitar: Guitar, bass: AudioLines, drums: Music2 };
const defaultMix = () => Object.fromEntries(toys.map((toy) => [toy.id, { volume: toy.volume, muted: false }])) as Mix;

export function Studio() {
  const [score, setScore] = useState(loadScore);
  const [mix, setMix] = useState(defaultMix);
  const [master, setMaster] = useState(79);
  const [loop, setLoop] = useState(true);
  const [playing, setPlaying] = useState(false);
  const [starting, setStarting] = useState(false);
  const [step, setStep] = useState(-1);
  const [prompt, setPrompt] = useState("");
  const [pending, setPending] = useState("");
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("");
  const [previous, setPrevious] = useState<{ score: Score; mix: Mix } | null>(null);
  const [focused, setFocused] = useState<{ id: TrackId; step: number } | null>(null);
  const audio = useRef<ToyBand | null>(null);
  const playerState = useRef({ score, mix, master, loop });
  playerState.current = { score, mix, master, loop };

  useEffect(() => {
    try { localStorage.setItem("waypin-toybox-score", JSON.stringify(score)); } catch { /* Storage is optional. */ }
  }, [score]);
  useEffect(() => { audio.current?.updateMix(mix, master); }, [mix, master]);
  useEffect(() => () => { void audio.current?.close().catch(() => undefined); }, []);

  async function transport() {
    if (playing) {
      audio.current?.stop();
      setPlaying(false);
      setStep(-1);
      return;
    }
    setStarting(true);
    try {
      audio.current ??= new ToyBand();
      await audio.current.play(() => playerState.current, (next) => {
        setStep(next);
        if (next === -1) setPlaying(false);
      });
      setPlaying(true);
    } catch {
      setMessage("Audio could not start. Check that this tab can play sound and try again.");
    } finally {
      setStarting(false);
    }
  }

  function applyScore(next: Score, nextSource: string) {
    setPrevious({ score, mix });
    setSource(nextSource);
    setScore(next);
  }

  function choosePreset(genre: Genre) {
    applyScore(preset(genre), "Preset");
    setMessage("");
  }

  async function edit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || pending || !canArrange) return;
    setPending("Arranging…");
    setMessage("");
    try {
      const volumes = Object.fromEntries(trackIds.map((id) => [id, mix[id].volume])) as Record<TrackId, number>;
      const result = await arrange(score, volumes, prompt.trim(), (percent) => setPending(percent < 100 ? `Downloading Nano · ${percent}%` : "Arranging on device…"));
      applyScore(result.score, result.source);
      setMix((current) => Object.fromEntries(trackIds.map((id) => [
        id, { ...current[id], volume: result.volumes[id] === volumes[id] ? current[id].volume : result.volumes[id] },
      ])) as Mix);
      setPrompt("");
      setMessage(`Arrangement updated to ${result.score.title}.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Couldn’t apply that edit. ${error.message}` : "Couldn’t apply that edit. Your loop is still playable.");
    } finally {
      setPending("");
    }
  }

  function updateNote(id: TrackId, index: number, note: number) {
    const notes = score.tracks[id].map((value, stepIndex) => stepIndex === index ? note : value);
    setScore({ ...score, tracks: { ...score.tracks, [id]: notes } });
  }

  const focusedPitch = focused ? score.tracks[focused.id][focused.step] : 0;
  const pitchOptions = focused?.id === "drums" ? [36, 38, 42] : Array.from({ length: 69 }, (_, n) => n + 28);

  return <div className="toy-studio">
    <a className="skip" href="#toy-workspace">Skip to studio</a>
    <header className="toy-header">
      <a className="toy-logo" href={appPath()}><span><AudioLines size={22} /></span> Toybox</a>
      <a className="toy-archive" href={appPath("audit/")}>Waypin audit <ArrowRight size={15} /></a>
    </header>
    <main className="toy-main" id="toy-workspace">
      <div className="toy-intro">
        <div><h1>Make a little <em>noise.</em></h1><p>Give your toy band an idea, then shape the loop together.</p></div>
        <div className="toy-genres" aria-label="Starting arrangement">
          {genres.map((genre) => <button key={genre} type="button" disabled={!!pending} className={`toy-genre ${palette[genre]}`} aria-pressed={score.genre === genre} onClick={() => choosePreset(genre)}>{genre}</button>)}
        </div>
      </div>
      <form className="toy-prompt" onSubmit={edit}>
        <label htmlFor="arrange-prompt"><Sparkles size={18} /> Tell the band what to change</label>
        <div className="toy-prompt-row">
          <input id="arrange-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={220} placeholder={prompts[0]} disabled={!!pending} />
          <button className="toy-button toy-primary" type="submit" disabled={!prompt.trim() || !!pending || !canArrange}>{pending || "Arrange"} <ArrowRight size={17} /></button>
        </div>
        <div className="toy-suggestions">{prompts.map((value) => <button key={value} type="button" disabled={!!pending} onClick={() => setPrompt(value)}>{value}</button>)}</div>
        {!canArrange && <p className="toy-feedback">Live prompts require cloud setup or supported desktop Chrome. You can play and edit every preset here.</p>}
        {message && <p className="toy-feedback" role="status">{message}</p>}
      </form>
      <div className="toy-grid">
        <section className="toy-panel toy-score" aria-label="Arrangement">
          <header className="toy-panel-heading"><div><p>Two-bar loop</p><h2>{score.title}</h2></div>
            {source && <span className="toy-source">{source}</span>}
          </header>
          <div className="toy-transport">
            <button className="toy-button toy-play" type="button" onClick={() => void transport()} disabled={starting}>{playing ? <Square size={17} fill="currentColor" /> : <Play size={18} fill="currentColor" />}{playing ? "Stop" : "Play"}</button>
            <button className="toy-button toy-outline" type="button" aria-pressed={loop} onClick={() => setLoop(!loop)}><Repeat2 size={17} /> Loop</button>
            <label className="toy-tempo">Tempo <input type="range" min={60} max={180} value={score.bpm} disabled={!!pending} onChange={(event) => setScore({ ...score, bpm: Number(event.target.value) })} /><output>{score.bpm} BPM</output></label>
            <button className="toy-icon" type="button" aria-label="Undo last arrangement change" disabled={!previous || !!pending} onClick={() => { if (previous) { setScore(previous.score); setMix(previous.mix); setPrevious(null); setSource(""); setMessage("Previous arrangement restored."); } }}><RotateCcw size={18} /></button>
          </div>
          <div className="toy-sequence-scroll">
            <div className="toy-sequence">
              <div className="toy-count-row"><span>Track</span>{Array.from({ length: STEPS }, (_, i) => <span key={i} className={step === i ? "now" : undefined}>{i % 2 === 0 ? i / 2 + 1 : "·"}</span>)}</div>
              {toys.map((toy) => { const Icon = trackIcons[toy.id]; return <div className={`toy-note-row ${toy.colour}`} key={toy.id}>
                <span className="toy-track-label"><Icon size={16} /> {toy.instrument}</span>
                {score.tracks[toy.id].map((note, i) => <button
                  type="button" key={i} disabled={!!pending} aria-pressed={Boolean(note)}
                  aria-label={`${toy.name}, step ${i + 1}, ${noteLabel(toy.id, note)}`}
                  className={`toy-note${note ? " has-note" : ""}${step === i ? " active-step" : ""}${focused?.id === toy.id && focused.step === i ? " selected-note" : ""}`}
                  onClick={() => {
                    if (!note || (focused?.id === toy.id && focused.step === i)) updateNote(toy.id, i, note ? 0 : toy.pitch);
                    setFocused({ id: toy.id, step: i });
                  }}
                >{note ? noteLabel(toy.id, note) : ""}</button>)}
              </div>; })}
            </div>
          </div>
          <div className="toy-note-editor">
            {focused ? <>
              <label htmlFor="toy-pitch">{toys.find((toy) => toy.id === focused.id)?.name} · step {focused.step + 1}</label>
              <div className="toy-select"><select id="toy-pitch" disabled={!!pending} value={focusedPitch} onChange={(event) => updateNote(focused.id, focused.step, Number(event.target.value))}>
                <option value={0}>Rest</option>
                {pitchOptions.map((note) => <option key={note} value={note}>{noteLabel(focused.id, note)}</option>)}
              </select><ChevronDown size={13} /></div>
            </> : <span>Pick a step to choose a note or rest.</span>}
          </div>
        </section>
        <section className="toy-panel toy-mixer" aria-label="Toy band mixer">
          <header className="toy-panel-heading"><div><p>Instrument mixer</p><h2>The toy band</h2></div><AudioLines size={22} /></header>
          {toys.map((toy) => {
            const settings = mix[toy.id];
            return <div className={`toy-strip ${toy.colour}${playing && step >= 0 && score.tracks[toy.id][step] && !settings.muted ? " playing" : ""}`} key={toy.id}>
              <button type="button" className="toy-portrait" aria-label={`Preview ${toy.name}'s instrument`} onClick={() => {
                audio.current ??= new ToyBand();
                void audio.current.preview(toy.id, toy.pitch, settings.volume, master, score.genre)
                  .catch(() => setMessage("Your browser could not play the instrument."));
              }}><img src={appPath(`toys/${toy.id}.jpg`)} alt="" width={76} height={76} /></button>
              <div className="toy-strip-details"><strong>{toy.name}</strong><span>{toy.instrument}</span>
                <label className="toy-volume"><input aria-label={`${toy.name} volume`} type="range" min={0} max={100} value={settings.volume} onChange={(event) => setMix({ ...mix, [toy.id]: { ...settings, volume: Number(event.target.value) } })}/><output>{settings.volume}%</output></label>
              </div>
              <button className="toy-icon" type="button" aria-label={`${settings.muted ? "Unmute" : "Mute"} ${toy.name}`} onClick={() => setMix({ ...mix, [toy.id]: { ...settings, muted: !settings.muted } })}>{settings.muted ? <VolumeX size={19} /> : <Volume2 size={19} />}</button>
            </div>;
          })}
          <label className="toy-master"><Volume2 size={17} /> Master <input type="range" min={0} max={100} value={master} onChange={(event) => setMaster(Number(event.target.value))} /><output>{master}%</output></label>
        </section>
      </div>
    </main>
  </div>;
}

import { useEffect, useRef, useState, type FormEvent } from "react";
import { ArrowLeft, ArrowRight, AudioLines, Download, Headphones, Music2, Play, Repeat2, RotateCcw, Sparkles, Square, Volume2, VolumeX } from "lucide-react";
import { appPath } from "../paths";
import { arrange, canArrange } from "./arrange";
import { renderSong, ToyBand, type Position } from "./audio";
import { durationBars, durationSecs, genres, loadStudio, noteLabel, preset, saveStudio, STEPS_PER_BAR, timeLabel, toys, trackIds, type Genre, type Mix, type Song, type TrackId } from "./score";
import "./studio.css";
import "./songs.css";

const promptIdeas = ["Write an upbeat arcade theme", "Give Rosie the bridge", "Slow it down and soften the drums"];

export function Studio() {
  const [initial] = useState(loadStudio);
  const [song, setSong] = useState(initial.song);
  const [mix, setMix] = useState(initial.mix);
  const [master, setMaster] = useState(initial.master);
  const [loop, setLoop] = useState(initial.loop);
  const [starting, setStarting] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [position, setPosition] = useState<Position | null>(null);
  const [sectionIndex, setSectionIndex] = useState(0);
  const [page, setPage] = useState(0);
  const [prompt, setPrompt] = useState("");
  const [mode, setMode] = useState<"edit" | "create">("create");
  const [pending, setPending] = useState("");
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState("");
  const [source, setSource] = useState("");
  const [previous, setPrevious] = useState<{ song: Song; mix: Mix } | null>(null);
  const [focused, setFocused] = useState<{ id: TrackId; step: number } | null>(null);
  const player = useRef<ToyBand | null>(null);
  const current = useRef({ song, mix, master, loop });
  current.current = { song, mix, master, loop };
  const section = song.sections[sectionIndex] ?? song.sections[0];
  const gridStart = page * 2 * STEPS_PER_BAR;
  const busy = !!pending;
  const time = position ? (song.sections.slice(0, position.section).reduce((sum, part) => sum + part.bars * STEPS_PER_BAR, 0) + position.step) * 30 / song.bpm : 0;

  useEffect(() => saveStudio(initial.key, { song, mix, master, loop }), [initial.key, song, mix, master, loop]);
  useEffect(() => player.current?.updateMix(mix, master), [mix, master]);
  useEffect(() => () => { void player.current?.close().catch(() => undefined); }, []);

  function stop() {
    player.current?.stop();
    setPlaying(false);
    setPosition(null);
  }

  async function play(first = 0) {
    if (playing) { stop(); return; }
    setStarting(true);
    try {
      player.current ??= new ToyBand();
      const started = await player.current.play(() => current.current, (next) => {
        setPosition(next);
        if (!next) setPlaying(false);
      }, first);
      if (started) setPlaying(true);
    } catch {
      setMessage("Audio could not start. Check whether this tab can play sound.");
    } finally {
      setStarting(false);
    }
  }

  function pickSection(index: number) {
    setSectionIndex(index);
    setPage(0);
    setFocused(null);
  }

  function apply(next: Song, origin: string) {
    setPrevious({ song: current.current.song, mix: current.current.mix });
    stop();
    setSong(next);
    setSource(origin);
    pickSection(0);
    setMode("edit");
  }

  async function generate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim() || busy || !canArrange) return;
    setPending("Arranging…");
    setMessage("");
    try {
      const result = await arrange(song, mix, prompt.trim(), mode, (percent) => {
        setPending(percent < 100 ? `Downloading Nano · ${percent}%` : "Arranging on device…");
      });
      apply(result.song, result.source);
      setMix((latest) => Object.fromEntries(trackIds.map((id) => [
        id, { ...latest[id], volume: result.volumes[id] === mix[id].volume ? latest[id].volume : result.volumes[id] },
      ])) as Mix);
      setPrompt("");
      setMessage(`${result.song.title} is ready to play · ${durationBars(result.song)} bars.`);
    } catch (error) {
      setMessage(error instanceof Error ? `Couldn’t apply that request. ${error.message}` : "Couldn’t apply that request. Your song is still playable.");
    } finally {
      setPending("");
    }
  }

  function setNote(id: TrackId, step: number, pitch: number) {
    setSong((latest) => ({
      ...latest, sections: latest.sections.map((part, index) => index === sectionIndex ? {
        ...part, tracks: { ...part.tracks, [id]: part.tracks[id].map((note, i) => i === step ? pitch : note) },
      } : part),
    }));
  }

  async function downloadSong() {
    if (exporting) return;
    setExporting(true);
    setMessage("");
    try {
      const file = await renderSong(song, mix, master);
      const url = URL.createObjectURL(file);
      const link = document.createElement("a");
      link.href = url;
      link.download = (song.title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "toybox-song") + ".wav";
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 30000);
      setMessage("Your full song is ready as a WAV file.");
    } catch {
      setMessage("The browser couldn’t render this WAV. Try again with fewer apps open.");
    } finally {
      setExporting(false);
    }
  }

  const pitchOptions = focused?.id === "drums" ? [36, 38, 42] : focused?.id === "shaker" ? [70] : Array.from({ length: 69 }, (_, index) => 28 + index);

  return <div className="toy-studio">
    <a className="skip" href="#toy-workspace">Skip to studio</a>
    <header className="toy-header">
      <a className="toy-logo" href={appPath()}><span><AudioLines size={22} /></span> Toybox</a>
      <a className="toy-archive" href={appPath()}><ArrowLeft size={15} /> Home</a>
    </header>
    <main className="toy-main song-main" id="toy-workspace">
      <div className="song-top">
        <div><h1>Song studio</h1><p>Arrange, play, and export with your toy band.</p></div>
        <button className="toy-button toy-primary" type="button" disabled={exporting || busy} onClick={() => void downloadSong()}><Download size={17} />{exporting ? "Rendering WAV…" : "Download WAV"}</button>
      </div>

      <form className="toy-prompt" onSubmit={generate}>
        <div className="song-prompt-header">
          <label htmlFor="arrange-prompt"><Sparkles size={17} /> What should the band play?</label>
          <div className="song-modes" aria-label="Prompt mode">
            <button type="button" aria-pressed={mode === "create"} disabled={busy} onClick={() => setMode("create")}>New song</button>
            <button type="button" aria-pressed={mode === "edit"} disabled={busy} onClick={() => setMode("edit")}>Edit song</button>
          </div>
        </div>
        <div className="toy-prompt-row">
          <input id="arrange-prompt" value={prompt} onChange={(event) => setPrompt(event.target.value)} maxLength={280} placeholder={mode === "create" ? "A mysterious jazz tune for a detective game" : "Make the bridge quieter and give violin the lead"} disabled={busy} />
          <button className="toy-button toy-primary" type="submit" disabled={!prompt.trim() || busy || !canArrange}>{pending || (mode === "create" ? "Write song" : "Apply edit")} <ArrowRight size={17} /></button>
        </div>
        <div className="toy-suggestions">{promptIdeas.map((idea, i) => <button key={idea} type="button" disabled={busy} onClick={() => { setPrompt(idea); setMode(i ? "edit" : "create"); }}>{idea}</button>)}</div>
        {!canArrange && <p className="toy-feedback">Live prompts require Firebase AI or supported desktop Chrome. Presets and manual editing are available here.</p>}
        {message && <p className="toy-feedback" role="status">{message}</p>}
      </form>

      <div className="song-genre-row"><strong>Start from a genre</strong><div className="toy-genres" aria-label="Genre presets">
        {genres.map((genre: Genre) => <button key={genre} disabled={busy} type="button" className="toy-genre" aria-pressed={song.genre === genre} onClick={() => { apply(preset(genre), "Preset"); setMessage(""); }}>{genre}</button>)}
      </div></div>

      <section className="song-timeline toy-panel" aria-label="Song timeline">
        <div className="toy-panel-heading"><div>
          <p>{song.genre} · {song.key} · {durationBars(song)} bars</p>
          <h2>{song.title}</h2>
        </div>{source && <span className="toy-source">{source}</span>}</div>
        <div className="toy-transport song-transport">
          <button className="toy-button toy-play" type="button" onClick={() => void play()} disabled={starting}>{playing ? <Square size={16} fill="currentColor" /> : <Play size={17} fill="currentColor" />}{playing ? "Stop" : "Play song"}</button>
          <div className="song-time"><span>{timeLabel(time)} / {timeLabel(durationSecs(song))}</span><progress aria-label="Song playback progress" value={time} max={durationSecs(song)} /></div>
          <button className="toy-button toy-outline" type="button" aria-pressed={loop} onClick={() => setLoop(!loop)}><Repeat2 size={17} /> Loop</button>
          <label className="toy-tempo">Tempo <input type="range" min={60} max={180} value={song.bpm} disabled={busy} onChange={(event) => setSong({ ...song, bpm: Number(event.target.value) })} /><output>{song.bpm} BPM</output></label>
          <button className="toy-icon" type="button" aria-label="Undo last arrangement change" disabled={!previous || busy} onClick={() => {
            if (!previous) return;
            stop(); setSong(previous.song); setMix(previous.mix); setPrevious(null); setSource(""); pickSection(0); setMessage("Previous arrangement restored.");
          }}><RotateCcw size={17} /></button>
        </div>
        <div className="song-sections">
          {song.sections.map((part, index) => <button type="button" key={index} style={{ flexGrow: part.bars }} className={`song-part part-${part.name.toLowerCase()}${position?.section === index ? " is-playing" : ""}`} aria-pressed={index === sectionIndex} onClick={() => pickSection(index)}>
            <strong>{part.name}</strong><span>{part.bars} bars · {toys.find((toy) => toy.id === part.lead)?.instrument}</span>
          </button>)}
        </div>
      </section>

      <div className="toy-grid song-grid">
        <section className="toy-panel toy-score" aria-label="Section notes">
          <div className="toy-panel-heading"><div><p>Section notes</p><h2>{section.name}</h2></div>
            <button className="toy-button toy-outline" type="button" disabled={playing || starting} onClick={() => void play(sectionIndex)}><Play size={15} /> Play from here</button>
          </div>
          <div className="song-page-controls">
            <button className="toy-icon" type="button" aria-label="Previous two bars" disabled={page === 0} onClick={() => { setPage(page - 1); setFocused(null); }}><ArrowLeft size={15} /></button>
            <strong>Bars {page * 2 + 1}–{page * 2 + 2} of {section.bars}</strong>
            <button className="toy-icon" type="button" aria-label="Next two bars" disabled={page * 2 + 2 >= section.bars} onClick={() => { setPage(page + 1); setFocused(null); }}><ArrowRight size={15} /></button>
          </div>
          <div className="toy-sequence-scroll">
            <div className="toy-sequence">
              <div className="toy-count-row"><span>Track</span>{Array.from({ length: 16 }, (_, i) => <span key={i}>{i % 2 === 0 ? i / 2 + 1 : "·"}</span>)}</div>
              {toys.map((toy) => <div className={`toy-note-row ${toy.colour}`} key={toy.id}>
                <span className="toy-track-label"><Music2 size={14} />{toy.instrument}</span>
                {section.tracks[toy.id].slice(gridStart, gridStart + 16).map((note, i) => {
                  const step = gridStart + i;
                  const selected = focused?.id === toy.id && focused.step === step;
                  return <button type="button" key={i} disabled={busy} aria-pressed={Boolean(note)} aria-label={`${toy.name}, step ${step + 1}, ${noteLabel(toy.id, note)}`}
                    className={`toy-note${note ? " has-note" : ""}${position?.section === sectionIndex && position.step === step ? " active-step" : ""}${selected ? " selected-note" : ""}`}
                    onClick={() => { if (!note || selected) setNote(toy.id, step, note ? 0 : toy.pitch); setFocused({ id: toy.id, step }); }}
                  >{note ? noteLabel(toy.id, note) : ""}</button>;
                })}
              </div>)}
            </div>
          </div>
          <div className="toy-note-editor">
            {focused ? <><label htmlFor="toy-pitch">{toys.find((toy) => toy.id === focused.id)?.name} · step {focused.step + 1}</label>
              <select id="toy-pitch" disabled={busy} value={section.tracks[focused.id][focused.step]} onChange={(event) => setNote(focused.id, focused.step, Number(event.target.value))}>
                <option value={0}>Rest</option>
                {pitchOptions.map((pitch) => <option key={pitch} value={pitch}>{noteLabel(focused.id, pitch)}</option>)}
              </select>
            </> : <span>Select a step to add a note or change its pitch.</span>}
          </div>
        </section>
        <section className="toy-panel toy-mixer" aria-label="Toy band mixer">
          <div className="toy-panel-heading"><div><p>Ten playable instruments</p><h2>The toy band</h2></div><Headphones size={21} /></div>
          <div className="song-mix-list">{toys.map((toy) => {
            const settings = mix[toy.id];
            const active = position && song.sections[position.section]?.tracks[toy.id][position.step] && !settings.muted;
            return <div className={`toy-strip ${toy.colour}${active ? " playing" : ""}`} key={toy.id}>
              <button type="button" className="toy-portrait" aria-label={`Preview ${toy.name}'s instrument`} onClick={() => {
                player.current ??= new ToyBand();
                void player.current.preview(toy.id, toy.pitch, settings.volume, master, song.genre).catch(() => setMessage("Your browser could not play this instrument."));
              }}><img src={appPath(`toys/${toy.id}.jpg`)} alt="" width={62} height={62} /></button>
              <div className="toy-strip-details"><strong>{toy.name}</strong><span>{toy.instrument}</span>
                <label className="toy-volume"><input aria-label={`${toy.name} volume`} type="range" min={0} max={100} value={settings.volume} onChange={(event) => setMix({ ...mix, [toy.id]: { ...settings, volume: Number(event.target.value) } })}/><output>{settings.volume}%</output></label>
              </div>
              <button className="toy-icon" type="button" aria-label={`${settings.muted ? "Unmute" : "Mute"} ${toy.name}`} onClick={() => setMix({ ...mix, [toy.id]: { ...settings, muted: !settings.muted } })}>{settings.muted ? <VolumeX size={17} /> : <Volume2 size={17} />}</button>
            </div>;
          })}</div>
          <label className="toy-master"><Volume2 size={16} /> Master <input type="range" min={0} max={100} value={master} onChange={(event) => setMaster(Number(event.target.value))} /><output>{master}%</output></label>
        </section>
      </div>
    </main>
  </div>;
}

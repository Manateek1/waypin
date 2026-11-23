import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowRight, AudioLines, Download, Music2, Play, Sparkles, Square } from "lucide-react";
import { appPath } from "../paths";
import { ToyBand } from "./audio";
import { defaultMix, examples, preset, toys, type Genre } from "./score";
import "./studio.css";
import "./songs.css";

export function MusicLanding() {
  const player = useRef<ToyBand | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const [preview, setPreview] = useState<Genre | null>(null);
  const [audioError, setAudioError] = useState(false);

  useEffect(() => () => {
    window.clearTimeout(timer.current);
    void player.current?.close().catch(() => undefined);
  }, []);

  function stop() {
    player.current?.stop();
    window.clearTimeout(timer.current);
    setPreview(null);
  }

  async function listen(genre: Genre) {
    if (preview === genre) { stop(); return; }
    stop();
    setAudioError(false);
    setPreview(genre);
    try {
      const song = preset(genre);
      const mix = defaultMix();
      player.current ??= new ToyBand();
      const started = await player.current.play(() => ({ song, mix, master: 78, loop: false }), () => undefined, 2);
      if (started) timer.current = window.setTimeout(stop, 12000);
    } catch {
      stop();
      setAudioError(true);
    }
  }

  return <div className="toy-studio toy-landing">
    <a className="skip" href="#toy-front">Skip to content</a>
    <header className="toy-header">
      <a className="toy-logo" href={appPath()}><span><AudioLines size={22} /></span> Toybox</a>
      <nav aria-label="Main navigation"><a href="#use-cases">What to make</a><a href="#meet-the-band">The band</a></nav>
      <a className="toy-button toy-primary" href={appPath("studio/")}>Open the studio <ArrowRight size={17} /></a>
    </header>
    <main id="toy-front" className="toy-front">
      <section className="toy-hero">
        <img src={appPath("toys/stage.jpg")} alt="Toy musicians playing together on a miniature stage lit in peach and violet" fetchPriority="high" />
        <div className="toy-hero-copy">
          <h1>Big songs.<br /><em>Tiny band.</em></h1>
          <p>Tell ten toy musicians what you’re imagining. Play the full song, change any part, and take it with you.</p>
          <div className="hero-studio-actions">
            <a className="toy-button toy-play" href={appPath("studio/")}>Make a song <ArrowRight size={19} /></a>
            <button className="toy-button hero-preview" type="button" onClick={() => void listen("Orchestra")}>
              {preview === "Orchestra" ? <Square size={16} /> : <Play size={17} />} {preview === "Orchestra" ? "Stop preview" : "Hear the band"}
            </button>
          </div>
          {audioError && <p role="status">Audio couldn’t start in this tab. You can also try playback in the studio.</p>}
        </div>
      </section>

      <a className="toy-intro-strip" href="#use-cases"><span><strong>What are you making?</strong> Pick a playable example and make it your own.</span><ArrowDown size={24} /></a>
      <section id="use-cases" className="toy-use-cases">
        <h2>Give your project <em>a soundtrack.</em></h2>
        <div className="toy-use-grid">
          {examples.map((sample) => <article key={sample.id} className={`toy-use-card use-${sample.id}`}>
              <div className="toy-use-art"><img src={appPath(`toys/use-${sample.id}.jpg`)} alt="" width={560} height={335} loading="lazy" /></div>
              <h3>{sample.use}</h3>
              <p>{sample.note}</p>
              <div className="toy-use-actions">
                <button className="toy-button toy-outline" type="button" onClick={() => void listen(sample.genre)}>
                  {preview === sample.genre ? <Square size={14} /> : <Play size={15} />} {preview === sample.genre ? "Stop" : "Preview"}
                </button>
                <a href={appPath(`studio/?example=${sample.id}`) }>Edit example <ArrowRight size={16} /></a>
              </div>
            </article>)}
        </div>
      </section>

      <section className="toy-feature">
        <div><h2>From first note <em>to final chorus.</em></h2>
          <p>Write a complete instrumental with a beginning, a build, a contrast, and an ending. Ask for a softer bridge or a guitar lead, then edit the notes yourself.</p>
          <a className="toy-button toy-play" href={appPath("studio/")}>Try the timeline <ArrowRight size={17} /></a>
        </div>
        <div className="toy-feature-timeline" aria-label="Example song arrangement">
          <div><Music2 size={18} /> Parade of Small Things <span>40 bars</span></div>
          <ol>{["Intro", "Verse", "Chorus", "Bridge", "Chorus", "Outro"].map((part, index) => <li key={index} className={`part-${part.toLowerCase()}`}>{part}</li>)}</ol>
          <div><Download size={18} /> Export your whole song as MP3 or WAV</div>
        </div>
      </section>

      <section id="meet-the-band" className="toy-cast">
        <h2>Meet the <em>tiny band.</em></h2>
        <p>Ten instruments with their own sound. Preview, mute, or mix any character in the studio.</p>
        <ul>{toys.map((toy) => <li key={toy.id} className={toy.colour}>
          <img src={appPath(`toys/${toy.id}.jpg`)} alt="" width={120} height={120} loading="lazy" />
          <strong>{toy.name}</strong><span>{toy.instrument}</span>
        </li>)}</ul>
      </section>

      <section className="toy-final">
        <div><h2>Your band is waiting.</h2><p>Start with an idea, a genre, or a song you can remix.</p></div>
        <a className="toy-button toy-primary" href={appPath("studio/")}><Sparkles size={17} /> Open the studio <ArrowRight size={17} /></a>
      </section>
    </main>
    <footer className="toy-foot"><a className="toy-logo" href={appPath()}>Toybox</a><a href={appPath("audit/")}>Waypin field audit <ArrowRight size={15} /></a></footer>
  </div>;
}

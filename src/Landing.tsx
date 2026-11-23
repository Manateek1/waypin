import { ArrowDownRight, ArrowRight, Camera, Check, ClipboardList, Image, MapPin, Pencil, ScanLine } from "lucide-react";
import { appPath } from "./paths";

export function Wordmark({ light = false }: { light?: boolean }) {
  return <a className={light ? "wordmark light" : "wordmark"} href={appPath()} aria-label="Waypin home"><MapPin aria-hidden="true" />Waypin</a>;
}

export function Landing() {
  return <>
    <a className="skip" href="#main">Skip to content</a>
    <header className="site-header">
      <Wordmark />
      <nav aria-label="Main"><a className="how-link" href="#how">How it works</a><a className="button dark" href={appPath("audit/")}>Open workspace <ArrowDownRight size={17} /></a></nav>
    </header>
    <main id="main">
      <section className="hero">
        <div className="hero-content">
          <h1>Make barriers <em>visible.</em></h1>
          <p>Document accessibility barriers in the field. Turn what you find into a clear brief for the people who can fix it.</p>
          <a className="button lime hero-cta" href={appPath("audit/")}>Explore the demo <ArrowRight /></a>
        </div>
        <figure className="hero-image">
          <img src={appPath("evidence/ramp-hero.jpg")} alt="A traffic cone and crate obstruct a concrete access ramp" fetchPriority="high" />
          <span className="photo-ring" aria-hidden="true" />
          <figcaption><MapPin size={18} /> Path obstruction</figcaption>
        </figure>
      </section>
      <div className="proof-band">
        <span><Image /> Photos stay local</span><span><Pencil /> Findings stay editable</span><span><ClipboardList /> Briefs cite evidence</span>
      </div>
      <section className="how" id="how">
        <h2>From photo to field brief.</h2>
        <div className="steps">
          <article>
            <div className="step-art capture-art"><img src={appPath("evidence/entrance.jpg")} alt="" /><Camera /></div>
            <h3>Capture</h3><p>Photograph what’s in the way. On supported Chrome devices, Gemini Nano can analyze the photo offline.</p>
          </article>
          <article>
            <div className="step-art review-art"><span><ScanLine /> Path obstruction</span><div><Check /> Add the verified observation</div></div>
            <h3>Review</h3><p>Check the suggestion and pin a finding to the route. Add measurements you’ve verified yourself.</p>
          </article>
          <article>
            <div className="step-art brief-art"><div><ClipboardList /><b>Facilities handoff</b><i /><i /><i /></div></div>
            <h3>Hand off</h3><p>Preview the fields Gemini will receive and generate a brief that points back to each finding.</p>
          </article>
        </div>
      </section>
      <section className="closing"><h2>Walk the sample venue.</h2><a className="button lime hero-cta" href={appPath("audit/")}>Explore the demo <ArrowRight /></a></section>
    </main>
    <footer className="site-footer"><Wordmark /><span>Built for #BuildHybridAI 2026</span></footer>
  </>;
}

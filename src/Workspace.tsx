import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, Camera, Check, ChevronRight, ClipboardList, Cloud, Image, MapPin, Plus, Route, ShieldCheck, Sparkles, WifiOff, X } from "lucide-react";
import { approvedPayload, categories, conditions, newAudit, sampleAudit, sampleBrief, seed, stationName, stations, type Audit, type Brief, type Finding, type StationId } from "./data";
import { cloudConfigured, deviceConfigured, generateBrief, inspectPhoto } from "./inference";
import { preparePhoto, readAudit, saveAudit } from "./storage";
import { Wordmark } from "./Landing";
import { appPath } from "./paths";

const photoPath = (photo: string) => photo.startsWith("data:") ? photo : appPath(photo);

const emptyDraft = (station: StationId, photo = ""): Finding => ({
  id: crypto.randomUUID(), station, photo, category: "Other", condition: "Needs verification", note: "", check: "", measurement: null, origin: "Manual",
});

function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    dialog?.showModal();
    return () => dialog?.close();
  }, []);
  return <dialog ref={ref} aria-label={title} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="dialog-heading"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>;
}

export function Workspace() {
  const [audit, setAudit] = useState<Audit>(sampleAudit);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<StationId>("entrance");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Finding | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [reset, setReset] = useState<"sample" | "blank" | null>(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [photoBusy, setPhotoBusy] = useState("");
  const [briefBusy, setBriefBusy] = useState("");
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const finding = audit.findings.find((item) => item.id === selectedId && item.station === selected)
    ?? audit.findings.find((item) => item.station === selected);

  useEffect(() => {
    let active = true;
    readAudit().then((saved) => {
      if (active && saved) setAudit(saved);
    }).catch(() => {
      if (active) setStorageError("Browser storage is unavailable. Export before leaving this page.");
    }).finally(() => {
      if (active) setLoaded(true);
    });
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      active = false;
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);

  useEffect(() => {
    if (loaded) void saveAudit(audit)
      .then(() => setStorageError(""))
      .catch(() => setStorageError("Changes could not be saved on this device. Export before leaving this page."));
  }, [audit, loaded]);

  function openDraft(value: Finding) {
    setMessage("");
    setDraft(value);
  }

  function saveFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft?.note.trim()) return;
    const updated = { ...draft, note: draft.note.trim(), check: draft.check.trim() };
    setAudit((current) => ({
      ...current,
      findings: current.findings.some((item) => item.id === updated.id)
        ? current.findings.map((item) => item.id === updated.id ? updated : item)
        : [...current.findings, updated],
      brief: null,
    }));
    setSelected(updated.station);
    setSelectedId(updated.id);
    setDraft(null);
    setMessage("Finding saved on this device.");
  }

  async function usePhoto(file: File) {
    const base = draft ?? emptyDraft(selected);
    setPhotoBusy("Preparing photo…");
    setMessage("");
    try {
      const photo = await preparePhoto(file);
      setDraft({ ...base, photo, origin: "Manual" });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "The photo could not be opened.");
    } finally {
      setPhotoBusy("");
    }
  }

  async function analyze() {
    if (!draft?.photo) return;
    const input = draft;
    setPhotoBusy("Preparing Gemini Nano…");
    setMessage("");
    try {
      const result = await inspectPhoto(input.photo, (percent) => {
        setPhotoBusy(percent < 100 ? `Downloading Nano · ${percent}%` : "Analyzing on this device…");
      });
      setDraft({ ...input, ...result });
      setMessage("Gemini Nano suggestion. Review each field before saving.");
    } catch (error) {
      setMessage(`Device analysis unavailable. You can still edit the finding. ${error instanceof Error ? error.message : ""}`);
    } finally {
      setPhotoBusy("");
    }
  }

  async function buildBrief(quick: boolean) {
    setBriefBusy("Generating your brief…");
    setMessage("");
    try {
      const brief = await generateBrief(audit.findings, quick, (percent) => {
        setBriefBusy(percent < 100 ? `Downloading Nano · ${percent}%` : "Generating on this device…");
      });
      setAudit((current) => ({ ...current, brief }));
    } catch (error) {
      setMessage(quick && !cloudConfigured
        ? `Device brief unavailable. You can still print the findings report. ${error instanceof Error ? error.message : ""}`
        : "The brief could not be generated. Check your connection and App Check setup, or print the findings report.");
    } finally {
      setBriefBusy("");
    }
  }

  function setBrief(brief: Brief) {
    setAudit((current) => ({ ...current, brief }));
  }

  function replaceAudit() {
    setAudit(reset === "sample" ? sampleAudit : newAudit());
    setSelected("entrance");
    setSelectedId(null);
    setReset(null);
    setMessage("");
  }

  if (!loaded) return <main className="loading">Opening the workspace…</main>;

  return <>
    <a className="skip" href="#audit">Skip to audit</a>
    <header className="workspace-header"><Wordmark light /><span className="workspace-label"><Route size={17} /> Field audit</span>
      <div className="workspace-actions"><span className="status">{online ? <ShieldCheck size={16} /> : <WifiOff size={16} />}{online ? "Local workspace" : "Offline"}</span>
        <button className="button lime" onClick={() => { setMessage(""); setHandoff(true); }} disabled={!audit.findings.length}><ClipboardList size={17} /> Build handoff</button>
      </div>
    </header>
    <main id="audit" className="workspace">
      <div className="workspace-title"><div>
        <h1>{audit.title}</h1>
        <p>{audit.sample ? "Sample audit · Fictional venue" : "Private audit · Saved on this device"}</p>
      </div><div className="title-actions">
        {!audit.sample && <button className="button outline" onClick={() => setReset("sample")}>Load sample</button>}
        <button className="button outline" onClick={() => setReset("blank")}><Plus size={17} /> New audit</button>
        <button className="button dark" onClick={() => openDraft(emptyDraft(selected))}><Camera size={17} /> Add finding</button>
      </div></div>
      {!audit.sample && <label className="venue-name">Venue name<input maxLength={80} value={audit.title} onChange={(event) => setAudit({ ...audit, title: event.target.value })} onBlur={() => { if (!audit.title.trim()) setAudit({ ...audit, title: "Untitled venue" }); }} /></label>}
      {storageError && <p className="notice" role="alert">{storageError}</p>}
      {message && !draft && !handoff && <p className="notice" role="status">{message}</p>}
      <div className="audit-grid">
        <section className="panel route-panel" aria-label="Venue route">
          <div className="panel-heading"><Route /><div><h2>Venue route</h2><p>Choose a station to inspect its evidence.</p></div></div>
          <div className="venue-map">
            <img src={appPath("venue-map.jpg")} alt="" />
            <div className="map-label park-label">{audit.sample ? "Riverside park" : "Outdoor approach"}</div><div className="map-label building-label">{audit.sample ? "Arts center" : "Venue"}</div><div className="map-label north-label">↑ N</div>
            <svg className="map-trail" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true"><path d="M27 76 C39 81 50 72 58 64 S61 54 67 50 S82 43 81 25" /></svg>
            {stations.map((station, index) => <button key={station.id} className={station.id === selected ? "map-pin selected" : "map-pin"} style={{ left: station.x + "%", top: station.y + "%" }}
              aria-label={station.name} aria-pressed={station.id === selected} onClick={() => { setSelected(station.id); setSelectedId(null); }}>{String(index + 1).padStart(2, "0")}</button>)}
            <span className="map-caption">{audit.sample ? "Fictional site plan · Not to scale" : "Route template · Not to scale"}</span>
          </div>
        </section>
        <section className="panel evidence-panel" aria-label="Evidence">
          <div className="panel-heading"><Image /><div><h2>Evidence</h2><p>Photos and reviewed observations.</p></div></div>
          {finding?.photo ? <img className="evidence-photo" src={photoPath(finding.photo)} alt={`Evidence at ${stationName(selected)}`} />
            : <div className="empty-photo"><Camera /><span>No photo for this finding</span></div>}
          <div className="evidence-info"><h3><MapPin size={18} /> {stationName(selected)}</h3>
            {finding ? <>
              <div className="evidence-meta"><strong>{finding.category}</strong><span className="tag">{finding.origin}</span></div>
              <p>{finding.note}</p>
              <button className="text-button" onClick={() => openDraft(finding)}>Review finding <ArrowRight size={16} /></button>
            </> : <button className="text-button" onClick={() => openDraft(emptyDraft(selected))}>Add a finding <ArrowRight size={16} /></button>}
          </div>
        </section>
      </div>
      <section className="route-list" aria-label="Route findings">
        {stations.map((station, index) => {
          const items = audit.findings.filter((item) => item.station === station.id);
          return <div className="station-group" key={station.id}>
            <button className="station-row" onClick={() => { setSelected(station.id); setSelectedId(null); }} aria-pressed={selected === station.id && !selectedId}>
              <span className="row-index">{String(index + 1).padStart(2, "0")}</span><strong>{station.name}</strong><span className="station-copy">{items[0]?.note || station.label}</span><span className="tag">{items.length} {items.length === 1 ? "finding" : "findings"}</span><ChevronRight size={18} />
            </button>
            {selected === station.id && items.length > 1 && <div className="station-items">{items.map((item) => <button key={item.id} className="button outline" aria-pressed={finding?.id === item.id} onClick={() => setSelectedId(item.id)}>{item.category}</button>)}</div>}
          </div>;
        })}
      </section>
    </main>
    {draft && <Modal title={audit.findings.some((item) => item.id === draft.id) ? "Review finding" : "Add finding"} onClose={() => { if (!photoBusy) { setDraft(null); setMessage(""); } }}>
      <form className="editor" onSubmit={saveFinding}>
        <input ref={upload} hidden type="file" accept="image/jpeg,image/png" onChange={(event) => {
          const file = event.currentTarget.files?.[0];
          event.currentTarget.value = "";
          if (file) void usePhoto(file);
        }} />
        {draft.photo && <img className="draft-photo" src={photoPath(draft.photo)} alt="Photo being reviewed" />}
        <div className="dialog-actions">
          <button type="button" className="button outline" onClick={() => upload.current?.click()} disabled={!!photoBusy}><Camera size={17} /> {draft.photo ? "Replace photo" : "Choose photo"}</button>
          {draft.photo && <button type="button" className="button dark" onClick={() => void analyze()} disabled={!!photoBusy || !deviceConfigured}><Sparkles size={17} /> Analyze on device</button>}
          {!draft.photo && audit.sample && <button type="button" className="button outline" disabled={!!photoBusy} onClick={() => setDraft({ ...draft, photo: seed.find((item) => item.station === draft.station)!.photo })}>Use sample photo</button>}
        </div>
        {photoBusy && <p className="notice" role="status">{photoBusy}</p>}
        {!deviceConfigured && draft.photo && <p className="helper">Open Waypin in a supported desktop Chrome browser to use Gemini Nano. You can review this photo manually here.</p>}
        {message && <p className="notice" role="status">{message}</p>}
        <fieldset disabled={!!photoBusy}>
          <div className="fields">
            <label>Station<select value={draft.station} onChange={(event) => setDraft({ ...draft, station: event.target.value as StationId })}>{stations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></label>
            <label>Category<select value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value as Finding["category"] })}>{categories.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Condition<select value={draft.condition} onChange={(event) => setDraft({ ...draft, condition: event.target.value as Finding["condition"] })}>{conditions.map((item) => <option key={item}>{item}</option>)}</select></label>
            <label>Verified measurement (cm)<input type="number" min="0" max="10000" step="0.1" value={draft.measurement ?? ""} onChange={(event) => setDraft({ ...draft, measurement: event.target.value === "" ? null : event.target.valueAsNumber })} /></label>
          </div>
          <label>Observation<textarea required maxLength={240} value={draft.note} onChange={(event) => setDraft({ ...draft, note: event.target.value })} /></label>
          <label>What should someone verify?<textarea maxLength={240} value={draft.check} onChange={(event) => setDraft({ ...draft, check: event.target.value })} /></label>
          <button className="button lime" type="submit"><Check size={18} /> Save reviewed finding</button>
        </fieldset>
      </form>
    </Modal>}
    {handoff && <Modal title="Venue handoff" onClose={() => { if (!briefBusy) { setHandoff(false); setMessage(""); } }}>
      <section className="handoff-controls">
        <p>Review what AI can receive. Photos and private notes stay on this device.</p>
        <details><summary>Preview the exact findings payload</summary><pre>{JSON.stringify(approvedPayload(audit.findings), null, 2)}</pre></details>
        <div className="dialog-actions">
          <button className="button dark" onClick={() => void buildBrief(true)} disabled={(!cloudConfigured && !deviceConfigured) || !!briefBusy}><Sparkles size={17} /> {cloudConfigured ? "Quick hybrid brief" : "Generate on device"}</button>
          {cloudConfigured && <button className="button lime" onClick={() => void buildBrief(false)} disabled={!!briefBusy || !online}><Cloud size={17} /> Generate cloud brief</button>}
          {audit.sample && <button className="button outline" disabled={!!briefBusy || !seed.every((source) => audit.findings.some((item) => item.id === source.id && item.category === source.category && item.condition === source.condition && item.station === source.station))} onClick={() => setBrief(sampleBrief)}>Open sample replay</button>}
        </div>
        {!cloudConfigured && <p className="helper">In supported desktop Chrome, Gemini Nano drafts the brief on this device. Sample replay and printing work on other browsers.</p>}
        {briefBusy && <p className="notice" role="status">{briefBusy}</p>}
        {message && <p className="notice" role="status">{message}</p>}
      </section>
      {audit.brief && <BriefEditor brief={audit.brief} onChange={setBrief} />}
      <button className="button outline no-print" onClick={() => window.print()}><ArrowDownToLine size={17} /> {audit.brief ? "Print or save brief as PDF" : "Print findings report"}</button>
    </Modal>}
    {reset && <Modal title={reset === "sample" ? "Load the sample audit?" : "Start a new audit?"} onClose={() => setReset(null)}>
      <p>This replaces the current audit on this device. Export it first if you want a copy.</p>
      <div className="dialog-actions"><button className="button outline" onClick={() => setReset(null)}>Keep current audit</button><button className="button dark" onClick={replaceAudit}>Replace audit</button></div>
    </Modal>}
    <article className="print-report">
      <h1>{audit.title}</h1><p>{audit.sample ? "Fictional sample audit" : "Accessibility observations"}</p>
      {audit.brief && <><h2>{audit.brief.title}</h2><p>{audit.brief.summary}</p>{audit.brief.actions.map((action) => <section key={action.findingId}><h3>{action.priority} · {action.findingId}</h3><p>{action.action}</p><p>Verify: {action.verify}</p></section>)}</>}
      <h2>Reviewed findings</h2>
      {audit.findings.map((item) => <section key={item.id}><h3>{stationName(item.station)} · {item.category}</h3><p>{item.id} · {item.condition}{item.measurement !== null && ` · ${item.measurement} cm`}</p><p>{item.note}</p>{item.check && <p>Verify: {item.check}</p>}</section>)}
      <p>Waypin · Observations for facilities review</p>
    </article>
  </>;
}

function BriefEditor({ brief, onChange }: { brief: Brief; onChange: (brief: Brief) => void }) {
  return <section className="brief-editor">
    <span className="tag">{brief.origin === "Sample" ? "Sample replay" : `Gemini · ${brief.origin}`}</span>
    <label>Brief title<input maxLength={110} value={brief.title} onChange={(event) => onChange({ ...brief, title: event.target.value })} /></label>
    <label>Summary<textarea maxLength={420} value={brief.summary} onChange={(event) => onChange({ ...brief, summary: event.target.value })} /></label>
    {brief.actions.map((action) => <fieldset key={action.findingId}><legend>{action.priority} · {action.findingId}</legend>
      <label>Action<textarea maxLength={260} value={action.action} onChange={(event) => onChange({ ...brief, actions: brief.actions.map((item) => item.findingId === action.findingId ? { ...item, action: event.target.value } : item) })} /></label>
      <label>Verification<textarea maxLength={260} value={action.verify} onChange={(event) => onChange({ ...brief, actions: brief.actions.map((item) => item.findingId === action.findingId ? { ...item, verify: event.target.value } : item) })} /></label>
    </fieldset>)}
  </section>;
}

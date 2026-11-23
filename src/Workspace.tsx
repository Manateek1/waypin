import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { ArrowDownToLine, ArrowRight, Camera, Check, ChevronRight, ClipboardList, Cloud, FolderOpen, Image, MapPin, Plus, Route, ShieldCheck, Sparkles, Trash2, WifiOff, X } from "lucide-react";
import { approvedPayload, categories, conditions, createLibrary, findingReference, newAudit, sampleAudit, sampleBrief, seed, stationName, stations, type Audit, type Brief, type Finding, type StationId } from "./data";
import { cloudConfigured, deviceConfigured, generateBrief, inspectPhoto } from "./inference";
import { preparePhoto, readAuditLibrary, saveAuditLibrary } from "./storage";
import { Wordmark } from "./Landing";
import { appPath } from "./paths";
import { AuditReport, photoPath } from "./AuditReport";

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
  const [library, setLibrary] = useState(createLibrary);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<StationId>("entrance");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Finding | null>(null);
  const [handoff, setHandoff] = useState(false);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const [removeAuditId, setRemoveAuditId] = useState<string | null>(null);
  const [confirmRemoveFinding, setConfirmRemoveFinding] = useState(false);
  const [includePhotos, setIncludePhotos] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [photoBusy, setPhotoBusy] = useState("");
  const [briefBusy, setBriefBusy] = useState("");
  const [message, setMessage] = useState("");
  const [storageError, setStorageError] = useState("");
  const upload = useRef<HTMLInputElement>(null);
  const audit = library.entries.find((entry) => entry.id === library.activeId)!.audit;
  const finding = audit.findings.find((item) => item.id === selectedId && item.station === selected)
    ?? audit.findings.find((item) => item.station === selected);
  const canReplaySample = audit.findings.length === seed.length && seed.every((source) => audit.findings.some((item) =>
    item.id === source.id && item.category === source.category && item.condition === source.condition
    && item.station === source.station && item.measurement === source.measurement
  ));

  useEffect(() => {
    let active = true;
    readAuditLibrary().then((saved) => {
      if (active) setLibrary(saved);
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
    if (loaded) void saveAuditLibrary(library)
      .then(() => setStorageError(""))
      .catch(() => setStorageError("Changes could not be saved on this device. Export before leaving this page."));
  }, [library, loaded]);

  function setAudit(update: (current: Audit) => Audit) {
    const activeId = library.activeId;
    setLibrary((current) => ({
      ...current,
      entries: current.entries.map((entry) => entry.id === activeId ? { ...entry, audit: update(entry.audit) } : entry),
    }));
  }

  function openDraft(value: Finding) {
    setMessage("");
    setConfirmRemoveFinding(false);
    setDraft(value);
  }

  function saveFinding(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft?.note.trim()) {
      setMessage("Enter an observation before saving.");
      return;
    }
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

  function removeFinding() {
    if (!draft) return;
    setAudit((current) => ({ ...current, findings: current.findings.filter((item) => item.id !== draft.id), brief: null }));
    setDraft(null);
    setSelectedId(null);
    setMessage("Finding removed from this audit.");
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

  function resetWorkspace() {
    setSelected("entrance");
    setSelectedId(null);
    setLibraryOpen(false);
    setRemoveAuditId(null);
    setMessage("");
  }

  function openAudit(id: string) {
    setLibrary((current) => ({ ...current, activeId: id }));
    resetWorkspace();
  }

  function addAudit(value: Audit) {
    const id = crypto.randomUUID();
    setLibrary((current) => ({ activeId: id, entries: [...current.entries, { id, audit: value }] }));
    resetWorkspace();
  }

  function removeAudit(id: string) {
    setLibrary((current) => {
      const entries = current.entries.filter((entry) => entry.id !== id);
      if (!entries.length) return createLibrary();
      return { entries, activeId: current.activeId === id ? entries[0].id : current.activeId };
    });
    resetWorkspace();
    setMessage("Audit removed from this device.");
  }

  function showEvidence(id: string) {
    const source = audit.findings.find((item) => item.id === id);
    if (!source) return;
    setHandoff(false);
    setSelected(source.station);
    setSelectedId(source.id);
    setMessage("");
    requestAnimationFrame(() => document.getElementById("evidence-panel")?.focus());
  }

  async function printReport() {
    const images = document.querySelectorAll<HTMLImageElement>(".print-report img");
    await Promise.allSettled(Array.from(images, (image) => image.decode()));
    window.print();
  }

  if (!loaded) return <main className="loading">Opening the workspace…</main>;

  return <>
    <a className="skip" href="#audit">Skip to audit</a>
    <header className="workspace-header"><Wordmark light /><span className="workspace-label"><Route size={17} /> Field audit</span>
      <div className="workspace-actions"><span className="status">{online ? <ShieldCheck size={16} /> : <WifiOff size={16} />}{online ? "Local workspace" : "Offline"}</span>
        <button className="button lime" onClick={() => { setMessage(""); setIncludePhotos(false); setHandoff(true); }} disabled={!audit.findings.length}><ClipboardList size={17} /> Build handoff</button>
      </div>
    </header>
    <main id="audit" className="workspace">
      <div className="workspace-title"><div>
        <h1>{audit.title}</h1>
        <p>{audit.sample ? "Sample audit · Fictional venue" : "Private audit · Saved on this device"}</p>
      </div><div className="title-actions">
        <button className="button outline" onClick={() => { setRemoveAuditId(null); setLibraryOpen(true); }}><FolderOpen size={17} /> My audits</button>
        <button className="button outline" onClick={() => addAudit(newAudit())}><Plus size={17} /> New audit</button>
        <button className="button dark" onClick={() => openDraft(emptyDraft(selected))}><Camera size={17} /> Add finding</button>
      </div></div>
      {!audit.sample && <label className="venue-name">Venue name<input maxLength={80} value={audit.title} onChange={({ target }) => { const title = target.value; setAudit((current) => ({ ...current, title })); }} onBlur={() => { if (!audit.title.trim()) setAudit((current) => ({ ...current, title: "Untitled venue" })); }} /></label>}
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
        <section className="panel evidence-panel" id="evidence-panel" aria-label="Evidence" tabIndex={-1}>
          <div className="panel-heading"><Image /><div><h2>Evidence</h2><p>Photos and reviewed observations.</p></div></div>
          {finding?.photo ? <img className="evidence-photo" src={photoPath(finding.photo)} alt={`Evidence at ${stationName(selected)}`} />
            : <div className="empty-photo"><Camera /><span>No photo for this finding</span></div>}
          <div className="evidence-info"><h3><MapPin size={18} /> {stationName(selected)}</h3>
            {finding ? <>
              <div className="evidence-meta"><strong>{finding.category}</strong><span className="tag">{finding.origin}</span><span className="finding-reference">{findingReference(finding.id)}</span></div>
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
          <div className="dialog-actions">
            <button className="button lime" type="submit"><Check size={18} /> Save reviewed finding</button>
            {audit.findings.some((item) => item.id === draft.id) && !confirmRemoveFinding && <button className="button outline" type="button" onClick={() => setConfirmRemoveFinding(true)}><Trash2 size={16} /> Remove finding</button>}
          </div>
          {confirmRemoveFinding && <div className="notice">
            <p>Remove this finding and its photo from the audit? This also clears any draft handoff.</p>
            <div className="dialog-actions"><button className="button outline" type="button" onClick={() => setConfirmRemoveFinding(false)}>Keep finding</button><button className="button dark" type="button" onClick={removeFinding}>Confirm removal</button></div>
          </div>}
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
          {audit.sample && <button className="button outline" disabled={!!briefBusy || !canReplaySample} onClick={() => setBrief(sampleBrief)}>Open sample replay</button>}
        </div>
        {!cloudConfigured && <p className="helper">In supported desktop Chrome, Gemini Nano drafts the brief on this device. Sample replay and printing work on other browsers.</p>}
        {briefBusy && <p className="notice" role="status">{briefBusy}</p>}
        {message && <p className="notice" role="status">{message}</p>}
      </section>
      {audit.brief && <BriefEditor brief={audit.brief} onChange={setBrief} onFinding={showEvidence} />}
      <div className="export-controls">
        <p className="helper">The exported copy includes your reviewed observation and verification notes.</p>
        {audit.findings.some((item) => item.photo) && <label className="check-label"><input type="checkbox" checked={includePhotos} onChange={(event) => setIncludePhotos(event.target.checked)} /> Include evidence photos in the exported copy</label>}
        <button className="button outline" onClick={() => void printReport()} disabled={!!briefBusy}><ArrowDownToLine size={17} /> {audit.brief ? "Print or save brief as PDF" : "Print findings report"}</button>
      </div>
    </Modal>}
    {libraryOpen && <Modal title="My audits" onClose={() => setLibraryOpen(false)}>
      <p className="helper">Audits are saved in this browser. Export a PDF to share one.</p>
      <ul className="audit-library">
        {library.entries.map(({ id, audit: saved }) => <li key={id}>
          <div className="library-row">
            <button className="library-open" onClick={() => openAudit(id)}>
              <strong>{saved.title || "Untitled venue"}</strong>
              <span>{saved.findings.length} {saved.findings.length === 1 ? "finding" : "findings"}{saved.sample ? " · Sample" : ""}{id === library.activeId ? " · Current audit" : ""}</span>
            </button>
            <button className="icon-button" aria-label={`Remove ${saved.title || "untitled audit"}`} onClick={() => setRemoveAuditId(id)}><Trash2 size={17} /></button>
          </div>
          {removeAuditId === id && <div className="notice"><p>Remove this audit and its evidence from this browser?</p><div className="dialog-actions">
            <button className="button outline" onClick={() => setRemoveAuditId(null)}>Keep audit</button>
            <button className="button dark" onClick={() => removeAudit(id)}>Confirm removal</button>
          </div></div>}
        </li>)}
      </ul>
      <div className="dialog-actions">
        <button className="button dark" onClick={() => addAudit(newAudit())}><Plus size={17} /> New audit</button>
        <button className="button outline" onClick={() => addAudit(sampleAudit)}>Add a fresh sample</button>
      </div>
    </Modal>}
    <AuditReport audit={audit} includePhotos={includePhotos} />
  </>;
}

function BriefEditor({ brief, onChange, onFinding }: { brief: Brief; onChange: (brief: Brief) => void; onFinding: (id: string) => void }) {
  return <section className="brief-editor">
    <span className="tag">{brief.origin === "Sample" ? "Sample replay" : `Gemini · ${brief.origin}`}</span>
    <label>Brief title<input maxLength={110} value={brief.title} onChange={(event) => onChange({ ...brief, title: event.target.value })} /></label>
    <label>Summary<textarea maxLength={420} value={brief.summary} onChange={(event) => onChange({ ...brief, summary: event.target.value })} /></label>
    {brief.actions.map((action) => <fieldset key={action.findingId}><legend>{action.priority} · {findingReference(action.findingId)}</legend>
      <label>Action<textarea maxLength={260} value={action.action} onChange={(event) => onChange({ ...brief, actions: brief.actions.map((item) => item.findingId === action.findingId ? { ...item, action: event.target.value } : item) })} /></label>
      <label>Verification<textarea maxLength={260} value={action.verify} onChange={(event) => onChange({ ...brief, actions: brief.actions.map((item) => item.findingId === action.findingId ? { ...item, verify: event.target.value } : item) })} /></label>
      <button className="text-button" onClick={() => onFinding(action.findingId)}>View evidence <ArrowRight size={16} /></button>
    </fieldset>)}
  </section>;
}

import { findingReference, stationName, type Audit } from "./data";
import { appPath } from "./paths";

export const photoPath = (photo: string) => photo.startsWith("data:") ? photo : appPath(photo);

export function AuditReport({ audit, includePhotos }: { audit: Audit; includePhotos: boolean }) {
  return <article className="print-report">
    <header>
      <strong>WAYPIN / FIELD AUDIT</strong>
      <h1>{audit.title}</h1>
      <p>{audit.sample ? "Fictional sample venue" : "Accessibility observations"} · {audit.findings.length} reviewed {audit.findings.length === 1 ? "finding" : "findings"}</p>
    </header>
    {audit.brief && <>
      <h2>{audit.brief.title}</h2>
      <p>{audit.brief.summary}</p>
      {audit.brief.actions.map((action) => <section className="report-action" key={action.findingId}>
        <h3>{action.priority} · <a href={`#report-${action.findingId}`}>{findingReference(action.findingId)}</a></h3>
        <p>{action.action}</p>
        <p><strong>Verify:</strong> {action.verify}</p>
      </section>)}
    </>}
    <h2>Reviewed findings</h2>
    {audit.findings.map((item) => <section className="report-finding" key={item.id} id={`report-${item.id}`}>
      <h3>{stationName(item.station)} · {item.category}</h3>
      <p>{findingReference(item.id)} · {item.condition}{item.measurement !== null && ` · ${item.measurement} cm`}</p>
      {includePhotos && item.photo && <img src={photoPath(item.photo)} alt={`Evidence at ${stationName(item.station)}`} />}
      <p>{item.note}</p>
      {item.check && <p><strong>Verify:</strong> {item.check}</p>}
    </section>)}
    <footer>Observations for facilities review.</footer>
  </article>;
}

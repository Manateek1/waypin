export const stations = [
  { id: "entrance", name: "Main entrance", x: 27, y: 76, label: "Arrival" },
  { id: "lobby", name: "Lobby doors", x: 67, y: 50, label: "Entry" },
  { id: "courtyard", name: "Side courtyard", x: 81, y: 25, label: "Circulation" },
] as const;

export const categories = ["Path obstruction", "Raised threshold", "Uneven surface", "Door access", "Signage", "Other"] as const;
export const conditions = ["Obstructed", "Limited", "Needs verification", "Clear"] as const;

export type StationId = typeof stations[number]["id"];
export type Category = typeof categories[number];
export type Condition = typeof conditions[number];
export type Origin = "Sample" | "Manual" | "On device" | "Cloud";
export type Finding = {
  id: string;
  station: StationId;
  category: Category;
  condition: Condition;
  note: string;
  check: string;
  measurement: number | null;
  photo: string;
  origin: Origin;
};
export type Action = { findingId: string; priority: "First" | "Next" | "Follow up"; action: string; verify: string };
export type Brief = { title: string; summary: string; actions: Action[]; origin: Origin };
export type Audit = { title: string; sample: boolean; findings: Finding[]; brief: Brief | null };
export type AuditLibrary = { activeId: string; entries: { id: string; audit: Audit }[] };

export const seed: Finding[] = [
  { id: "WP-01", station: "entrance", category: "Path obstruction", condition: "Obstructed", note: "A crate and traffic cone occupy the middle of the entrance ramp.", check: "Confirm the ramp stays clear during event setup.", measurement: null, photo: "/evidence/entrance.jpg", origin: "Sample" },
  { id: "WP-02", station: "lobby", category: "Raised threshold", condition: "Needs verification", note: "A raised metal strip is visible at the lobby doorway.", check: "Measure the threshold rise at its highest point.", measurement: null, photo: "/evidence/lobby.jpg", origin: "Sample" },
  { id: "WP-03", station: "courtyard", category: "Uneven surface", condition: "Limited", note: "One paving slab sits higher than the adjacent slabs on the courtyard route.", check: "Measure the change in level and check for an alternate route.", measurement: null, photo: "/evidence/courtyard.jpg", origin: "Sample" },
];

export const sampleBrief: Brief = {
  title: "Clear the arrival route",
  summary: "Start with the entrance ramp. Then check the door threshold and courtyard surface before the next event.",
  origin: "Sample",
  actions: [
    { findingId: "WP-01", priority: "First", action: "Move the crate and cone away from the ramp.", verify: "Walk the ramp after event setup to check it is clear." },
    { findingId: "WP-02", priority: "Next", action: "Measure and record the raised threshold.", verify: "Take a side-on photo with a scale." },
    { findingId: "WP-03", priority: "Follow up", action: "Flag the raised slab for a facilities review.", verify: "Measure the level change and check the alternate route." },
  ],
};

export const stationName = (id: StationId) => stations.find((station) => station.id === id)!.name;
export const sampleAudit: Audit = { title: "Marigold Arts Center", sample: true, findings: seed, brief: null };
export const newAudit = (): Audit => ({ title: "Untitled venue", sample: false, findings: [], brief: null });
export function createLibrary(audit = sampleAudit): AuditLibrary {
  return { activeId: "first-audit", entries: [{ id: "first-audit", audit }] };
}

export const findingReference = (id: string) => id.startsWith("WP-") ? id : `WP-${id.slice(0, 8).toUpperCase()}`;

export function approvedPayload(findings: Finding[]) {
  return findings.map(({ id, station, category, condition, measurement }) => ({
    id, station: stationName(station), category, condition, measurementCm: measurement,
  }));
}

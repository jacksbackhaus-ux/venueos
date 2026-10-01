export type IncidentStageKey = "reported" | "resolved" | "corrective_action" | "verified";

export interface IncidentStageRecord {
  status: string;
  stage_schema_version?: number | null;
  reported_at: string;
  reported_by_name: string;
  description: string;
  resolved_summary?: string | null;
  resolved_at_stage?: string | null;
  resolved_by_name?: string | null;
  corrective_action_summary?: string | null;
  corrective_action_at?: string | null;
  corrective_action_by_name?: string | null;
  verification_summary?: string | null;
  verification_at_stage?: string | null;
  verification_by_name?: string | null;
  verified_at?: string | null;
  verified_by_name?: string | null;
}

export interface IncidentStageView {
  key: IncidentStageKey;
  label: string;
  state: "complete" | "current" | "pending" | "legacy";
  note: string | null;
  at: string | null;
  actor: string | null;
}

export const LEGACY_NOTE = "Not separately recorded (legacy record)";

const ORDER: IncidentStageKey[] = ["reported", "resolved", "corrective_action", "verified"];

function isVerified(i: IncidentStageRecord) {
  return !!(i.verification_at_stage || i.verified_at || i.status === "verified" || i.status === "closed");
}

/** Furthest stage the incident has reached, from evidence or legacy status. Never from the version flag. */
export function incidentCurrentStage(incident: IncidentStageRecord): IncidentStageKey {
  if (isVerified(incident)) return "verified";
  if (incident.corrective_action_at || incident.status === "action-taken") return "corrective_action";
  if (incident.resolved_at_stage) return "resolved";
  return "reported";
}

function stageEvidenceAt(incident: IncidentStageRecord, key: IncidentStageKey): string | null {
  switch (key) {
    case "reported": return incident.reported_at;
    case "resolved": return incident.resolved_at_stage ?? null;
    case "corrective_action": return incident.corrective_action_at ?? null;
    case "verified": return incident.verification_at_stage ?? incident.verified_at ?? null;
  }
}

export function incidentStageTimeline(incident: IncidentStageRecord): IncidentStageView[] {
  const reachedIdx = ORDER.indexOf(incidentCurrentStage(incident));
  const details: Record<IncidentStageKey, Omit<IncidentStageView, "key" | "state">> = {
    reported: { label: "Report", note: incident.description, at: incident.reported_at, actor: incident.reported_by_name },
    resolved: { label: "Resolved", note: incident.resolved_summary ?? null, at: incident.resolved_at_stage ?? null, actor: incident.resolved_by_name ?? null },
    corrective_action: { label: "Corrective action", note: incident.corrective_action_summary ?? null, at: incident.corrective_action_at ?? null, actor: incident.corrective_action_by_name ?? null },
    verified: {
      label: "Verified",
      note: incident.verification_summary ?? null,
      at: incident.verification_at_stage ?? incident.verified_at ?? null,
      actor: incident.verification_by_name ?? incident.verified_by_name ?? null,
    },
  };

  return ORDER.map((key, index) => {
    const detail = details[key];
    const hasEvidence = !!stageEvidenceAt(incident, key) || (key === "verified" && isVerified(incident));
    if (hasEvidence) return { key, ...detail, state: "complete" as const };
    // No evidence: legacy only if the incident has already moved past this stage.
    if (index < reachedIdx || (index === reachedIdx && index > 0)) {
      return { key, ...detail, note: LEGACY_NOTE, at: null, actor: null, state: "legacy" as const };
    }
    return { key, ...detail, state: index === reachedIdx + 1 ? ("current" as const) : ("pending" as const) };
  });
}

export function nextIncidentAction(incident: IncidentStageRecord): Exclude<IncidentStageKey, "reported"> | null {
  if (isVerified(incident)) return null;
  if (incident.corrective_action_at || incident.status === "action-taken") return "verified";
  if (incident.resolved_at_stage) return "corrective_action";
  return "resolved";
}

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

const LEGACY_NOTE = "Not separately recorded (legacy record)";

export function incidentCurrentStage(incident: IncidentStageRecord): IncidentStageKey {
  if (incident.verification_at_stage || incident.status === "verified" || incident.status === "closed") return "verified";
  if (incident.corrective_action_at || incident.status === "action-taken") return "corrective_action";
  if (incident.resolved_at_stage) return "resolved";
  return "reported";
}

export function incidentStageTimeline(incident: IncidentStageRecord): IncidentStageView[] {
  const legacy = incident.stage_schema_version !== 1;
  const current = incidentCurrentStage(incident);
  const order: IncidentStageKey[] = ["reported", "resolved", "corrective_action", "verified"];
  const completedThrough = order.indexOf(current);
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

  return order.map((key, index) => {
    const detail = details[key];
    const isLegacyMiddle = legacy && (key === "resolved" || key === "corrective_action");
    return {
      key,
      ...detail,
      note: isLegacyMiddle ? LEGACY_NOTE : detail.note,
      state: isLegacyMiddle
        ? "legacy"
        : index < completedThrough || (key === "verified" && current === "verified")
          ? "complete"
          : index === completedThrough
            ? "current"
            : "pending",
    };
  });
}

export function nextIncidentAction(incident: IncidentStageRecord): Exclude<IncidentStageKey, "reported"> | null {
  if (incident.verification_at_stage || incident.status === "verified" || incident.status === "closed") return null;
  if (incident.stage_schema_version !== 1 && incident.status === "action-taken") return "verified";
  if (incident.corrective_action_at) return "verified";
  if (incident.resolved_at_stage) return "corrective_action";
  return "resolved";
}
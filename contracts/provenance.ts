export type ProducerRef = {
  plugin: string;
  version: string;
  model?: string;
};

export type ProvenanceRef = {
  project_id: string;
  session_id: string;
  event_id?: string;
  segment?: string;
  source_head?: string;
  source_diff_sha256?: string;
  work_id?: string;
};

export type ValidationResult<T> =
  | { ok: true; value: T }
  | { ok: false; code: string; message: string };

const SHA256 = /^[0-9a-f]{64}$/;

function nonEmpty(value: unknown): value is string {
  return typeof value === "string" && value.length > 0;
}

/** Runtime-owned validation for the small cross-plugin reference only. */
export function validateProvenanceRef(value: unknown): ValidationResult<ProvenanceRef> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, code: "PROVENANCE_MALFORMED", message: "provenance must be an object" };
  }
  const ref = value as Record<string, unknown>;
  const allowed = new Set([
    "project_id", "session_id", "event_id", "segment", "source_head", "source_diff_sha256", "work_id",
  ]);
  for (const key of Object.keys(ref)) {
    if (!allowed.has(key)) {
      return { ok: false, code: "PROVENANCE_UNKNOWN_FIELD", message: `unknown provenance field: ${key}` };
    }
  }
  if (!nonEmpty(ref.project_id) || !nonEmpty(ref.session_id)) {
    return { ok: false, code: "PROVENANCE_MISSING_ID", message: "project_id and session_id are required" };
  }
  for (const key of ["event_id", "segment", "source_head", "work_id"] as const) {
    if (ref[key] !== undefined && !nonEmpty(ref[key])) {
      return { ok: false, code: "PROVENANCE_BAD_FIELD", message: `${key} must be a non-empty string` };
    }
  }
  if (ref.source_diff_sha256 !== undefined &&
      (typeof ref.source_diff_sha256 !== "string" || !SHA256.test(ref.source_diff_sha256))) {
    return { ok: false, code: "PROVENANCE_BAD_DIFF", message: "source_diff_sha256 must be 64 lowercase hex chars" };
  }
  return { ok: true, value: value as ProvenanceRef };
}

export function validateProducerRef(value: unknown): ValidationResult<ProducerRef> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return { ok: false, code: "PRODUCER_MALFORMED", message: "producer must be an object" };
  }
  const producer = value as Record<string, unknown>;
  if (!nonEmpty(producer.plugin) || !nonEmpty(producer.version)) {
    return { ok: false, code: "PRODUCER_MISSING_ID", message: "plugin and version are required" };
  }
  if (producer.model !== undefined && !nonEmpty(producer.model)) {
    return { ok: false, code: "PRODUCER_BAD_MODEL", message: "model must be a non-empty string" };
  }
  return { ok: true, value: value as ProducerRef };
}

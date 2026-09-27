import { describe, expect, test } from "bun:test";
import { validateProducerRef, validateProvenanceRef } from "./provenance";

describe("shared references", () => {
  test("provenance is optional at the domain boundary and valid when supplied", () => {
    expect(validateProvenanceRef({
      project_id: "project",
      session_id: "session",
      event_id: "event",
      segment: "segments/1.json",
      source_head: "abc123",
      source_diff_sha256: "a".repeat(64),
    }).ok).toBe(true);
  });

  test("malformed provenance fails closed", () => {
    expect(validateProvenanceRef({ project_id: "project" }).ok).toBe(false);
    expect(validateProvenanceRef({ project_id: "p", session_id: "s", source_diff_sha256: "no" }).ok).toBe(false);
    expect(validateProvenanceRef({ project_id: "p", session_id: "s", judgment: "PASS" }).ok).toBe(false);
  });

  test("producer reference validates without requiring a model", () => {
    expect(validateProducerRef({ plugin: "opencode-evidence", version: "0.1.0" }).ok).toBe(true);
    expect(validateProducerRef({ plugin: "", version: "0.1.0" }).ok).toBe(false);
  });
});

import { describe, expect, test } from "bun:test"
import { mkdtempSync, writeFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { spawnSync } from "node:child_process"
import { executeWorkerWork } from "../src/worker-work"
import { ProvenanceLedger } from "../../opencode-vfs/src/ledger"

const criterion = { kind: "evidence_field", path: "observation.exit_code", operator: "EQUALS", expected: 0 }

function fixture(acceptExit: number) {
  const projectDir = mkdtempSync(join(tmpdir(), "runtime-worker-work-project-")); spawnSync("git", ["init"], { cwd: projectDir })
  const storeDir = mkdtempSync(join(tmpdir(), "runtime-worker-work-store-")), ledgerDir = mkdtempSync(join(tmpdir(), "runtime-worker-work-ledger-"))
  const declaration = {
    objective: { statement: "create hello", source: "human" }, claim: { statement: "hello exists", subject: "hello.txt" }, scope: { project: projectDir },
    success: { obligations: [{ description: "observation passes", criterion }], acceptance: { checks: [{ name: "acceptance", command: "bun", args: ["-e", `process.exit(${acceptExit})`], cwd: projectDir }] } },
    plan: [
      { op_id: "model", kind: "CALL_MODEL", prompt: "create hello" },
      { op_id: "observe", kind: "RUN_COMMAND", command: "bun", args: ["-e", "process.exit(0)"], cwd: projectDir },
      { op_id: "evidence", kind: "CAPTURE_EVIDENCE", source_op: "observe" },
      { op_id: "verify", kind: "VERIFY", criterion, evidence: ["evidence"] },
      { op_id: "proof", kind: "BUILD_PROOF", obligations: [{ description: "observation passes", criterion, evidence: ["evidence"], verification: "verify" }] },
    ], authority: { scope: `workspace:${projectDir}` }, created_by: "test",
  }
  const provider = { async callModel() { writeFileSync(join(projectDir, "hello.txt"), "hello\n"); return { text: "done" } } }
  return { projectDir, storeDir, ledgerDir, declaration, provider }
}

describe("Worker Work runtime composition", () => {
  test("persists real domain records and indexed VFS history", async () => { const f = fixture(0); const result = await executeWorkerWork({ declaration: f.declaration, projectDir: f.projectDir, projectID: "fixture", storeDir: f.storeDir, ledgerDir: f.ledgerDir }, f.provider); expect(result.status).toBe("ACCEPTED"); expect(result.declaration.schema).toBe("opencode.work.v1"); expect(result.run.schema).toBe("opencode.work.run.v1"); expect(result.acceptance?.schema).toBe("opencode.acceptance.v1"); expect(result.artifacts.map((a) => a.schema)).toEqual(["opencode.evidence.v1", "opencode.verification.v1", "opencode.proof.v1", "opencode.acceptance.v1"]); expect(new ProvenanceLedger(f.ledgerDir, "fixture").getWorkHistory(String(result.declaration.work_id))).not.toHaveLength(0) })
  test("Proof COMPLETE and Acceptance REJECTED remain separate", async () => { const f = fixture(1); const result = await executeWorkerWork({ declaration: f.declaration, projectDir: f.projectDir, projectID: "fixture", storeDir: f.storeDir, ledgerDir: f.ledgerDir }, f.provider); const proof = (result.run.ops as Array<Record<string, unknown>>).find((op) => op.op_id === "proof")?.output as Record<string, unknown>; expect(proof.status).toBe("COMPLETE"); expect(result.acceptance?.outcome).toBe("REJECTED"); expect(result.status).toBe("REJECTED") })
})

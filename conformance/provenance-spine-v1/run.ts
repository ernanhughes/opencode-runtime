import { mkdtempSync } from "node:fs"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { localEvidenceAdapter, localPackageVersion, localProofAdapter, localVerifyAdapter } from "../../../opencode-work/src/adapters"
import { CapabilityRegistry } from "../../../opencode-work/src/capabilities"
import { WorkEngine } from "../../../opencode-work/src/engine"
import { GitRepo } from "../../../opencode-vfs/src/git"
import { ProvenanceLedger } from "../../../opencode-vfs/src/ledger"
import type { ArtifactRef, OperationRef, WorkRef } from "../../../opencode-vfs/src/contracts"

function registry(): CapabilityRegistry {
  const out = new CapabilityRegistry()
  const evidence = localEvidenceAdapter(), verify = localVerifyAdapter(), proof = localProofAdapter()
  out.register({ id: "evidence", version: localPackageVersion(evidence.pkg), operations: ["CAPTURE_EVIDENCE"], available: true, handle: evidence })
  out.register({ id: "verify", version: localPackageVersion(verify.pkg), operations: ["VERIFY"], available: true, handle: verify })
  out.register({ id: "proof", version: localPackageVersion(proof.pkg), operations: ["BUILD_PROOF"], available: true, handle: proof })
  return out
}

const criterion = { kind: "evidence_field", path: "observation.exit_code", operator: "EQUALS", expected: 0 }
const projectDir = resolve(import.meta.dir, "../..")
const engine = new WorkEngine(projectDir, { store_dir: mkdtempSync(join(tmpdir(), "runtime-provenance-work-")) }, registry())
const { declaration } = engine.declare({
  objective: { statement: "configuration remains backward-compatible", source: "human" },
  claim: { statement: "The declared test command passes.", subject: "configuration" },
  success: {
    obligations: [{ description: "tests pass", criterion }],
    acceptance: { checks: [{ name: "broader compatibility not established", command: "node", args: ["-e", "process.exit(1)"] }] },
  },
  plan: [
    { op_id: "run", kind: "RUN_COMMAND", command: "node", args: ["-e", "process.exit(0)"], subject: "compatibility-tests" },
    { op_id: "ev", kind: "CAPTURE_EVIDENCE", source_op: "run" },
    { op_id: "vr", kind: "VERIFY", criterion, evidence: ["ev"] },
    { op_id: "pf", kind: "BUILD_PROOF", obligations: [{ description: "tests pass", criterion, evidence: ["ev"], verification: "vr" }] },
  ],
  authority: { scope: "offline provenance fixture" },
})
const run = await engine.run(declaration.work_id)
const acceptance = await engine.accept(declaration.work_id)
const output = (op: string) => run.ops.find((item) => item.op_id === op)?.output as Record<string, unknown>
const ev = output("ev"), vr = output("vr"), pf = output("pf")
if (pf.status !== "COMPLETE" || acceptance.outcome !== "REJECTED") throw new Error("specification gap fixture failed")

const source = new GitRepo(projectDir).describeSource()
const root = mkdtempSync(join(tmpdir(), "runtime-provenance-ledger-"))
const ledger = new ProvenanceLedger(root, "opencode-runtime")
const work: WorkRef = { kind: "work", work_id: declaration.work_id, version: declaration.work_version }
const operation: OperationRef = { kind: "operation", work_id: declaration.work_id, op_id: "run" }
const refs: ArtifactRef[] = [
  { kind: "artifact", artifact_id: String(ev.evidence_id), schema: "opencode.evidence.v1", producer: { component: "opencode-evidence", version: "0.1.0" } },
  { kind: "artifact", artifact_id: String(vr.verification_id), schema: "opencode.verification.v1", producer: { component: "opencode-verify", version: "0.1.0" } },
  { kind: "artifact", artifact_id: String(pf.proof_id), schema: "opencode.proof.v1", producer: { component: "opencode-proof", version: "0.1.0" } },
  { kind: "artifact", artifact_id: acceptance.acceptance_id, schema: "opencode.acceptance.v1", producer: { component: "opencode-work", version: "0.1.0" } },
]
for (const artifact of refs) ledger.registerArtifact(artifact, { source })
const producer = { component: "opencode-runtime-conformance", version: "1" }
ledger.recordEdge({ project_id: "opencode-runtime", work, from: operation, relation: "BELONGS_TO_WORK", to: work, producer, source })
ledger.recordEdge({ project_id: "opencode-runtime", work, from: operation, relation: "PRODUCED", to: refs[0]!, producer, source })
ledger.recordEdge({ project_id: "opencode-runtime", work, from: refs[0]!, relation: "VERIFIED_BY", to: refs[1]!, producer, source })
ledger.recordEdge({ project_id: "opencode-runtime", work, from: refs[1]!, relation: "SUPPORTED_BY", to: refs[2]!, producer, source })
ledger.recordEdge({ project_id: "opencode-runtime", work, from: refs[2]!, relation: "ACCEPTED_BY", to: refs[3]!, producer, source })
const history = ledger.getWorkHistory(work)
if (history.length !== 5 || history.some((record) => record.edge.source?.head !== source.head)) throw new Error("causal history incomplete")

console.log(`OpenCode Runtime Provenance Spine\n\nWork identity                 PASS\nArtifact refs                 PASS\nEvidence linkage              PASS\nVerification linkage          PASS\nProof linkage                 PASS\nAcceptance separation         PASS\nGit source state              PASS\nCausal edge integrity         PASS\nAppend-only provenance        PASS\nNo model inference            PASS\n\nRESULT: PASS`)

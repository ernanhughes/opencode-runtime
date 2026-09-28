import { join, resolve } from "node:path"
import { existsSync } from "node:fs"
import { spawnSync } from "node:child_process"
import { localEvidenceAdapter, localPackageVersion, localProofAdapter, localVerifyAdapter, type ModelProvider } from "../../opencode-work/src/adapters"
import { CapabilityRegistry } from "../../opencode-work/src/capabilities"
import { WorkEngine } from "../../opencode-work/src/engine"
import { GitRepo } from "../../opencode-vfs/src/git"
import { ProvenanceLedger } from "../../opencode-vfs/src/ledger"
import type { ArtifactRef, OperationRef, WorkRef } from "../../opencode-vfs/src/contracts"

export type RuntimeWorkInput = {
  declaration: unknown
  projectDir: string
  projectID: string
  storeDir?: string
  ledgerDir: string
  model?: string
}

export type RuntimeWorkResult = {
  declaration: Record<string, unknown>
  run: Record<string, unknown>
  acceptance?: Record<string, unknown>
  status: "ACCEPTED" | "REJECTED" | "BLOCKED" | "AWAITING_ACCEPTANCE"
  artifacts: Array<{ id: string; schema: string; kind: string }>
  provenance: { project_id: string; work_id: string; ledger_dir: string; edge_record_ids: string[] }
  model?: { requested?: string; observed?: string }
  model_execution?: unknown
}

export class OpenCodeCliModelProvider implements ModelProvider {
  observedModel?: string
  constructor(readonly workspace: string, readonly binary = "opencode") {}
  async callModel(input: { prompt: string; model?: string }): Promise<{ text: string }> {
    const executable = resolveOpenCodeExecutable(this.binary)
    const args = ["run", "--standalone", "--format", "json", ...(input.model && input.model !== "auto" ? ["--model", input.model] : []), input.prompt]
    const out = spawnSync(executable, args, { cwd: this.workspace, encoding: "utf8", windowsHide: true, timeout: 10 * 60_000, maxBuffer: 16 * 1024 * 1024, stdio: ["ignore", "pipe", "pipe"] })
    if ((out.status ?? 1) !== 0) throw new Error(`OPENCODE_UNAVAILABLE: ${out.stderr || out.error || `exit ${out.status}`}`)
    const text: string[] = []
    for (const line of String(out.stdout ?? "").split(/\r?\n/)) {
      if (!line.trim()) continue
      try {
        const event = JSON.parse(line) as Record<string, unknown>
        const part = event.part as Record<string, unknown> | undefined
        const candidate = event.text ?? part?.text
        if (typeof candidate === "string") text.push(candidate)
        const model = event.model ?? part?.model
        if (typeof model === "string") this.observedModel = model
      } catch { text.push(line) }
    }
    return { text: text.join("\n") }
  }
}

function resolveOpenCodeExecutable(binary: string): string {
  if (process.platform !== "win32" || binary.toLowerCase() !== "opencode") return binary
  const appData = process.env.APPDATA
  if (!appData) return binary
  const executable = join(appData, "npm", "node_modules", "@opencode", "cli", "bin", "opencode.exe")
  return existsSync(executable) ? executable : binary
}

function registry(): CapabilityRegistry {
  const out = new CapabilityRegistry()
  const evidence = localEvidenceAdapter(), verify = localVerifyAdapter(), proof = localProofAdapter()
  out.register({ id: "evidence", version: localPackageVersion(evidence.pkg), operations: ["CAPTURE_EVIDENCE"], available: true, handle: evidence })
  out.register({ id: "verify", version: localPackageVersion(verify.pkg), operations: ["VERIFY"], available: true, handle: verify })
  out.register({ id: "proof", version: localPackageVersion(proof.pkg), operations: ["BUILD_PROOF"], available: true, handle: proof })
  return out
}

const schemas: Record<string, { schema: string; component: string }> = {
  evidence: { schema: "opencode.evidence.v1", component: "opencode-evidence" },
  verification: { schema: "opencode.verification.v1", component: "opencode-verify" },
  proof: { schema: "opencode.proof.v1", component: "opencode-proof" },
}

export async function executeWorkerWork(input: RuntimeWorkInput, provider?: ModelProvider): Promise<RuntimeWorkResult> {
  const projectDir = resolve(input.projectDir)
  const engine = new WorkEngine(projectDir, input.storeDir ? { store_dir: input.storeDir } : {}, registry(), { ...(provider ? { modelProvider: provider } : {}) })
  const declared = engine.declare(input.declaration)
  const declaration = declared.declaration as unknown as Record<string, unknown>
  const workID = String(declaration.work_id)
  const run = await engine.run(workID) as unknown as Record<string, unknown>
  const modelProvider = provider as (ModelProvider & { observedModel?: string; lastResult?: unknown }) | undefined
  if (run.state === "BLOCKED") return { declaration, run, status: "BLOCKED", artifacts: [], provenance: { project_id: input.projectID, work_id: workID, ledger_dir: input.ledgerDir, edge_record_ids: [] }, ...(modelProvider?.lastResult ? { model_execution: modelProvider.lastResult } : {}), ...(input.model || modelProvider?.observedModel ? { model: { ...(input.model ? { requested: input.model } : {}), ...(modelProvider?.observedModel ? { observed: modelProvider.observedModel } : {}) } } : {}) }
  const acceptance = await engine.accept(workID) as unknown as Record<string, unknown>
  const source = new GitRepo(projectDir).describeSource()
  const ledger = new ProvenanceLedger(resolve(input.ledgerDir), input.projectID)
  const work: WorkRef = { kind: "work", work_id: workID, version: Number(declaration.work_version) }
  const producer = { component: "opencode-runtime", version: "0.2.0" }
  const refs = new Map<string, ArtifactRef>()
  const artifacts: RuntimeWorkResult["artifacts"] = []
  const edgeRecordIDs: string[] = []
  const ops = run.ops as Array<Record<string, unknown>>
  for (const item of ops) {
    if (item.status !== "ok" || !item.output) continue
    const output = item.output as Record<string, unknown>
    const kind = String(output.kind ?? "")
    const spec = schemas[kind]
    const id = output.evidence_id ?? output.verification_id ?? output.proof_id
    if (!spec || typeof id !== "string") continue
    const ref: ArtifactRef = { kind: "artifact", artifact_id: id, schema: spec.schema, producer: { component: spec.component, version: "0.1.0" } }
    refs.set(String(item.op_id), ref); ledger.registerArtifact(ref, { source, provenance: { project_id: input.projectID, session_id: String(run.run_id), work_id: workID } })
    artifacts.push({ id, schema: spec.schema, kind })
  }
  const acceptanceRef: ArtifactRef = { kind: "artifact", artifact_id: String(acceptance.acceptance_id), schema: "opencode.acceptance.v1", producer: { component: "opencode-work", version: "0.1.0" } }
  ledger.registerArtifact(acceptanceRef, { source, provenance: { project_id: input.projectID, session_id: String(run.run_id), work_id: workID } })
  artifacts.push({ id: acceptanceRef.artifact_id, schema: acceptanceRef.schema, kind: "acceptance" })
  const record = (from: WorkRef | OperationRef | ArtifactRef, relation: "BELONGS_TO_WORK" | "PRODUCED" | "VERIFIED_BY" | "SUPPORTED_BY" | "ACCEPTED_BY", to: WorkRef | ArtifactRef) => {
    const result = ledger.recordEdge({ project_id: input.projectID, work, from, relation, to, producer, source, provenance: { project_id: input.projectID, session_id: String(run.run_id), work_id: workID } })
    edgeRecordIDs.push(result.record_id)
  }
  for (const item of ops) {
    const op: OperationRef = { kind: "operation", work_id: workID, op_id: String(item.op_id) }
    record(op, "BELONGS_TO_WORK", work)
    const ref = refs.get(String(item.op_id)); if (ref) record(op, "PRODUCED", ref)
    const output = item.output as Record<string, unknown> | undefined
    if (!output) continue
    if (output.kind === "verification") {
      const verifyRef = refs.get(String(item.op_id)); const plan = (declaration.plan as Array<Record<string, unknown>>).find((p) => p.op_id === item.op_id)
      for (const evidenceOp of (plan?.evidence as string[] | undefined) ?? []) { const evidenceRef = refs.get(evidenceOp); if (evidenceRef && verifyRef) record(evidenceRef, "VERIFIED_BY", verifyRef) }
    }
    if (output.kind === "proof") {
      const proofRef = refs.get(String(item.op_id)); const plan = (declaration.plan as Array<Record<string, unknown>>).find((p) => p.op_id === item.op_id)
      for (const obligation of (plan?.obligations as Array<Record<string, unknown>> | undefined) ?? []) { const verifyRef = refs.get(String(obligation.verification)); if (verifyRef && proofRef) record(verifyRef, "SUPPORTED_BY", proofRef) }
      if (proofRef) record(proofRef, "ACCEPTED_BY", acceptanceRef)
    }
  }
  return { declaration, run, acceptance, status: acceptance.outcome as "ACCEPTED" | "REJECTED", artifacts, provenance: { project_id: input.projectID, work_id: workID, ledger_dir: resolve(input.ledgerDir), edge_record_ids: edgeRecordIDs }, ...(modelProvider?.lastResult ? { model_execution: modelProvider.lastResult } : {}), ...(input.model || modelProvider?.observedModel ? { model: { ...(input.model ? { requested: input.model } : {}), ...(modelProvider?.observedModel ? { observed: modelProvider.observedModel } : {}) } } : {}) }
}

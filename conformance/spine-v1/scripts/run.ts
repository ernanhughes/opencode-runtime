import { execFileSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { validateProvenanceRef, type ProvenanceRef } from "../../../contracts/provenance";
import { localEvidenceAdapter, localPackageVersion, localProofAdapter, localVerifyAdapter } from "../../../../opencode-work/src/adapters";
import { CapabilityRegistry } from "../../../../opencode-work/src/capabilities";
import { WorkEngine } from "../../../../opencode-work/src/engine";

type Json = Record<string, unknown>;
const here = dirname(fileURLToPath(import.meta.url));
const projects = resolve(here, "../../../..");
const runtime = join(projects, "opencode-runtime");
const fixture = join(runtime, "conformance", "spine-v1", "fixture");
const siblings = ["opencode-evidence", "opencode-verify", "opencode-proof", "opencode-work", "opencode-vfs"];

function requireRepos(): void {
  for (const repo of siblings) {
    try { execFileSync("git", ["-C", join(projects, repo), "rev-parse", "--show-toplevel"], { stdio: "ignore" }); }
    catch { throw new Error(`BLOCKED: missing sibling repository ${repo}`); }
  }
}

function checks(): void {
  for (const repo of ["opencode-evidence", "opencode-verify", "opencode-proof", "opencode-work"]) {
    execFileSync("bun", ["run", "check"], { cwd: join(projects, repo), stdio: "pipe" });
  }
  execFileSync("bun", ["run", "typecheck"], { cwd: join(projects, "opencode-vfs"), stdio: "pipe" });
  execFileSync("bun", ["test"], { cwd: join(projects, "opencode-vfs"), stdio: "pipe" });
  execFileSync("bun", ["test"], { cwd: runtime, stdio: "pipe" });
}

function registry(): CapabilityRegistry {
  const out = new CapabilityRegistry();
  const evidence = localEvidenceAdapter();
  const verify = localVerifyAdapter();
  const proof = localProofAdapter();
  out.register({ id: "evidence", version: localPackageVersion(evidence.pkg), operations: ["CAPTURE_EVIDENCE"], available: true, handle: evidence });
  out.register({ id: "verify", version: localPackageVersion(verify.pkg), operations: ["VERIFY"], available: true, handle: verify });
  out.register({ id: "proof", version: localPackageVersion(proof.pkg), operations: ["BUILD_PROOF"], available: true, handle: proof });
  return out;
}

const equalsZero = { kind: "evidence_field", path: "observation.exit_code", operator: "EQUALS", expected: 0 };

function opSet(prefix: string, command: string, args: string[], description: string) {
  return [
    { op_id: `${prefix}-run`, kind: "RUN_COMMAND", command, args, cwd: fixture, subject: prefix },
    { op_id: `${prefix}-ev`, kind: "CAPTURE_EVIDENCE", source_op: `${prefix}-run` },
    { op_id: `${prefix}-vr`, kind: "VERIFY", criterion: equalsZero, evidence: [`${prefix}-ev`] },
  ];
}

async function happyPath(): Promise<{ proof: string; acceptance: string }> {
  const engine = new WorkEngine(fixture, { store_dir: mkdtempSync(join(tmpdir(), "runtime-spine-happy-")) }, registry());
  const specs = [
    ["exists", "node", ["-e", "require('fs').accessSync('result.txt')"], "result.txt exists"],
    ["content", "node", ["-e", "const s=require('fs').readFileSync('result.txt','utf8');process.exit(s==='hello runtime\\n'?0:1)"], "content matches exactly"],
    ["test", "node", ["-e", "process.exit(0)"], "test exits zero"],
  ] as const;
  const plan = specs.flatMap(([p, c, a, d]) => opSet(p, c, [...a], d));
  plan.push({
    op_id: "proof", kind: "BUILD_PROOF",
    obligations: specs.map(([p, , , description]) => ({ description, criterion: equalsZero, evidence: [`${p}-ev`], verification: `${p}-vr` })),
  } as never);
  const { declaration } = engine.declare({
    objective: { statement: "result.txt exists and contains exactly hello runtime", source: "human" },
    claim: { statement: "The declared result fixture satisfies all three checks.", subject: "result.txt" },
    success: {
      obligations: specs.map(([, , , description]) => ({ description, criterion: equalsZero })),
      acceptance: { checks: [{ name: "current-state", command: "node", args: ["-e", "const f=require('fs');process.exit(f.existsSync('result.txt')&&f.readFileSync('result.txt','utf8')==='hello runtime\\n'?0:1)"], cwd: fixture }] },
    },
    plan,
    authority: { scope: "offline fixture only" },
  });
  const run = await engine.run(declaration.work_id);
  const proof = run.ops.find((op) => op.op_id === "proof")?.output as Json;
  const acceptance = await engine.accept(declaration.work_id);
  if (proof.status !== "COMPLETE" || acceptance.outcome !== "ACCEPTED") throw new Error("happy path did not converge");
  return { proof: String(proof.status), acceptance: acceptance.outcome };
}

async function specificationGap(): Promise<{ proof: string; acceptance: string }> {
  const engine = new WorkEngine(fixture, { store_dir: mkdtempSync(join(tmpdir(), "runtime-spine-gap-")) }, registry());
  const plan: Json[] = [...opSet("tests", "node", ["-e", "process.exit(0)"], "tests pass")];
  plan.push({ op_id: "proof", kind: "BUILD_PROOF", obligations: [{ description: "tests pass", criterion: equalsZero, evidence: ["tests-ev"], verification: "tests-vr" }] });
  const { declaration } = engine.declare({
    objective: { statement: "configuration remains backward-compatible", source: "human" },
    claim: { statement: "The declared test command passes.", subject: "configuration" },
    success: {
      obligations: [{ description: "tests pass", criterion: equalsZero }],
      acceptance: { checks: [{ name: "backward-compatibility-not-established", command: "node", args: ["-e", "process.exit(1)"] }] },
    },
    plan,
    authority: { scope: "offline fixture only" },
  });
  const run = await engine.run(declaration.work_id);
  const proof = run.ops.find((op) => op.op_id === "proof")?.output as Json;
  const acceptance = await engine.accept(declaration.work_id);
  if (proof.status !== "COMPLETE" || acceptance.outcome !== "REJECTED") throw new Error("specification gap was erased");
  return { proof: String(proof.status), acceptance: acceptance.outcome };
}

function fakeProvenance(): ProvenanceRef {
  const ref = { project_id: "opencode-runtime", session_id: "offline-spine-v1", event_id: "fixture", segment: "spine-v1", source_head: "offline", source_diff_sha256: "0".repeat(64) };
  const result = validateProvenanceRef(ref);
  if (!result.ok) throw new Error(`${result.code}: ${result.message}`);
  return result.value;
}

try {
  requireRepos();
  checks();
  await happyPath();
  await specificationGap();
  fakeProvenance();
  console.log(`OpenCode Runtime Spine v1\n\nEvidence              PASS\nVerify                PASS\nProof                 PASS\nWork adapter          PASS\nAcceptance separation PASS\nProvenance contract   PASS\nEnd-to-end fixture    PASS\n\nRESULT: PASS`);
} catch (error) {
  console.error(`OpenCode Runtime Spine v1\n\nRESULT: ${String(error).startsWith("Error: BLOCKED") ? "BLOCKED" : "FAIL"}\n${String(error)}`);
  process.exit(1);
}

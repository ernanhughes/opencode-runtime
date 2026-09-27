# Work adapter audit

| capability | existing expected input | existing expected output | adapter | existing tests | gap before spine |
|---|---|---|---|---|---|
| Evidence | observed command, exit code, bounded stdout/stderr, cwd/subject | domain `EvidenceRecord`, persisted by id | `opencode-work/src/adapters.ts` | Work integration; Evidence capture/store/integrity | no ecosystem-level runner |
| Verify | claim, explicit criterion, supplied EvidenceRecords | domain `VerificationReceipt` with `PASS/FAIL/INCONCLUSIVE` | `opencode-work/src/adapters.ts` | Work integration; Verify engine/operators/three-valued tests | no ecosystem-level runner |
| Proof | claim, declared obligations, evidence and receipts | domain `ProofArtifact` plus obligation statuses | `opencode-work/src/adapters.ts` | Work integration; Proof bindings/replay/status tests | no ecosystem-level runner |

The repositories' current contracts are authoritative. In particular,
`INCONCLUSIVE` is not collapsed into `FAIL` or renamed `BLOCKED`, and missing
Proof dependencies remain a construction error rather than a proof status.

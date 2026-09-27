# Runtime Conformance Spine v1

This suite exercises the existing domain-owned contracts rather than replacing
them with a runtime mega-schema.

The happy path declares three obligations (file exists, exact content, command
exit zero), captures each command observation through `opencode-evidence`,
verifies it through `opencode-verify`, assembles the receipts through
`opencode-proof`, and then lets `opencode-work` independently re-observe the
acceptance state.

The specification-gap fixture deliberately proves only a declared exit-code
obligation while its independent acceptance check fails. Its required result is
`Proof COMPLETE` together with `Acceptance REJECTED`.

Provenance status is **contract + fake provider seam tested**. The fixtures use
a deterministic in-memory provider returning a valid `ProvenanceRef`; they do
not claim to have exercised a live OpenCode event stream.

Run from `opencode-runtime`:

```powershell
bun run conformance:spine
```

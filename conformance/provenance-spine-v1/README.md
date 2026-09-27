# OpenCode Runtime Provenance Spine

This offline fixture drives the real Work adapters through Evidence, Verify,
Proof, and Acceptance, then records only their stable references in the VFS
causal ledger. It deliberately produces `Proof COMPLETE` with
`Acceptance REJECTED` and confirms that VFS preserves both links without
reinterpreting either domain result.

```powershell
bun run conformance:provenance
```

The fixture uses no model and does not claim live OpenCode hook coverage.

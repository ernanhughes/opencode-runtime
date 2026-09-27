# Compatibility and Maturity

This file is descriptive. It must not promote a repository's maturity beyond what that repository currently documents.

| Repository | Role | Current runtime status |
|---|---|---|
| opencode-work | execution / acceptance process | Implemented; offline Evidence → Verify → Proof → Acceptance conformance passes; live integration unverified |
| opencode-vfs | provenance | Initial implementation; live OpenCode integration still to be exercised |
| opencode-remembering | memory runtime | Implemented |
| opencode-expertise | expertise retrieval | v0.1 implementation exists |
| opencode-lens | representation | Design seed |
| opencode-relate | relationships | Design seed |
| opencode-radar | attention | Design seed |
| opencode-authority | permission/policy | Design seed |
| opencode-evidence | observation/evidence | Implemented offline; deterministic capture, validation, identity, integrity, and storage tests pass |
| opencode-verify | explicit criterion verification | Implemented offline; deterministic three-valued evaluation and receipt tests pass |
| opencode-proof | declared-obligation proof assembly | Implemented offline; binding, status, integrity, and structural replay tests pass |
| project-context-compiler | deterministic context compilation | Implemented |
| project-context-opencode | OpenCode context capture/intervention | Implemented |
| project-context | context research | Research repository, not runtime dependency |
| project-memory | memory research | Research/evidence repository, not runtime dependency |

## Compatibility policy

Before a profile is called runnable, every required plugin in that profile must have:

1. an explicit public contract;
2. an install/load check;
3. a no-inference health check where possible;
4. declared OpenCode API/version compatibility;
5. deterministic failure for unavailable required dependencies;
6. provenance-compatible identifiers;
7. at least one cross-plugin smoke test for every declared dependency edge.

A repository merely existing in GitHub is not sufficient evidence of runtime compatibility.

## Spine v1 evidence

Run `bun run conformance:spine` from this repository. The command fails closed
when a sibling checkout is absent, runs the deterministic checks for Evidence,
Verify, Proof, and Work, executes accepted and specification-gap fixtures, and
validates the shared provenance reference. VFS remains
`implemented_unverified_live`: the suite tests a fake provenance provider seam,
not the live OpenCode event path.

# Compatibility and Maturity

This file is descriptive. It must not promote a repository's maturity beyond what that repository currently documents.

| Repository | Role | Current runtime status |
|---|---|---|
| opencode-work | execution / acceptance process | Implemented offline; live OpenCode integration documented as unverified |
| opencode-vfs | provenance | Initial implementation; live OpenCode integration still to be exercised |
| opencode-remembering | memory runtime | Implemented |
| opencode-expertise | expertise retrieval | v0.1 implementation exists |
| opencode-lens | representation | Design seed |
| opencode-relate | relationships | Design seed |
| opencode-radar | attention | Design seed |
| opencode-authority | permission/policy | Design seed |
| opencode-evidence | evidence boundary | Seed repository; README contract not yet populated |
| opencode-verify | verification boundary | Seed repository; README contract not yet populated |
| opencode-proof | proof boundary | Seed repository; README contract not yet populated |
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

# OpenCode Runtime

OpenCode Runtime is the architecture and coordination layer for the OpenCode plugin ecosystem in this account.

It does not replace the individual plugins and it is not a mega-plugin. Its job is to make the system legible:

- define what each repository owns;
- define what each repository must not own;
- show how the plugins compose;
- define shared record contracts;
- define install profiles;
- define dependency and maturity information;
- provide one place to understand the runtime as a system.

## Runtime model

```text
                         HUMAN INTENT
                              |
                              v
                        opencode-work
                   objective / obligations /
                  execution / acceptance process
                              |
             +----------------+----------------+
             |                |                |
             v                v                v
          CONTEXT          KNOWLEDGE        ASSURANCE
             |                |                |
   +---------+------+   +-----+------+   +-----+------+
   | project-context |   | expertise  |   | evidence   |
   | compiler        |   | radar      |   | verify     |
   | remembering     |   | relate     |   | proof      |
   | opencode adapter|   | lens       |   | authority  |
   +---------+------+   +-----+------+   +-----+------+
             |                |                |
             +----------------+----------------+
                              |
                              v
                        opencode-vfs
                    interaction provenance
                       + Git linkage
                              |
                              v
                             GIT
```

The diagram is compositional, not a mandatory call graph. Several plugins explicitly require orchestration by the caller rather than direct plugin-to-plugin calls.

## Design laws

1. **One plugin, one owned job.**
2. **Composition happens through explicit records, not hidden coupling.**
3. **Context, memory, knowledge, evidence, authority, verification, proof, acceptance, and provenance remain distinct concepts.**
4. **Plugins fail loudly when required capabilities are unavailable.**
5. **Provenance records what happened; it does not decide whether the result is correct.**
6. **Work owns the process by which acceptance is established; it does not redefine acceptance truth during execution.**
7. **Authority answers whether an operation may be performed for a purpose. It is not a source-quality score.**
8. **Derived representations never replace their source.**
9. **Unknown/unavailable is a first-class state; it is not silently upgraded into permission, truth, or success.**
10. **Research repositories are provenance/evidence for runtime mechanisms, not automatic runtime dependencies.**

## Repository groups

### Execution and provenance

- [opencode-work](https://github.com/ernanhughes/opencode-work) — work declaration, amendments, execution plan, capability orchestration, and acceptance process.
- [opencode-vfs](https://github.com/ernanhughes/opencode-vfs) — Git-backed AI interaction and change provenance.

### Context and memory

- [project-context](https://github.com/ernanhughes/project-context) — research and experiments for context engineering.
- [project-context-compiler](https://github.com/ernanhughes/project-context-compiler) — deterministic bounded context compiler.
- [project-context-opencode](https://github.com/ernanhughes/project-context-opencode) — canonical OpenCode capture/intervention adapter for Project Context.
- [project-memory](https://github.com/ernanhughes/project-memory) — research/evidence companion for the memory programme.
- [opencode-remembering](https://github.com/ernanhughes/opencode-remembering) — production-oriented memory runtime and OpenCode plugin.

### Knowledge and representation

- [opencode-expertise](https://github.com/ernanhughes/opencode-expertise) — referenced expertise retrieval from curated knowledge territories.
- [opencode-radar](https://github.com/ernanhughes/opencode-radar) — attention and resolution decisions.
- [opencode-relate](https://github.com/ernanhughes/opencode-relate) — typed directional relationships.
- [opencode-lens](https://github.com/ernanhughes/opencode-lens) — purpose-specific source-linked representations.

### Assurance and permission

- [opencode-evidence](https://github.com/ernanhughes/opencode-evidence) — evidence capability surface (seed repository).
- [opencode-verify](https://github.com/ernanhughes/opencode-verify) — verification capability surface (seed repository).
- [opencode-proof](https://github.com/ernanhughes/opencode-proof) — proof capability surface (seed repository).
- [opencode-authority](https://github.com/ernanhughes/opencode-authority) — permission/policy decisions for operations and information use.

See [architecture/SYSTEM.md](architecture/SYSTEM.md), [plugin-map.yaml](plugin-map.yaml), [profiles.yaml](profiles.yaml), and [contracts/README.md](contracts/README.md).

## What this repository owns

This repository owns:

- ecosystem architecture;
- shared vocabulary;
- compatibility declarations;
- install profiles;
- cross-plugin contracts;
- dependency rules;
- provenance/event integration conventions.

It does **not** own:

- context compilation;
- memory;
- retrieval;
- evidence capture;
- verification;
- proof;
- authority decisions;
- source-repository mutations;
- model orchestration implementations already owned elsewhere.

## Status

The architecture now includes an offline conformance spine for Work → Evidence
→ Verify → Proof → Acceptance plus an optional VFS provenance reference seam.
Run `bun run conformance:spine`. Live OpenCode/VFS event integration remains
explicitly unverified.

The [native OpenCode acceptance harness](conformance/native-opencode-v1/README.md)
now observes the actual 2.0.22 agent loop and Code Mode tool path using a scripted
loopback generation fixture. Its stage receipts separate admission, permissions,
callbacks, effects, session results and hooks. It performs no model inference and
does not establish Writer integration or full release readiness.

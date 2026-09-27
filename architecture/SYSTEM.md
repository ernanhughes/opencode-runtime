# OpenCode Runtime System Architecture

## 1. Purpose

The runtime is a federation of small plugins and supporting research repositories. The organizing principle is ownership, not convenience: every capability gets one clear home and other components consume it through explicit records or adapters.

## 2. Layers

### Layer A — Execution

**opencode-work**

Owns:

- Work declarations;
- versioned amendments to success/obligations;
- deterministic operation plans;
- orchestration over registered capabilities;
- the process by which acceptance is established;
- separation of proof from acceptance.

Does not own:

- Evidence semantics;
- verification semantics;
- proof construction semantics;
- expertise internals;
- authority policy;
- provenance storage.

### Layer B — Provenance

**opencode-vfs**

Owns:

- observable OpenCode interaction history;
- prompt/response/tool-event capture;
- source Git state linkage;
- append-only provenance segments;
- current-repo or external-provenance-repo Git storage;
- traceability from AI interaction to repository state.

Does not decide whether a change is correct.

### Layer C — Context and memory

**project-context**

Research/evidence repository for context engineering. Not a runtime dependency by default.

**project-context-compiler**

Owns deterministic bounded context assembly. Same inputs + policy + costs => same bundle + trace, or explicit failure.

**project-context-opencode**

Owns OpenCode observation and controlled context intervention. Installing it changes nothing unless its capture/intervention flags are enabled.

**project-memory**

Research/evidence repository for the memory programme. Not a runtime dependency of opencode-remembering.

**opencode-remembering**

Owns durable project history, recall/influence separation, temporal interpretation, scope/frame/trust controls, decisive selection, context traces, open loops, and explicit memory writes.

### Layer D — Knowledge and representation

**opencode-expertise**

Owns referenced expertise discovery/synthesis candidates from curated knowledge territories. Context still owns final admission.

**opencode-radar**

Owns attention decisions: SHOW / QUEUE / SIDECAR / SKIP and requested resolution. Relevance, novelty, urgency, truth, and accessibility remain separate dimensions.

**opencode-relate**

Owns typed relationship observations between bounded pairs/items. Relationship is not truth or authority.

**opencode-lens**

Owns purpose-specific representations with source lineage and preservation reporting. Source remains primary.

### Layer E — Assurance and permission

**opencode-evidence**

Seed capability expected to own evidence records used by Work. Its repository currently contains no detailed public contract; Runtime must not invent one beyond the adapter boundary already consumed by Work.

**opencode-verify**

Seed capability expected to own verification receipts used by Work. Detailed ownership remains to be earned/documented in its repository.

**opencode-proof**

Seed capability expected to own proof artifacts used by Work. Detailed ownership remains to be earned/documented in its repository.

**opencode-authority**

Owns deterministic permission/policy decisions:

```text
proposed operation
+ purpose
+ data inputs
+ grants/policy
+ counterparties
  -> ALLOW | DENY | REQUIRE_APPROVAL | REFORMULATE
```

Authority is about permission to perform/use/disclose. It is not an epistemic ranking score.

## 3. Composition laws

### Caller orchestration over direct coupling

Lens, Relate, Radar, and Authority explicitly avoid calling one another directly. A caller or Work composes them.

Example:

```text
source
  -> Lens -> RepresentationArtifact
  -> Relate -> RelationObservation
  -> Radar -> RadarDecision
  -> main/work orchestrator
  -> Authority -> permission decision
```

### Context admission remains owned by context

Expertise can discover useful material, but an ExpertiseBrief is a candidate input. It does not bypass the context compiler or context budget.

### Acceptance is separate from proof

```text
Proof:      did the declared obligations pass?
Acceptance: did we arrive at the requested state?
```

Work keeps these separate.

### Provenance is cross-cutting

All capabilities should eventually be able to emit provenance-compatible observations:

```text
capability action
   -> output/receipt/artifact
   -> opencode-vfs provenance event
   -> source/provenance Git linkage
```

The provenance event must record what happened, not reinterpret the capability's result.

## 4. Research vs runtime

Research repositories may justify mechanisms but must not silently become runtime dependencies.

```text
project-memory
   -> research provenance for
opencode-remembering

project-context
   -> research provenance for
project-context-compiler / project-context-opencode
```

Runtime packages own their product implementations.

## 5. Architectural dependency direction

Preferred direction:

```text
research evidence
      |
      v
runtime capability packages
      |
      v
adapters / registry
      |
      v
opencode-work orchestration

all observable execution
      |
      v
opencode-vfs provenance
```

Avoid cycles where foundational capabilities call higher-level orchestration.

## 6. Maturity rule

A repository name is not evidence that a capability exists. The runtime map distinguishes:

- research;
- design-seed;
- implemented;
- experimentally-earned;
- integration-unverified.

The runtime must preserve those distinctions rather than presenting every repository as production-ready.

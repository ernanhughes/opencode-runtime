# Shared Runtime Contracts

This directory defines the small shared vocabulary that allows independently-owned plugins to compose without becoming one codebase.

The rule is:

> Share records and identifiers; do not share hidden implementation assumptions.

## Core records

The runtime should converge on these concepts.

### SourceRef

Identifies the source from which a claim, representation, relation, context candidate, or evidence item derives.

Minimum direction:

```ts
type SourceRef = {
  id: string
  kind: string
  uri?: string
  version?: string
  scope?: string
  observed_at?: string
}
```

Lens and Relate already expose compatible SourceRef-shaped records.

### ProducerRef

Records which plugin/version/model produced a derived artifact.

```ts
type ProducerRef = {
  plugin: string
  version: string
  model?: string
}
```

### ProvenanceRef

Links a capability result to opencode-vfs without embedding the entire interaction trace.

```ts
type ProvenanceRef = {
  project_id: string
  session_id: string
  event_id?: string
  segment?: string
  source_head?: string
}
```

### CapabilityReceipt

Generic envelope for capability outputs while preserving the capability-owned payload.

```ts
type CapabilityReceipt<T> = {
  schema: string
  id: string
  capability: string
  produced_at: string
  producer: ProducerRef
  provenance?: ProvenanceRef
  payload: T
}
```

This envelope does not normalize away domain meaning. An AuthorityReceipt remains an AuthorityReceipt; a RelationObservation remains a RelationObservation.

## Existing domain-owned records

These should remain owned by their source plugin:

- Work declaration / WorkRun / AcceptanceRecord — opencode-work
- ContextBundle / DecisionTrace / CompileFailure — project-context-compiler
- OpenCode capture / intervention trace — project-context-opencode
- ContextTrace / memory actions / open-loop state — opencode-remembering
- ExpertiseBrief — opencode-expertise
- RepresentationArtifact / PreservationReport — opencode-lens
- RelationObservation — opencode-relate
- RadarDecision — opencode-radar
- AuthorityReceipt — opencode-authority
- EvidenceRecord — opencode-evidence capability boundary
- VerificationReceipt — opencode-verify capability boundary
- ProofArtifact — opencode-proof capability boundary

## Required provenance fields over time

Every runtime capability should eventually be able to expose or be wrapped with:

- stable output identifier;
- producer plugin + version;
- source/input references;
- session/work identifier where applicable;
- timestamp or observation identity where semantically appropriate;
- source Git commit/diff identity where applicable;
- explicit UNKNOWN / BLOCKED / unavailable states;
- references to validation or proof artifacts rather than prose-only claims.

## Non-goal

The runtime does not force one universal mega-schema. Domain contracts remain local. Shared contracts exist only where cross-plugin composition genuinely requires them.

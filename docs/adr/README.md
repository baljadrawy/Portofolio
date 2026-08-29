# Architecture Decision Records

An ADR records a decision that is **expensive to reverse**. Contracts marked
"locked" in the architecture documents may only change through a new ADR that
supersedes the existing one.

## Format

```
# ADR-NNNN — Title

Status:    PROPOSED | ACCEPTED | SUPERSEDED by ADR-NNNN
Date:
Phase:

## Context      what forced a decision
## Decision     what was decided
## Consequences what this costs and enables
## Alternatives what was rejected, and why
```

## Index

| ADR | Title | Status |
|---|---|---|
| [0001](./ADR-0001-evidence-first.md) | Evidence-first architecture | ACCEPTED |
| [0002](./ADR-0002-canonical-asset-identity.md) | Canonical asset identity before intelligence | ACCEPTED |
| [0003](./ADR-0003-deterministic-decision-policy.md) | Deterministic decision policy over LLM discretion | ACCEPTED |
| [0004](./ADR-0004-security-provider-abstraction.md) | Security provider abstraction | ACCEPTED |
| [0005](./ADR-0005-three-scores.md) | Three scores instead of one | ACCEPTED |

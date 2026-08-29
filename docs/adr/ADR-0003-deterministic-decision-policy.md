# ADR-0003 — Deterministic decision policy over LLM discretion

**Status:** ACCEPTED · **Date:** 2026-08-29 · **Phase:** 4

## Context

If a model chooses the final decision, the same evidence can yield different
decisions across runs, guardrails become suggestions, and the most damaging
retail behaviour — selling on drawdown alone — becomes reachable.

## Decision

The model produces **assessments**; deterministic, versioned code produces the
**decision**.

```
AI Assessment → Decision Policy Engine → Final Decision
```

Guardrails G-1…G-8 are code. The decision enum is locked. Critically:

```
G-3: price-only decline may NEVER produce EXIT
```

## Consequences

**Enables:** identical decisions from identical inputs · unit-testable guardrails
· stable history · structural immunity to panic-selling.

**Costs:** less flexible than free model judgement · policy changes need
versioning · edge cases may need explicit encoding.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| LLM decides freely | Non-reproducible; guardrails unenforceable |
| Guardrails in the prompt | Prompt instructions are advisory, not binding |
| Score threshold → decision | Ignores confidence, freshness, and thesis state |

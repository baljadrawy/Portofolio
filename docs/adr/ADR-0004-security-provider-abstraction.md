# ADR-0004 — Security provider abstraction

**Status:** ACCEPTED · **Date:** 2026-08-29 · **Phase:** 1

## Context

Palisade is a candidate for the security layer, but its license, maintenance,
chain coverage, and **false-positive behaviour** are unverified. Binding the
Security Engine directly to it would make replacement expensive.

Separately, the existing `SymbolMapper` scam filter is name-based display
hygiene — not a security assessment — and must not be confused with, or replaced
by, this layer.

## Decision

Define a `SecurityProvider` interface. Palisade becomes one adapter behind it,
adopted only after the §1 checklist in `12 · External References` passes —
with measured false-positive behaviour, not assumed.

The `SymbolMapper` filter is retained unchanged as a separate, complementary
layer.

## Consequences

**Enables:** provider substitution without touching consumers · multiple
providers with corroboration · Phase 1 proceeds without blocking on Palisade
evaluation.

**Costs:** an interface broad enough for several providers · adapter maintenance
· possible lowest-common-denominator capability surface.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Direct Palisade dependency | Lock-in to an unverified dependency |
| Build security in-house first | Slow; reinvents a solved problem |
| Extend `SymbolMapper` | Name-based checks cannot inspect contracts |

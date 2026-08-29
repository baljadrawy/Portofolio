# ADR-0001 — Evidence-first architecture

**Status:** ACCEPTED · **Date:** 2026-08-29 · **Phase:** 2

## Context

An investment system that produces confident conclusions from unverifiable facts
is worse than no system: it manufactures false certainty at scale. The obvious
alternative — let each analysis module call an LLM and use its output directly —
makes every conclusion unauditable and irreproducible.

## Decision

A central **Evidence Store** holds every fact used in reasoning, with source,
tier, `retrieved_at`, `data_as_of`, and content hash.

```
LLM interprets evidence. It does not manufacture evidence.
```

Enforced mechanically: structured AI output must include `evidenceRefs`, and
references to non-existent evidence rows **fail schema validation**
(`10 · AI Provider` V-4).

## Consequences

**Enables:** auditability · reproducibility via evidence snapshots · conflict
detection · honest confidence · explaining what changed between analyses.

**Costs:** more storage · a collector layer before any reasoning · slower initial
delivery · every module must declare its evidence requirements.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| LLM-supplied facts | Unauditable, irreproducible, silently wrong |
| Per-module private caches | No cross-module conflict detection; no shared provenance |
| Evidence as an optional annotation | Optional provenance decays to no provenance |

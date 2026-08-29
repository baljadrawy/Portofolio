# ADR-0005 — Three scores instead of one

**Status:** ACCEPTED · **Date:** 2026-08-29 · **Phase:** 4

## Context

A single blended score hides the two distinctions that matter most in crypto:

```
Good Project ≠ Good Token
Good Token   ≠ Good Price
```

An excellent protocol whose token captures no value scores well on fundamentals.
A good token at a bad price scores well on quality. In both cases a single number
is most misleading exactly when the distinction matters most.

## Decision

Every analysis emits three independent scores:

- **PROJECT QUALITY** — is this a real, well-run project?
- **TOKEN INVESTMENT QUALITY** — does the token accrue the project's value?
- **CURRENT ENTRY VALUATION** — is the price reasonable now?

An overall score may be displayed, but **never alone**.

## Consequences

**Enables:** distinguishing "great project, bad token" from "great token, bad
price" · valuation changes without disturbing quality assessment · clearer
`HOLD_ACCUMULATE` vs `HOLD` reasoning.

**Costs:** three scores to explain instead of one · overlapping input dimensions
must be allocated carefully · more UI surface.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Single 0–100 score | Hides both critical distinctions |
| Score + separate valuation flag | Still conflates project and token quality |
| Per-dimension scores only, no aggregate | No usable summary for ranking holdings |

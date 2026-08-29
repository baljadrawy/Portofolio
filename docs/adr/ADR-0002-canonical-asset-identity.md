# ADR-0002 — Canonical asset identity before intelligence

**Status:** ACCEPTED · **Date:** 2026-08-29 · **Phase:** 0

## Context

Today `holdings.symbol` and `transactions.symbol` are free-text. There is no
asset entity (`00 · Current State Audit` §3). Every Intelligence contract keys on
`asset_id`.

Symbol-keyed identity cannot express: duplicate tickers · the same asset across
19 chains · native vs. wrapped vs. bridged · the MATIC→POL rebrand · a scam token
impersonating `USDC`.

## Decision

Build an **asset registry** keyed on `(network, contract_address)` — never on
symbol — before any Intelligence feature. Add `asset_lineage` so rebrands and
migrations preserve investment history. Add **economic exposure groups** so
concentration is computed on real exposure.

Migration is additive and dual-write; `symbol` columns are retained throughout
and the running tracker is untouched.

## Consequences

**Enables:** everything downstream. Evidence, events, theses, and decisions all
key on `asset_id`.

**Costs:** Phase 0 grows · a backfill producing many `UNRESOLVED` rows · dual-write
period · resolution rules must be maintained.

## Alternatives rejected

| Alternative | Why rejected |
|---|---|
| Keep symbol as identity | A scam `USDC` would inherit real USDC's thesis and evidence |
| Defer identity to Phase 3 | Every earlier contract would need rewriting |
| Adopt a provider's ID as primary | Provider coverage is incomplete and provider-specific |

# Security and Scam Engine

> 🟢 **CORE / PRE-LAUNCH** (Phase 2) — but only the checks that prevent a dangerous HOLD.
> Advanced security work (deployer graphs, wallet clustering, clone detection at scale,
> continuous surveillance, large consensus engines) is **POST-LAUNCH B2**. Split table in
> [`ROADMAP.md`](./ROADMAP.md) Phase 2.
>
> **Status:** **ABSTRACTION IMPLEMENTED (Phase 1, 2026-09-01).** Engine is Phase 2.
>
> `server/services/security-provider.ts` defines `SecurityProvider`,
> `SecurityObservation`, and `observationsToEvidence()`. Providers emit
> observations that become Evidence rows with `source_key = security:<provider>`
> — there is no vendor column and no security-only datastore.
>
> Palisade evaluated → `REFERENCE_ONLY`. **No adapter built.** See
> `12-EXTERNAL-REFERENCES.md` §2.
>
> Not yet built: Scam Gate · contract assessment · honeypot/rug detection ·
> incident handling · false-positive safeguards. All Phase 2.
>
> **Status:** Architecture contract.
> **Phased delivery:** `SecurityProvider` abstraction, Palisade feasibility, and
> the security output contract land in **Phase 1**. The engine itself — contract
> assessment, honeypot/rug indicators, incident handling, Scam Gate,
> false-positive safeguards — lands in **Phase 2**, alongside the Evidence Store
> it writes into.

---

## 0. Security data enters the Evidence architecture

```
Security findings ARE evidence.
```

Every security finding — a contract flag, a honeypot result, a liquidity lock
status, an incident — is written to the **Evidence Store** with full provenance:
source, tier, `retrieved_at`, `data_as_of`, confidence, hash.

### Forbidden design

```
❌  Security Engine → isolated storage → later migration to Evidence Store
```

A security silo would have to be migrated into the Evidence Store later, meaning
the work is paid for twice and conflict/freshness handling is duplicated. This is
why the Security Engine ships in Phase 2 **with** the Evidence platform, rather
than ahead of it.

What Phase 1 delivers is the **interface and the output contract**, so that the
first security finding ever produced is already shaped as evidence.

---

## 1. The distinction that governs this document

```
Spam Filtering  ≠  Investment Security Assessment
```

### What exists today

`server/services/symbol-mapper.ts` performs **airdrop-spam display filtering**:

- a small hardcoded set of known scam symbols
- regex patterns over token **names**: URL fragments, swap-scam names,
  `CLAIM` / `AIRDROP` / `REWARD` / `VISIT`, Unicode obfuscation
- applied at `/api/holdings` and `/api/portfolio/summary`
- reduces displayed holdings from 329 → ~138

It works, it solves a real UX problem, and **it stays**.

### What it cannot do

It reads a token's *name*. It never touches the *contract*. It therefore cannot
detect:

- a honeypot (buyable, not sellable)
- a hidden or unlimited mint function
- an upgradeable proxy with a malicious owner
- unlocked or absent liquidity
- a blacklist or freeze capability
- a deployer with a history of rug pulls

**A professionally-named malicious contract passes the current filter untouched.**

### Relationship

```
SymbolMapper (existing)        →  display hygiene, cheap, name-based
Security Engine (Phase 2)      →  investment safety, contract-based, evidence-backed
```

They are complementary layers, not competitors. The Security Engine never
replaces or weakens the existing filter.

---

## 2. Security assessment surface

The security layer must be able to assess:

| Category | Checks |
|---|---|
| **Contract** | source verified · proxy upgradeability · owner privileges · hidden mint · unlimited mint · blacklist · freeze · pausable |
| **Trading** | honeypot · sell restrictions · variable/hidden tax · transfer restrictions |
| **Liquidity** | pool depth · liquidity locked? · lock duration · LP holder concentration |
| **Distribution** | holder concentration · top-N share · suspicious transfer patterns |
| **Origin** | deployer address history · clone/copy patterns · contract age |
| **Market integrity** | fake volume — *only where evidence permits* |
| **Association** | suspicious wallet/team links — *only where verifiable on-chain* |

The last two carry explicit caveats because both are frequently asserted and
rarely provable. Where they cannot be evidenced, the module returns
`INSUFFICIENT_EVIDENCE` rather than a guess.

---

## 3. Suspicious ≠ Confirmed

```
CLEAN  →  LOW_CONCERN  →  SUSPICIOUS  →  HIGH_RISK  →  CONFIRMED_MALICIOUS
```

| State | Meaning | Consequence |
|---|---|---|
| `CLEAN` | Checks passed | none |
| `LOW_CONCERN` | Minor flags, common in legitimate tokens | note in report |
| `SUSPICIOUS` | Concerning pattern, insufficient proof | visible warning; **no** forced decision |
| `HIGH_RISK` | Strong indicators, short of proof | may cap decision at `REDUCE` |
| `CONFIRMED_MALICIOUS` | Tier 1–2 evidence of active fraud | Scam Gate override eligible |

Only `CONFIRMED_MALICIOUS` can trigger the override in §5.

---

## 4. False-positive safeguards

False positives are expensive: a wrongly flagged asset destroys trust in the
whole system. Mandatory safeguards:

| # | Safeguard |
|---|---|
| FP-1 | **No single weak signal** may produce `CONFIRMED_MALICIOUS` |
| FP-2 | Multiple **independent** indicators required for confirmation |
| FP-3 | Legitimate-pattern allowlist — upgradeable proxies and pausable contracts are normal for major protocols and must not alone flag |
| FP-4 | Contract age and track record weigh against a fraud verdict |
| FP-5 | Established Tier-1/2 identity (major listings, audits, real usage) raises the bar for confirmation |
| FP-6 | Every flag exposes the exact evidence that produced it |
| FP-7 | Operator override is possible and is recorded as evidence |
| FP-8 | `FALSE_POSITIVE` outcomes are retained to measure the FP rate over time |

> Blue-chip DeFi protocols routinely use upgradeable proxies, pausable contracts,
> and owner-privileged admin functions. A naive checker flags them all. FP-3 and
> FP-5 exist specifically to prevent that failure.

---

## 5. Scam Gate

An **independent** gate, outside the normal scoring path.

```
Scoring / Assessment ──┐
                       ├──►  Decision Policy  ──►  Decision
Scam Gate ─────────────┘
        (may override)
```

### Rules

- Fires only on `CONFIRMED_MALICIOUS`
- Requires **multiple independent** indicators (FP-1, FP-2)
- May override the overall score to `SCAM_CRITICAL_RISK`
- **Must** publish its reasoning and evidence — an unexplained override is
  forbidden
- Is auditable and reversible; a reversal is itself recorded

### Why a separate gate

A 92/100 project score must not survive proof that the contract is a honeypot.
Scoring averages; fraud is not an averageable property. The gate exists so a
single catastrophic fact can dominate — but only when *proven*.

---

## 6. Provider abstraction

```
SecurityProvider  (interface)
      │
      ├── PalisadeAdapter
      ├── (future) OtherProvider
      └── (internal) HeuristicProvider
```

Interface sketch:

```
SecurityProvider
├── assessContract(asset) → ContractAssessment
├── checkHoneypot(asset)  → HoneypotResult
├── checkLiquidity(asset) → LiquidityResult
├── deployerHistory(addr) → DeployerProfile
└── capabilities()        → supported chains + checks
```

Every provider result is written to the Evidence Store with provenance. No
provider is a black box whose verdict is trusted unexamined.

### Palisade

Recorded as an **INTEGRATE / ADAPT candidate** — explicitly *not* "blindly copy".

Before any code is used, verify:

- current license and its compatibility
- specific commit / version being adopted
- maintenance status and activity
- supported chains vs. our 19 EVM + Solana
- API surface and stability
- implementation quality and test coverage
- **false-positive behaviour** (measured, not assumed)
- external dependencies it drags in

The adapter interface exists precisely so Palisade can be replaced without
touching the Security Engine's consumers.

---

## 7. Security Score

Contributes 5 points to overall scoring (`08 · Scoring`), but its real power is
the Scam Gate, not the score weight.

Rationale: security is mostly binary in effect. A safe contract earns few points;
a proven malicious one ends the analysis. Weighting it heavily in an averaged
score would both over-reward the ordinary case and under-punish the fatal one.

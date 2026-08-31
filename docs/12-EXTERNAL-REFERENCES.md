# External References and Reuse Policy

> **Status:** Architecture contract.
> **Verification status:** None of these projects were fetched, cloned, or
> inspected during this documentation task. Every entry below is a **decision
> about how to evaluate them**, not an assessment of them.

---

## 1. Universal pre-adoption checklist

Before **any** code, schema, or prompt from an external project is used:

| # | Check |
|---|---|
| 1 | Current license, and its compatibility with this project (MIT) |
| 2 | Exact commit / version being adopted — recorded, not "latest" |
| 3 | Maintenance status: recent activity, open issue backlog, responsiveness |
| 4 | Supported chains vs. our 19 EVM + Solana |
| 5 | API surface and stability |
| 6 | Implementation quality on inspection |
| 7 | Test coverage |
| 8 | **False-positive behaviour, measured** — not assumed |
| 9 | Transitive dependencies introduced |
| 10 | Security posture of the dependency itself |

> A license seen in a README is not verification. Licenses change between
> versions; the license of the **exact commit** is what binds.

---

## 2. Palisade — EVALUATED (Phase 1, 2026-09-01)

**Decision:** `REFERENCE_ONLY`

> **Name collision, resolved first.** Three unrelated projects are called
> "Palisade": `kenlacroix/palisade` (host CVE monitoring, not crypto),
> Palisade Research (AI-safety org), and `palisadescan/palisade` — the crypto
> token scanner, which is the only relevant one and the one evaluated here.

### What was verified

| Check | Finding |
|---|---|
| Repository | `github.com/palisadescan/palisade` |
| Commit evaluated | `7df719d` · 2026-07-30 |
| License | **MIT** (read from the cloned `LICENSE`) |
| Language / runtime | Python 3, self-hostable, `pip install -e .` |
| Maintenance | Active as of Jul 2026 · **1 star, 0 forks** |
| Tests | 200 test functions, ~2,500 lines |
| Private keys / signing / custody | **NONE** — grep for `private_key`, `sign_transaction`, `sendTransaction` returned zero |
| `subprocess` / `eval` / `exec` | **NONE** |
| Telemetry | **NONE**. `feed.py` writes to a LOCAL sqlite file, storing only token address, tool, verdict, time |
| External services | GoPlus · DexScreener · Blockscout · public RPCs |
| API keys | Not required (optional Etherscan key) |
| Hosted endpoint | `mcp.palisadescan.com` — **timed out** during evaluation |

### Chain coverage — the decisive finding

```
Palisade : robinhood · ethereum · polygon · arbitrum · solana   (5)
Portfolio: 19 EVM chains + Solana                               (20)

Overlap  : 3 of our 19 EVM chains, plus Solana
```

Its **primary** chain is Robinhood Chain (`chainid 4663`), which this project
does not use at all.

### Why REFERENCE_ONLY rather than ADOPT or ADAPT

The security posture is genuinely clean and the license is permissive — those
were the disqualifying risks and neither materialised. The decision rests on
fit and validation instead:

1. **Coverage is wrong for us.** It answers for 3 of our 19 EVM chains, and its
   design centre is a chain we never touch.
2. **No external validation.** 1 star, 0 forks. For a component whose output can
   override every other conclusion, "nobody else has stressed this" is a real
   objection.
3. **It is largely a wrapper.** Its substance is GoPlus, DexScreener, and
   Blockscout. Integrating the wrapper adds a dependency without adding a source
   — and their terms, not Palisade's, are the binding constraint.
4. **It ships what we do not want.** An autonomous Telegram bot and a sentinel
   loop, both outside a read-only intelligence layer, would have to be isolated.

Its scanner heuristics and its GoPlus/DexScreener integration patterns remain a
legitimate reference for Phase 2.

### Re-evaluation triggers

Revisit if it gains meaningful EVM chain coverage, external adoption, or if
direct GoPlus integration proves harder than expected.

**No Palisade adapter was built.** The `SecurityProvider` abstraction is
provider-neutral and carries no vendor-specific field, so adding one later needs
no migration.

---

## 2b. Palisade — original architectural note (superseded)

**Domain:** security / contract analysis
**Original decision:** `INTEGRATE / ADAPT candidate`
**Explicitly not:** blindly copy

Consumed only behind `SecurityProvider` (`07 · Security Engine` §6), so it can be
replaced without touching any consumer.

**Highest-priority check:** false-positive behaviour. A security provider that
flags legitimate upgradeable proxies is worse than none — it trains the operator
to ignore warnings.

---

## 3. VerumTrade

**Domain:** evidence-first research architecture
**Decision:** `ADAPT ARCHITECTURE`
**Explicitly not:** replace Portfolio with VerumTrade

Architectural patterns of interest:

- evidence-first research
- analyst role separation
- Bull / Bear adversarial debate
- Risk Judge arbitration
- auditable reasoning chains
- decision guard layer

These patterns already shape `06 · Research Modules` and
`09 · Scoring and Decision`. What is adopted is the **shape**; any code reuse
requires the §1 checklist first.

---

## 4. openportfolio

**Domain:** investment thesis memory
**Decision:** `CONCEPTUAL REFERENCE`

Concepts of interest: decisions · catalysts · triggers · outcomes · forecasts ·
audit history.

**Adaptation required.** Crypto thesis breakers have no equity analogue —
tokenomics changes, unlock schedules, honeypots, and rug pulls do not exist in
traditional portfolio tooling. The concept transfers; the model does not.

---

## 5. analystOS

**Domain:** research tooling
**Decision:** `SELECTIVE ADAPTATION`
**Explicitly not:** integrate the application wholesale

Ideas of interest: research workflow · RAG · document ingestion · URL ingestion ·
multi-model research patterns.

**Constraint:** any ingestion path must write into the **Evidence Store** with
full provenance (`03 · Evidence Platform`). A RAG layer that produces unattributed
context violates the constitutional rule and would be rejected regardless of
quality.

---

## 6. Orbiter

**Domain:** portfolio optimisation
**Decision:** `DEFERRED — not in MVP`

Capabilities of eventual interest: portfolio optimisation · risk metrics ·
allocation · efficient frontier · HRP · risk parity.

**Why deferred:** these techniques require reliable covariance estimates.
Crypto correlations are unstable and regime-dependent, and the system has no
track record yet. Applying them prematurely produces confident allocations
resting on unstable inputs. Revisit at Phase 9.

---

## 7. Decision summary

| Project | Domain | Decision | Phase |
|---|---|---|---|
| Palisade | Security | INTEGRATE / ADAPT candidate | 1 |
| VerumTrade | Research architecture | ADAPT ARCHITECTURE | 4 |
| openportfolio | Thesis memory | CONCEPTUAL REFERENCE | 5 |
| analystOS | Research tooling | SELECTIVE ADAPTATION | 3–6 |
| Orbiter | Optimisation | DEFERRED | 9 |

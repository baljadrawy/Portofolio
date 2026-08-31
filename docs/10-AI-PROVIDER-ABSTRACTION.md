# AI Provider Abstraction and Structured Output

> 🟡 **CORE (minimum) / POST-LAUNCH (advanced)** — pre-launch needs only the minimum
> provider abstraction and structured, validated output. Multi-provider routing, fallback
> chains and cost-based model selection are POST-LAUNCH unless an operational reason forces
> them earlier. The rule `Evidence → AI interpretation` is unconditional.
>
> **Status:** Architecture contract. Phase 4.

---

## 1. No vendor lock-in

```
AIProvider  (interface)
      ├── OpenAIProvider
      ├── AnthropicProvider
      └── FutureProvider
```

No module imports a vendor SDK directly. All model access goes through the
interface. Swapping or adding a provider must not touch a single research module.

---

## 2. Required call metadata

Every model call records:

```
ai_call
├── call_id
├── analysis_id
├── module_id
│
├── provider
├── model                  exact model identifier
│
├── tokens_input
├── tokens_output
├── estimated_cost
├── latency_ms
│
├── status                 OK | TIMEOUT | RATE_LIMITED | VALIDATION_FAILED | ERROR
├── retry_count
└── created_at
```

Cost and latency per module are operational requirements, not nice-to-haves: a
single asset analysis fans out across sixteen modules, and without per-module
attribution an expensive analysis cannot be diagnosed.

`model` must be the **exact** identifier. "GPT" or "Claude" is insufficient —
model revisions change behaviour, and reproducibility depends on knowing which
one ran.

---

## 3. Operational controls

| Control | Requirement |
|---|---|
| Timeout | Per-call, enforced. A hung module must not stall an analysis. |
| Retry | Bounded, exponential backoff, only on transient failures |
| Rate limit | Per provider, respected proactively |
| Cost control | Per-analysis and per-period ceilings; exceeding halts, does not silently degrade |
| Circuit breaker | Repeated provider failure disables it and falls back |
| Degradation | Provider unavailable → module returns `INSUFFICIENT_EVIDENCE`, never a fabricated result |

---

## 4. Secrets

```
All AI provider credentials are SERVER-SIDE ONLY.
```

- Never in client bundles
- Never in API responses
- Never in logs (including error paths and stack traces)
- Never committed to Git

This mirrors the existing codebase's stance — `server/routes.ts` already refuses
to persist exchange API keys, which is the correct instinct and should be
extended, not diluted.

---

## 5. Structured output — mandatory

```
❌  Free-form text used as internal data
✅  JSON, schema-validated, then rendered to text for humans
```

The project already uses **Zod** (`drizzle-zod`, `zod` 3.24). AI output
validation uses the same library — no new dependency, and schemas can be shared
between DB and AI layers.

### Reference shape

```json
{
  "assetId": "...",
  "score": 82,
  "confidence": 86,
  "decision": "HOLD",
  "thesisStatus": "HEALTHY",
  "trend": "IMPROVING",
  "topRisks": [],
  "topCatalysts": [],
  "invalidators": [],
  "evidenceRefs": []
}
```

### Validation rules

| # | Rule |
|---|---|
| V-1 | Output failing schema validation is **rejected**, not repaired by hand |
| V-2 | Rejection triggers bounded retry, then `INSUFFICIENT_EVIDENCE` |
| V-3 | `decision` must be a member of the locked enum |
| V-4 | `evidenceRefs` must reference **existing** evidence rows — dangling references fail validation |
| V-5 | Numeric ranges enforced (score 0–100, confidence 0–100) |

**V-4 is the technical enforcement of the constitutional rule.** A model that
invents an evidence id fails validation. This is how "LLM interprets evidence,
does not manufacture evidence" becomes mechanically enforced rather than merely
requested in a prompt.

---

## 6. Human text is generated *from* structure

```
structured result  →  narrative report
```

Never the reverse. Prose is a rendering of validated data, so a report cannot
contain a claim that is absent from the structured output.

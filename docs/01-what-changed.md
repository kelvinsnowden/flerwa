# 01 — What Changed, and What Survives

## The two companies, side by side

| | **OLD — Creator Collaboration Marketplace** | **NEW — Trusted Services Marketplace** |
|---|---|---|
| Demand side | Brands with marketing budgets | People and businesses with things that need doing |
| Supply side | Creators | Anyone who can be verified and held accountable |
| Unit of value | A campaign | **A completed, protected transaction** |
| Trigger | "We need content" | "I need someone I can trust" |
| Ceiling | **[FACT]** ~$2–3M measured Kenyan influencer market | Bounded by category selection, not by a single ad budget |
| Moat claim | The settlement ledger | Operational trust capability, per vertical, compounding |
| Failure mode | Market too small | **Spreading too thin before reaching liquidity anywhere** |

**[REC] The most important line in that table is the last one.** You have traded a *size* risk for an *execution* risk. That is a reasonable trade — size risk is fatal and unfixable, execution risk is manageable — but only if you actually manage it. The way you manage it is by refusing to launch horizontally.

---

## What survives from the original blueprint

More than you might expect. Roughly 70% of the previous work transfers intact, because it was about *transacting safely between strangers*, not about creators.

| Concept | Status | Change required |
|---|---|---|
| Escrow funded before work begins | ✅ Survives | None |
| **5-day auto-approve protecting the provider** | ✅ Survives — now more important | None |
| Two-sided reputation | ✅ Survives | Split into portable Reliability + per-category Competence |
| Storefronts with published prices | ✅ Survives, generalised | `@creator` → `@provider` |
| **Deal Desk** (bring your own customer) | ✅ Survives — now the primary cold-start weapon | Generalised to all providers |
| Append-only event log + double-entry ledger | ✅ Survives | None — becomes more valuable |
| Descending repeat fees | ✅ Survives | Rebalanced; see `08` |
| Structured briefs preventing disputes | ✅ Survives | Becomes structured *job specs* |
| Watermark gate (asset released on settlement) | ✅ Survives, narrowed | Applies to digital deliverables only |
| Aggregator-first payment architecture | ✅ Survives | None |
| Provider keeps 100%, buyer pays the fee | ⚠️ **Revised** | Does not survive contact with low-AOV or quote-based work — see `10` |
| Campaign-in-a-Box | ✅ Survives, generalised | Becomes productised outcomes across verticals |
| AI matching deferred until data exists | ✅ Survives | None |
| **"The ledger is the moat"** | ⚠️ **Downgraded** | Reframed as consequence, not strategy — see `00 §7` |
| Kenya influencer market sizing | 📦 Archived | Now scopes one vertical, not the company |
| Creator tiers, audience authenticity, Spark Ads | 📦 Archived to vertical | Still correct *for creators*; irrelevant to fundis |

**[REC] The single biggest conceptual change:** the previous blueprint's core primitive was a `Collaboration` with ten campaign-type presets. The new primitive is a **`ServiceTransaction`** with pricing-model and fulfilment-mode variants. A creator campaign becomes one shape of it. Detail in `04-transaction-primitive.md`.

---

## What is genuinely new

1. **Physical-world risk.** The old marketplace's worst outcome was a bad video. The new one dispatches people to addresses, sometimes on behalf of someone who is not there. Safety and agency risk become first-class product concerns, not a policy page. (`06`)
2. **Non-digital supply.** Creators are digitally native by definition. Fundis and inspectors are not uniformly so. Onboarding, briefing and proof capture must work for someone with a mid-range Android phone on patchy data.
3. **Quote-based and variable-scope work.** A UGC video has a price. "Paint my apartment" does not until someone looks at it. The transaction primitive must support quoting, revision of scope, and — critically — **materials money**, which is the largest single trust failure in Kenyan fundi work.
4. **Reputation no longer transfers cleanly.** (`00 §8`)
5. **Regulatory surface widens** — domestic work classification, property representation, regulated professions. (`14`)

---

## The strategic sentence

> **Old:** Brands need creators.
> **New:** People need things done, and cannot tell who to trust.
> **Ours:** We are the verified stranger — starting with the customers for whom trust is worth the most, not the ones for whom it is cheapest to serve.

That last clause is the whole revision. Your brief instinctively reached for the highest-*frequency* categories. The economics in `00 §3` say to reach for the highest-*trust-deficit* categories instead, because that is where the fee is defensible and the leakage is lowest.

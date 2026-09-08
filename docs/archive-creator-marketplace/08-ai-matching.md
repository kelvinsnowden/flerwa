# Parts 10 & 11 — AI Matching and the Campaign Builder

## The honest framing first

**[REC] AI matching is not a moat, and you should stop thinking of it as your biggest differentiator.**

Three reasons:
1. With 500 creators, a good filter beats a mediocre model. Matching only becomes hard above ~5,000 creators, which is 12+ months away.
2. **[FACT]** AIfluence has been marketing AI-driven matching in this exact market since 2020. The claim is not novel here.
3. LLM capability is a commodity every competitor can buy. What is *not* commoditised is **your proprietary outcome data** — which creator actually delivered on time, whose video actually converted, which pairings produced repeat bookings.

**[REC] The defensible asset is the feedback loop, not the algorithm.** Ship deterministic matching first, instrument outcomes obsessively, and let the model become good because your data is good. Say this out loud to investors: *"Our matching gets better because we settle the payments and therefore see the outcomes. A discovery tool never learns whether its recommendation worked."*

---

## Part 10 — The matching algorithm

### Three-stage architecture

```
Stage 1  ELIGIBILITY (hard filters — SQL, milliseconds)
         Reduce 10,000 → ~300
Stage 2  SCORING (weighted feature model — deterministic, explainable)
         Rank 300 → top 50
Stage 3  PORTFOLIO OPTIMISATION (constrained selection)
         Select the best SET of N, not the best N individuals
```

**[REC] Stage 3 is the part everyone skips and it is where the real value is.** A brand asking for 20 creators does not want the 20 highest-scoring individuals — they want a *portfolio*: geographic spread, tier mix, audience diversity, no overlapping followings, within budget. Optimising the set rather than the members is a genuinely differentiated capability and it is classical optimisation, not machine learning.

### Stage 1 — Eligibility (non-negotiable filters)

```sql
active_within_days <= 14
AND accepting_work = true
AND capacity_remaining > 0
AND creator_type IN (:required_types)
AND rate_for_service <= :max_per_creator
AND NOT category_excluded(:brand_category)     -- creator's own boundaries
AND (NOT requires_location OR ward IN :target_wards)
AND (NOT requires_min_followers OR followers >= :min)
AND account_standing = 'good'
AND NOT worked_with_competitor_within(:exclusivity_days)
```

**[REC] `active_within_days <= 14` is the most important line here.** The classic marketplace failure is recommending inactive supply. A perfect match who never opens the app is worse than a mediocre match who replies in an hour — it burns the brand's first impression, which you only get once.

### Stage 2 — Scoring

```
MatchScore = 0.25 · ContentFit
           + 0.20 · AudienceFit
           + 0.15 · Reliability
           + 0.15 · QualityScore
           + 0.10 · PriceFit
           + 0.08 · GeoFit
           + 0.07 · PerformanceHistory
```

| Feature | Computation | Notes |
|---|---|---|
| **ContentFit** | Cosine similarity between campaign brief embedding and creator's portfolio + past-brief embeddings | The one place an LLM genuinely earns its place |
| **AudienceFit** | Overlap of creator audience demographics with target; **falls back to a category prior when API data is unavailable — and is labelled as an estimate** | **[FACT]** TikTok returns no audience demographic breakdown via API; Instagram returns it only for the authenticated owner — so this feature is often unavailable and must degrade honestly |
| **Reliability** | From the CRS reliability component | |
| **QualityScore** | From the CRS quality component | |
| **PriceFit** | Gaussian around budget-per-creator; penalise both far-over and suspiciously-under | Suspiciously cheap correlates with poor delivery |
| **GeoFit** | Distance decay from target ward; step penalty across Nairobi's traffic corridors | **[REC]** Model travel *time*, not straight-line distance — Nairobi traffic makes 8km unbookable |
| **PerformanceHistory** | Actual/predicted views on past campaigns; conversion rate where tracked | Requires ≥3 completed campaigns; else neutral prior |

**[REC] Two non-obvious weighting decisions:**
- **ContentFit outweighs AudienceFit (0.25 vs 0.20).** This encodes "creators, not influencers" in the ranking layer, where it actually takes effect. Marketing copy does not change behaviour; weights do.
- **Add an explicit exploration term.** Reserve ~15% of recommendation slots for high-uncertainty creators (few completed jobs, high early signal). Without it, the top 200 creators get all the work, the long tail churns, and supply collapses into an oligopoly. This is a **marketplace-health decision that costs short-term match quality and must be defended against the instinct to maximise it away.**

### Stage 3 — Portfolio optimisation

```
maximise   Σ MatchScore(c) + λ · Diversity(S)
subject to Σ rate(c) ≤ budget
           |S| = N
           geographic_spread(S) ≥ min_wards
           tier_mix(S) ≈ target_mix
           audience_overlap(S) ≤ max_overlap
```

Greedy with diversity penalty is entirely sufficient — do not over-engineer this. **[REC] `audience_overlap` matters more than it seems**: 15 creators with the same 40,000 followers is one campaign reaching 40,000 people, not 600,000, and a brand that discovers this after the fact does not come back.

### Explainability is a feature, not a nicety

**[REC] Every recommendation ships with its reason.** Not because it is nice, but because a Kenyan SME will not spend KSh 50,000 on a black box, and because it teaches the brand what to ask for next time.

> **Amina W. — 94% match**
> ✅ 12 food campaigns completed · ✅ 78% audience in Nairobi
> ✅ Based in Westlands (venue: 2km) · ✅ 96% on-time across 34 jobs
> ⚠️ Rate KSh 7,500 is 15% above your per-creator budget

---

## Part 11 — The AI campaign builder

### What it actually is

**[REC] Be precise internally: this is a *structured-extraction and estimation* system, not a creative AI.** The LLM's job is to turn messy natural language into a valid `CollaborationSpec`. Every number it produces must come from **your database**, never from the model. An LLM that hallucinates a KSh 8,000 rate for a category where the real median is KSh 3,500 destroys trust on first use and is worse than no feature at all.

```
Natural language
    ↓ LLM: structured extraction (typed JSON, schema-validated)
CampaignIntent { objective, category, location, count, timing, budget, deliverables }
    ↓ Deterministic: query real marketplace data
Pricing (from actual completed collaborations) + Supply check (real availability)
    ↓ LLM: brief generation from a template + retrieved similar briefs
Editable draft campaign
```

### Worked example — your restaurant case

**Input:** *"I own a new restaurant in Westlands and want 15 creators to visit next weekend."*

**Extraction:**
```json
{
  "objective": "foot_traffic",
  "campaign_type": "location_visit",
  "venue": {"area": "Westlands", "county": "Nairobi"},
  "creator_count": 15,
  "timing": {"window": "next_weekend", "resolved": "2026-09-12..2026-09-14"},
  "category_inferred": "food_beverage",
  "budget": null,
  "confidence": {"count": 0.95, "timing": 0.80, "budget": 0.0}
}
```

**Deterministic enrichment — every number sourced:**
- Pricing: median completed `location_visit` rate, `food_beverage`, Nairobi, last 90 days, by tier
- Supply: count of eligible creators actually available in that window within reach of Westlands
- Reach: median actual views for those creators on comparable past campaigns

**Generated draft:**

```
📍 Westlands Restaurant Visit Campaign
Objective        Foot traffic + local awareness
Creators         15 (5 nano · 7 micro · 3 mid-tier)
Geography        Westlands, Parklands, Kilimani, Lavington
Deliverables     1 TikTok + 3 Instagram Stories per creator
Window           Fri 12 – Sun 14 Sep · 5 slots per evening
Per creator      KSh 4,000 (nano) / 6,500 (micro) / 12,000 (mid)
Consumption      KSh 2,500 allowance each (+1 guest)
─────────────────────────────────────────────────────────
Creator fees                    KSh 108,500
Consumption (15 × 2,500)        KSh  37,500   ← your cost, not ours
Platform fee (15%)              KSh  16,275
TOTAL PLATFORM SPEND            KSh 124,775

Estimated reach       380,000–520,000    ⓘ from these creators' actual results
Estimated content     15 TikToks + 45 Stories
Supply check          ✅ 34 eligible creators available that weekend

[Edit] [Generate brief] [Publish campaign]
```

**[REC] Six design rules for this feature:**

1. **Never invent a price.** Every figure traces to completed transactions. If you lack data for a segment, say *"we don't have enough data on this yet — here's a range from adjacent categories"* and let the brand set it.
2. **Always run the supply check before showing a plan.** Promising 15 creators when 6 are available is the fastest way to lose a brand permanently. If supply is short, say so and offer alternatives (widen geography, extend the window, adjust the mix).
3. **Show confidence honestly.** Low-confidence extractions become questions, not assumptions. *"You said 'next weekend' — do you mean 12–14 September?"*
4. **Always editable.** The AI produces a draft, never a commitment. Every field is a form input.
5. **Separate platform spend from brand-borne cost.** The KSh 37,500 consumption allowance is the restaurant's own cost, not GMV, and conflating them misleads the brand and inflates your metrics.
6. **Reach estimates come from these creators' actual past results**, not from follower-count formulas. Label the source in the UI.

### Auto-generated briefs

**[REC] Template-driven with LLM infill, never free generation.** The template guarantees the legally and operationally required fields are present:

```
CAMPAIGN: [name]
BRAND: [brand] — [one-line description]
OBJECTIVE: [objective]

WHAT WE NEED
[deliverables, explicit counts and formats]

MUST INCLUDE
- Tag @[handle]
- [required disclosure — SYSTEM-INSERTED, NOT EDITABLE]
- [hashtags]

MUST AVOID
[brand-safety exclusions]

CREATIVE DIRECTION
[LLM-generated from brand inputs + high-performing similar briefs]

LOGISTICS
[address / delivery / booking / contact]

DEADLINE / RIGHTS / PAYMENT
[dates] / [rights summary in plain language] / [amount, escrow status, release terms]
```

**[REC] The disclosure line must be system-inserted and non-editable.** **[FACT]** Kenya's advertising framework — the Advertising Standards Board of Kenya under the Marketing Society of Kenya, alongside the Communications Authority and Competition Authority — expects promotional content to be identifiable as advertising, and undisclosed advertising risks breaching consumer-protection provisions. Making disclosure a system-controlled field (with Swahili options such as *"Imefadhiliwa na [Brand]"*) removes it from negotiation, protects the creator, protects the brand, and is a genuine compliance selling point. See `13-legal-compliance.md`.

### What the model must never decide

**[REC]** Hard boundary — put it in the engineering guidelines:

| LLM decides | Deterministic code decides |
|---|---|
| Parsing intent from text | **Prices** |
| Drafting creative direction | **Match scores and rankings** |
| Summarising and rephrasing | **Supply availability** |
| Suggesting content ideas | **Payment amounts and splits** |
| Categorising and tagging | **Reputation scores** |
| | **Dispute outcomes** |
| | **Disclosure requirements** |

Anything touching money, ranking, or reputation is deterministic, auditable, and testable. This is not a stylistic preference — it is what makes the system defensible when a creator asks why they were not selected, or a regulator asks how a payment was calculated.

### Build sequence

| Version | Capability |
|---|---|
| **V1** | No AI. Filters + rules + a hand-tuned scoring function. Instrument everything. |
| **V2** | LLM brief parsing → structured campaign; deterministic pricing from real data; explainable ranking |
| **V3** | Learned ranking trained on completed-collaboration outcomes; portfolio optimisation; predicted-performance model |
| **V4** | Full conversational builder; automated campaign optimisation mid-flight; budget reallocation |

**[REC] The V1 line is a discipline, not a limitation.** The hand-tuned function generates the labelled data the learned model needs. Skipping to V3 without outcome data produces a model trained on nothing, which is how "AI matching" becomes a marketing claim rather than a capability.

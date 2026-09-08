# Parts 23, 24, 44, 45 — Analytics and Metrics

## Part 23 — Brand analytics

**[REC] The design constraint that matters: your buyer is a restaurant owner, not a media planner.** A dashboard with CPM, CPE and ROAS above the fold will be ignored. Structure it in three layers and default to the first.

### Layer 1 — "Did it work?" (default view)

```
Westlands Launch Campaign · Completed
─────────────────────────────────────────
KSh 124,775 spent      15 creators hired
60 pieces of content   487,000 views
─────────────────────────────────────────
KSh 2.08 per person reached
62 people used your code WEST20
KSh 43,400 in tracked sales      3.5x return
─────────────────────────────────────────
Best performer: Amina W. — 89,000 views, 21 code uses
[Rebook top 5 creators]   [Download all content]
```

**[REC] Three deliberate choices:** money-first metrics, plain language ("people reached", not "impressions"), and **the rebook button in the primary view** — repeat purchase is your most important business outcome, so put the action where the satisfaction is.

### Layer 2 — Performance detail

Spend and budget remaining · creators hired/delivered/pending · content delivered by format · views, reach, engagement, ER% · **CPM, CPV, CPE** · clicks, code redemptions, leads, conversions, revenue, **ROAS, CPA** · content approval rate · average revisions · on-time delivery rate.

### Layer 3 — Diagnostics

Per-creator performance table (sortable by views, engagement, conversions, cost-efficiency) · best/worst content with thumbnails · campaign-over-campaign comparison · creator-cohort performance (nano vs micro vs mid — **[REC] this is the analysis that will repeatedly show nano outperforming on cost-efficiency, and it is how you sell the "creators not influencers" thesis with evidence rather than assertion**) · content-type performance · time-of-post analysis · geographic breakdown.

### Formulas

```
CPM   = spend / (impressions/1000)
CPV   = spend / views
CPE   = spend / (likes + comments + shares + saves)
CPA   = spend / conversions
ROAS  = tracked_revenue / spend
ER    = engagements / reach          (prefer reach; fall back to followers, label it)
Cost-efficiency index = creator_CPV / campaign_median_CPV
```

**[REC] Be explicit about attribution limits in the UI.** Where a promo code is the only signal, say *"62 tracked redemptions — offline sales not included."* Overstating attribution is the fastest way to lose a sophisticated buyer, and the fastest way to look dishonest to an unsophisticated one when the numbers do not match their till.

---

## Part 24 — Creator analytics

**[REC] Creators are motivated by money and by getting more work.** Lead with earnings; make everything else an instrument for winning the next job.

```
YOUR EARNINGS
This month  KSh 34,500      ↑ 22% vs last month
Pending     KSh 12,000      (2 jobs awaiting approval)
Lifetime    KSh 287,000     across 41 jobs
Next payout KSh 7,500 → 0712*** on approval

YOUR PERFORMANCE
⭐ 4.8 (34 reviews)   96% on-time   88% first-pass approval
11 repeat brands      Avg project KSh 8,400

WINNING WORK
Profile views     412 this month
Applications      23 sent · 9 hired · 39% success rate
                  ⓘ Platform average is 24% — you're doing well
Response time     2.1h  ⓘ Creators who reply in <1h get 2x more hires

YOUR CONTENT
Avg views per post  41,200      Best: 187,000 (Nairobi Grill)
Views delivered to brands: 1.4M lifetime
```

**[REC] Four design decisions:**
1. **Benchmark against the platform, not in isolation.** "39% vs a 24% average" is actionable; "39%" alone is not.
2. **Surface the causal levers.** "Creators who reply in under an hour get 2x more hires" changes behaviour in a way that a raw response-time number does not.
3. **"Views delivered to brands" is a portfolio asset.** It is the number a creator quotes when negotiating, and giving it to them makes your profile their CV.
4. **Never show a creator their internal reputation score.** Show the components. A composite invites gaming and demoralises without informing.

---

## Part 44 — Marketplace metrics and formulas

### Core

| Metric | Formula | Notes |
|---|---|---|
| **GMV** | Σ creator_amount of collaborations reaching `SETTLED` | **[REC] Recognise at settlement, not at funding.** Funded-but-unsettled is not GMV. |
| Take rate | platform_revenue / GMV | Blended across fee types |
| Revenue | Σ platform fees + subscriptions + services | |
| Net revenue | Revenue − payment costs − refunds | The number that matters |
| AOV | GMV / completed collaborations | **The company's primary commercial metric** |

### Supply and demand health

| Metric | Formula |
|---|---|
| Active creators | Distinct creators with ≥1 application or delivery in 30d |
| **Earning creators** | Distinct creators with ≥1 settled collaboration in 30d |
| Creator activation | Creators with ≥1 settled collab / creators registered |
| **Time to first earning** | Median days, registration → first settlement |
| Active brands | Distinct brands with ≥1 campaign or order in 30d |
| **Paying brands** | Distinct brands with ≥1 funded collaboration in 30d |
| Brand activation | Brands with ≥1 funded collab / brands registered |
| Time to first hire | Median days, registration → first funded collaboration |

**[REC] Track *earning* creators, not registered creators.** Registered creators is a vanity number that will be 10–20x the real one and will mislead you and your investors about supply health.

### Funnel conversion

```
Campaign fill rate     = slots filled / slots posted
Applications/campaign  = applications / campaigns posted     (target 8–25)
Application→hire       = accepted / applications             (target 15–30%)
Hire→completion        = settled / accepted                  (target >85%)
Completion→repeat      = brands rebooking in 60d / brands completing
```

**[REC] Applications per campaign is your liquidity thermometer.** Below 5, brands see thin choice and leave. Above 40, creators waste effort and churn. Both extremes are failures; monitor the distribution, not the average, because one viral campaign with 300 applications hides fifty campaigns with two.

### Retention

```
Creator retention (M3) = creators earning in M0 AND M3 / creators earning in M0
Brand retention (M3)   = brands purchasing in M0 AND M3 / brands purchasing in M0
Repeat rate            = brands with ≥2 collaborations / brands with ≥1
Repeat GMV %           = GMV from repeat brands / total GMV
NRR                    = (GMV from M0 cohort in M12) / (their M0 GMV)
```

**[REC] Repeat GMV % is the single best predictor of whether this company works.** Below 40% by month 12 means you are running an acquisition treadmill, and acquisition treadmills in a market this size do not reach scale.

### Health, risk and efficiency

```
Marketplace liquidity  = collaborations settled / (campaigns posted + storefronts active)
Supply utilisation     = earning creators / active creators
Dispute rate           = disputes opened / collaborations funded        (target <3%)
Refund rate            = KSh refunded / KSh funded                      (target <5%)
Auto-approve rate      = collabs approved by timeout / approved         (watch: brand disengagement)
Median time to payout  = median(settled_at − approved_at)               (target <60 min)
Cost to serve          = (ops + support + payment costs) / completed collaborations
CAC (per side)         = S&M spend attributable / new activated users
LTV (brand)            = AOV × collabs/year × years × contribution margin
LTV:CAC                = target >3.0 by month 18
```

**[REC] "Cost to serve per completed collaboration" is the metric most founders omit and most investors ask about.** It must fall every quarter. If it does not, the Scenario 3 economics in `04-economics-and-pricing.md` never arrive.

---

## Part 45 — The North Star Metric

### The candidates, honestly assessed

| Candidate | Case for | Fatal flaw |
|---|---|---|
| **GMV** | Investor-legible; direct revenue link | **Gameable by chasing a few large deals; says nothing about health.** A single KSh 2M enterprise campaign can hide a dead marketplace. |
| Creator earnings | Mission-aligned; drives supply | Identical to GMV; adds nothing |
| Successful matches | Measures the core function | An accepted match that fails is not value |
| Repeat collaborations | The truest quality signal | Lags too far; unusable as a weekly operating metric |
| **Completed collaborations/month** | Counts the actual unit of value; requires both sides to succeed | Ignores value — 1,000 × KSh 500 ≠ 1,000 × KSh 20,000 |

### The recommendation

> ## **North Star: Completed Collaborations per Month**
> ### *— governed by two guardrails: Average Order Value and Repeat Rate.*

**Definition:** collaborations reaching `SETTLED` — deliverable approved, creator paid — in a calendar month.

**Why this one:**

1. **It cannot be reached without both sides succeeding.** A brand had a need, a creator delivered, the brand approved, money moved. Every failure mode in the business reduces this number. That is exactly what a North Star should do.
2. **It is a count, so it resists distortion by outliers** in a way GMV cannot. Ten thousand small successful collaborations is a healthier marketplace than five large ones, and this metric says so.
3. **It is legible to everyone.** An engineer, an ops associate, and a creator all understand "collaborations completed." GMV means nothing to the person answering support tickets.
4. **It composes cleanly:** `Completed Collaborations = Active Brands × Collaborations per Brand × Completion Rate` — and every team owns one of those terms.

**Why the guardrails are mandatory:** optimising the count alone drives you toward high-volume, low-value work, which per `04-economics-and-pricing.md` is precisely the shape that cannot pay for itself. So:

- **Guardrail 1 — AOV must not fall.** Report it beside the North Star, always, on the same line.
- **Guardrail 2 — Repeat rate must rise.** Growth from new brands only is a treadmill.

**[REC] The one-line board metric:**

> **"N collaborations completed this month, at KSh X average, Y% from repeat brands."**

Any one of those numbers moving in isolation is a warning. All three moving together is the company working.

### Stage-appropriate targets

**[ASSUMPTION]** These are my recommended targets, not forecasts.

| Stage | Completed collabs/mo | AOV | Repeat % | Implied GMV |
|---|---|---|---|---|
| V0 (manual, mo 1–3) | 50 | KSh 8,000 | 20% | KSh 400k |
| V1 (mo 4–9) | 300 | KSh 12,000 | 35% | KSh 3.6M |
| V2 (mo 10–18) | 1,500 | KSh 18,000 | 45% | KSh 27M |
| V3 (mo 19–30) | 5,000 | KSh 25,000 | 55% | KSh 125M |

Note the AOV column doing the heavy lifting: collaborations grow 100x from V0 to V3, GMV grows 312x. **That gap is where the business becomes viable**, and it is a product and commercial choice, not an emergent property.

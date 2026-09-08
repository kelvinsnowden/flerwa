# Parts 6, 13, 26, 35 — Trust, Reputation, Disputes, Fraud

## The framing correction

You wrote: *"The biggest problem is not discovery. It is TRUST."* Correct — but trust is not one problem. It is **four different problems with four different solutions**, and platforms fail by building a rating system and calling it done.

| Question | Solved by | Not solved by |
|---|---|---|
| "Is this creator real?" | Identity + social verification | Ratings |
| "Will they deliver?" | Reliability history + escrow | Follower count |
| "Will the work be good?" | Portfolio + quality score | Reliability score |
| **"Will I actually get paid?"** | **Escrow + auto-release + payout speed** | **Anything else** |

**[REC]** The fourth is the one that decides whether creators join, and it is solved by **payment architecture, not reputation design**. Escrow-funded-before-work plus five-day auto-release plus sub-hour M-Pesa payout does more for trust than any scoring system you could build. Build that first; the score is a refinement.

---

## Part 6 — The Creator Reputation Score

### Principle: one number for ranking, five for humans

**[REC]** Compute a single internal score for ranking and matching, but **never show the composite to users**. Show the five components. A creator who sees "72/100" learns nothing and feels judged; a creator who sees "On-time: 94% · Approval: 88% · Quality: 4.6" knows exactly what to fix. Composites also invite gaming in ways components do not, because the target is ambiguous.

### The five components

```
CRS = 0.30·Reliability
    + 0.25·Quality
    + 0.20·BrandSatisfaction
    + 0.15·AudienceAuthenticity
    + 0.10·Performance
```

**Reliability (30%)** — the heaviest weight, deliberately. It is the most objective and the most predictive of a bad experience.
```
on_time_rate            0.40   delivered before deadline
completion_rate         0.35   accepted → completed
response_time           0.15   median first response to a brief
cancellation_rate       0.10   inverted; creator-initiated only
```

**Content Quality (25%)** — decoupled from audience entirely. This is what makes a 2,000-follower videographer rank above a 100,000-follower poster.
```
brand_quality_ratings   0.45   1–5, per completed job
revision_rate           0.20   inverted — fewer revisions = better briefs met
first_pass_approval     0.20   approved without revision
portfolio_assessment    0.15   human/model review at onboarding, decays over time
```

**Brand Satisfaction (20%)**
```
average_rating          0.40
repeat_booking_rate     0.35   ← the strongest signal in the entire system
would_recommend         0.15
dispute_rate            0.10   inverted
```

**Audience Authenticity (15%)** — weighted *down* on purpose, and set to zero for UGC-only creators.
```
follower_growth_pattern 0.30   organic curve vs step-jumps
engagement_consistency  0.25   variance across recent posts
audience_geography      0.25   Kenyan audience for Kenyan brands
comment_authenticity    0.20   text diversity vs emoji-bot patterns
```

**Performance (10%)** — only for creators with sufficient completed campaigns.
```
views_vs_predicted      0.40   actual/expected given follower count
engagement_vs_category  0.30
conversion_rate         0.30   where trackable
```

### Design rules that make it survive contact with reality

**[REC]**

1. **Cold start with a neutral prior, not zero.** New creators enter at the category median with wide uncertainty, not at the bottom. Otherwise no new creator ever gets a first job and supply calcifies. Use a Bayesian shrinkage: `score = (prior·k + observed·n)/(k+n)` with `k ≈ 5`. This also makes early scores hard to game — five perfect jobs do not produce a perfect score.
2. **Confidence intervals, not point estimates.** A creator with 3 jobs and 5.0 stars must not outrank one with 60 jobs and 4.7. Rank by the **lower bound** of the confidence interval (Wilson score), which is the standard, correct answer to this problem.
3. **Recency decay.** 180-day half-life. Reputation must be losable and recoverable.
4. **Separate scores by collaboration type.** Excellence at UGC says little about reliability at a 7am location visit. Maintain per-type reliability sub-scores once volume allows.
5. **Value-weight the ratings.** A 5-star on a KSh 50,000 job carries more weight than on a KSh 1,000 job.
6. **Never let follower count enter the score.** It enters *reach estimation*, which is a different thing and must be labelled as such.

### Anti-gaming

**[REC]** The attacks, in order of likelihood in this market:

| Attack | Defence |
|---|---|
| Fake brand account books own creator, leaves 5 stars | **Ratings only count from escrow-settled collaborations.** Gaming costs real money through the payment rail. This one control defeats most review fraud. |
| Circular rings — creators book each other | Graph analysis on brand↔creator bipartite structure; flag closed loops, shared devices, shared funding instruments, and brands whose only bookings are with one creator |
| Many tiny jobs to farm volume | Value-weighted ratings + diminishing returns per brand pair |
| Bought followers/engagement | Authenticity component + growth-curve anomaly detection; note this is only 15% of the score by design |
| Pressuring brands for 5 stars | **Double-blind reviews** — neither side sees the other's review until both submit or 14 days elapse. Add a private "would you rebook?" field never shown to the creator. |
| Abandoning a damaged account, re-registering | Identity + M-Pesa number binding; device fingerprinting; the same national ID cannot hold two creator accounts |
| Collusion with a friendly brand for a fake track record | Repeat-booking weight caps per brand pair; require breadth of distinct brands for tier progression |

**[REC] The single strongest structural defence: reputation is only earned through settled money.** Anchor every reputational event to an escrow transaction. It makes fraud expensive, traceable, and reversible.

---

## Part 26 — Brand reputation (do not skip this)

**[REC]** Most platforms rate creators only. That is a design choice that tells creators they are the product rather than the customer, and in a supply-constrained market it is a strategic error.

**Brand Trust Score, shown on every campaign listing:**

```
payment_reliability     0.30   funds escrow promptly, no failed funding
approval_speed          0.25   median hours from submission to decision
revision_reasonableness 0.20   avg revisions requested vs platform norm
cancellation_rate       0.15   inverted
creator_rating          0.10   1–5 from creators who worked with them
```

Displayed on the campaign card as facts, not a grade:

```
Nairobi Grill  ·  ⭐ 4.7 from 23 creators
✅ Pays on time (100%)      ⏱ Approves in ~6 hours
🔁 1.2 revisions average    ↩️ 4% cancellation rate
```

**[REC] This is a genuine differentiator and it costs almost nothing.** Creators currently have no way to know which Kenyan brands pay and which waste their time — that information exists only as gossip in WhatsApp groups. Making it structured and public is a real service and a strong reason for creators to choose you. It also disciplines brand behaviour: a brand that sees "you approve slower than 80% of brands" will speed up.

**[REC] Additional brand-side controls worth having:**
- **Auto-approve default** at 5 days protects creators structurally, not just reputationally.
- **Revision caps** enforced by the system, not by negotiation.
- **Escrow-before-visibility:** for location visits and events, do not release the venue address or booking details until funds are escrowed.

---

## Part 13 — The dispute system

### Principles

**[REC]**
1. **Most disputes are brief failures, not bad faith.** The brief template is your primary dispute-prevention tool — invest there first.
2. **Automate the majority.** Deadline breaches, non-delivery and non-response are objectively determinable from timestamps. Only genuine quality disagreements need a human.
3. **Speed beats perfection.** A dispute resolved in 48 hours at 80% fairness beats one resolved in three weeks at 95%. Both parties are small operators; time hurts them more than money.
4. **Escrow always splits; it never evaporates.** Every resolution assigns 100% of the held funds somewhere.
5. **Publish the rules in advance.** Predictability is most of perceived fairness.

### Structural prevention (before any dispute exists)

- **Structured briefs.** Required fields for deliverables, deadline, platforms, must-include, must-avoid, disclosure text, rights. Free-text-only briefs are the root cause of most quality disputes.
- **Revision limits, contractual and enforced.** Default **1 included**, maximum **2**; a third is a paid add-on. This directly answers *"the brand keeps requesting unlimited revisions."*
- **Revision scope rules.** A revision must reference a specific brief requirement that was not met. **"I changed my mind" is a new order, not a revision** — the system should say so, in those words, in the revision form.
- **Concept-approval milestone** on jobs over KSh 20,000, so misalignment surfaces before filming rather than after.

### The escalation ladder

```
L0  Self-serve      Revision request within the included allowance     0–24h
L1  Guided          Structured claim + evidence; counterparty 48h reply
L2  Auto-resolve    Objective rules decide (see table)                 instant
L3  Mediation       Platform proposes a split; both accept → binding   72h
L4  Adjudication    Trained ops decides using evidence rubric          5 days
L5  External        Only above KSh 200,000 — arbitration per T&Cs      —
```

**[REC] Target: 70% resolved at L0–L2, under 5% ever reaching L4.** If L4 volume exceeds ~5% of disputes, your briefs are broken, not your adjudicators.

### Auto-resolution rules (L2)

| Condition | Determination | Escrow |
|---|---|---|
| No submission 72h past deadline, no contact | Creator default | 100% → brand |
| Submitted on time; brand silent 5 days | Brand non-response | 100% → creator |
| Creator withdraws before starting | Creator cancellation | 100% → brand |
| Brand cancels post-acceptance, pre-work | Brand cancellation | 10% → creator, 90% → brand |
| Brand cancels after work started | Brand cancellation | 50/50 |
| Seeded product not delivered within SLA | No fault | 100% → brand, no creator penalty |
| Post deleted before minimum live duration | Creator breach | Clawback / refund |
| 3rd revision demanded, no new scope | Brand over-reach | Release to creator |

### Evidence standards (L3–L4)

| Claim | Creator must show | Brand must show |
|---|---|---|
| "Work done, brand won't pay" | Submitted files with platform timestamps; brief compliance mapping | Specific brief clauses unmet, with reference |
| "Creator ignored the brief" | Mapping of each requirement to the delivery | Annotated brief with cited failures |
| "Unlimited revisions" | Revision log with requested changes | Justification per revision tied to brief |
| "Posted late" | Publish timestamp; any agreed extension | Original agreed deadline |
| "Product never arrived" | **Nothing — burden is on the brand** | Dispatch and delivery proof |
| "Post was deleted" | Platform evidence or explanation | URL + monitoring record |

**[REC] Note the asymmetry on delivery.** The creator cannot prove a negative, and the brand controls dispatch. Placing the burden on the party that controls the evidence is both fairer and cheaper to adjudicate.

### Partial-payout matrix (L4)

| Outcome | Creator | Brand | Applies when |
|---|---|---|---|
| Full delivery | 100% | 0% | Brief met |
| Substantial | 75% | 25% | Minor deviations |
| Partial | 50% | 50% | Some deliverables met |
| Minimal | 25% | 75% | Attempted, largely non-compliant |
| Non-delivery | 0% | 100% | Nothing usable |

**[REC] Where the platform is at fault** — a bug, a payment failure, an ops error — **pay both sides in full from platform funds.** Budget for it. It is cheap insurance against the stories that spread fastest.

### Consequences

| Creator | Threshold | Action |
|---|---|---|
| Late delivery | 3 in 90 days | Ranking penalty, warning |
| Non-delivery | 1 | Warning + reliability hit |
| | 3 in 90 days | Suspension |
| Fraud (fake proof, stolen content) | 1 | Permanent ban, funds withheld pending review |

| Brand | Threshold | Action |
|---|---|---|
| Slow approval | median > 72h | Badge shown to creators |
| Cancellation rate | > 20% | Prepayment required, visibility reduced |
| Lost disputes | 3 in 90 days | Manual review, possible suspension |
| Non-funding after acceptance | 2 | Campaign posting suspended |

---

## Part 35 — Fraud

### Threat model, ranked by expected loss in *this* market

**[ASSUMPTION]** Ranking is my judgement for Kenya specifically, not a global ordering.

| # | Threat | Likelihood | Impact | Primary control |
|---|---|---|---|---|
| 1 | **Off-platform circumvention** | **Very high** | **Very high** | Value-based retention (below) |
| 2 | Fake proof of posting (edited screenshots) | High | Medium | URL + API verification, never screenshots alone |
| 3 | Content theft — submitting others' work | High | High | Perceptual hashing + reverse search |
| 4 | Fake followers / engagement | High | Medium | Authenticity scoring; low score weight |
| 5 | Creator takes payment, vanishes | Medium | High | Escrow (structurally solved) |
| 6 | Fake brand posts campaign, never funds | Medium | Medium | Escrow-before-visibility |
| 7 | Multiple creator accounts | Medium | Medium | ID + M-Pesa binding, device fingerprint |
| 8 | Review manipulation / collusion | Medium | High | Settled-transaction gating, graph analysis |
| 9 | Account takeover (SIM swap) | Medium | **High** | Payout cooling-off on detail change |
| 10 | Seeding fraud (keeps product, never posts) | Medium | Low | Delivery-linked obligations, reputation |
| 11 | Payment fraud / stolen instruments | Low-Med | High | Aggregator controls, velocity limits |
| 12 | Deepfaked or AI-generated "UGC" passed as real | **Rising** | Medium | Provenance requirements; see below |
| 13 | **Brand downloads the draft, then refuses to approve** | **High** | **High** | **Watermark gate — see below** |

### Controls that matter most

**1. Content theft — perceptual hashing.**
Hash every submitted asset (pHash for images, video fingerprinting for clips). Check against: everything ever submitted to the platform, the creator's own claimed portfolio, and reverse image search. **[REC]** This is high-value and cheap. Stolen-portfolio fraud is endemic in freelance marketplaces and will arrive with your first hundred creators.

**2. Proof of posting — never trust a screenshot.**
```
Tier 1  OAuth API verification            ← strongest, use where available
Tier 2  Public URL + platform scrape      ← verify content, handles, disclosure
Tier 3  Screenshot + URL                  ← fallback only, manual review
Tier 4  Screenshot only                   ← treat as unverified, never auto-release
```
**[FACT]** API verification has hard limits. **Instagram's Basic Display API was deprecated in December 2024**; all access now runs through the Graph API with app review, business/creator accounts only, and the `instagram_manage_insights` scope returns audience demographics **only for the authenticated account owner**. **TikTok does not return audience age, gender or geographic breakdown through direct API calls.** ([Phyllo](https://www.getphyllo.com/post/social-media-api-guide-on-top-apis-for-developers), [Elfsight](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/))

**[REC]** Consequence: **creator-authorised OAuth is the only path to trustworthy audience data**, and you must design onboarding to make connecting accounts feel worthwhile — a "Verified Audience" badge that visibly improves ranking. Do not promise brands audience demographics you cannot obtain.

**3. The watermark gate — brand-side content theft.**
**[REC] This closes a hole in the dispute design above.** As originally specified, a brand could receive a draft, download the file, refuse to approve, open a dispute, obtain a refund, and still hold the asset.

```
DRAFT_SUBMITTED  → watermarked, low-res STREAMING preview only. No download.
PAYMENT_RELEASED → clean master unlocked via a signed, expiring URL.
```

Standard practice in stock-media and design marketplaces. It makes download-then-dispute pointless and gives the rights system real teeth: **the master is gated on settlement, not on approval.** Implementation detail in `10-technical-architecture.md`.

**4. Account takeover and SIM swap.**
Kenya's dependence on phone-number identity makes SIM swap a live risk. **[REC]**
- Changing the payout number triggers a **24-hour hold plus re-verification** — no exceptions
- Any payout to a newly changed number is manually reviewed above a threshold
- Alert to email and the old number on any change
- Device fingerprint change + payout detail change + immediate withdrawal = automatic freeze

**5. AI-generated content passed off as authentic UGC.**
**[ASSUMPTION]** This is a fast-growing problem that most platform designs still ignore. A brand paying for a real person's authentic testimonial is buying authenticity, and synthetic content defrauds them of exactly what they paid for. **[REC]** Require an explicit `content_provenance` declaration on every UGC submission (`filmed_by_creator` / `ai_assisted_editing` / `ai_generated`), make misdeclaration a permanent-ban offence, and let brands filter on it. Handled well, this becomes a selling point: *"real people, verifiably."*

### The circumvention problem — the honest analysis

**[REC] You cannot prevent disintermediation in Kenya. Both parties already have WhatsApp and M-Pesa. Any control you build is a speed bump, and aggressive enforcement will simply be resented.**

Detection is still worth building — contact-pattern detection in messages, sudden conversation death after a first job, brands that view many profiles and book none, and a repeat-rate that is anomalously low for a given brand. But **detection without an answer is just surveillance.**

**[REC] The strategy is to make staying more valuable than leaving:**

| Off-platform | On-platform |
|---|---|
| Trust the brand to pay | Escrow, guaranteed |
| No recourse | Dispute resolution |
| No contract | Signed rights contract |
| Creator vanishes → you lose | Free replacement |
| No record | Verified earnings history → **advances, credit** |
| No tax paperwork | Withholding certificates, annual statements |
| Manual chasing | Automated workflow, reminders, proof |

And critically — **[REC] price the second transaction lower.** Repeat collaborations between the same pair should carry a reduced fee (15% → 10% → 8%). This directly attacks the moment disintermediation is most tempting: right after a successful first job. Upwork's descending fee schedule exists for exactly this reason.

**[REC] Then go further and make circumvention a product:** the **Deal Desk** (`12-gtm-liquidity-growth.md`) invites off-platform deals *onto* the platform at 5%. Rather than policing a behaviour you cannot stop, monetise it. This is the single best answer to threat #1 on the list, and it is a pricing decision, not an engineering one.

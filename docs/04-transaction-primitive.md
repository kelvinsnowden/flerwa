# 04 — The Service Transaction Primitive (Brief §10–14, §23, §38, §51)

## The abstraction

Your brief is right that the core object must not be `creator_campaign`. It is:

```
SERVICE_TRANSACTION
├── parties        customer ←→ provider           (either may be a business)
├── need           what outcome is being bought
├── scope          ScopeItem[]                    ← what "done" means, explicitly
├── pricing_model  fixed | quote | hourly | recurring | application
├── fulfilment     remote_digital | on_site | at_provider | representation
├── schedule       when, where, how long, recurrence rule
├── money          Escrow + Milestone[] + Disbursement[]
├── evidence       Evidence[]                     ← how completion is proven
└── outcome        Review[] + ReputationEvent[] + DisputeRecord?
```

Every job in every vertical is this object. A UGC video, a plumbing repair, a property inspection and a weekly office clean differ in **five enum values and the shape of `evidence`** — not in structure.

**[REC] The two fields that do the most work are `scope` and `evidence`, and they are the two most commonly under-designed.** Nearly every dispute in a services marketplace reduces to *"we disagreed about what was included"* or *"we disagreed about whether it was done."* Structure both and you prevent most disputes rather than adjudicating them.

---

## Pricing models — one primitive, five shapes

| Model | Example | Escrow behaviour | **[REC] Use for** |
|---|---|---|---|
| **Fixed** | "Property inspection — KSh 6,000" | Full amount at booking | **Default. Push everything here.** |
| **Quote** | "Paint my 3-bed apartment" | Escrow on quote acceptance | Variable-scope trade work |
| **Hourly** | "Assistant — KSh 800/hr" | Escrow an estimated cap; refund unused | Rare; needs verified time |
| **Recurring** | "Quarterly property check" | Escrow per occurrence, not upfront | Retention engine (`08`) |
| **Application** | "I need a TikTok creator for this brief" | Escrow on selection | Creator vertical; multi-provider jobs |

**[REC] Bias the catalogue hard toward Fixed.** **[FACT]** Lynk **abandoned its auction marketplace for a standardised service model** — that is the most expensive lesson available to you, already paid for. Quoting is slow, produces price anxiety, invites off-platform negotiation, and gives you no comparable price data. Every service you can convert from "get quotes" to "KSh X, this is what's included" increases conversion and reduces leakage.

**Fixed-price productisation is possible far further up the value chain than people assume:**

| Instead of | Sell |
|---|---|
| "Get quotes for a plumber" | **"Fix a leaking tap or pipe — KSh 3,500. Diagnosis + repair + parts up to KSh 800."** |
| "Get quotes for painting" | **"Paint a 1-bedroom — KSh 22,000, 2 days, paint included, 30-day workmanship guarantee."** |
| "House hunting" | **"Property inspection report — KSh 6,000. Photos, video walkthrough, 12-point checklist, verified within 48h."** |

---

## Fulfilment modes — this is what actually varies

| Mode | Who is present | Evidence of completion | Risk profile |
|---|---|---|---|
| `remote_digital` | Nobody | The file itself | Low — IP and quality |
| `on_site_customer_present` | Both | Customer confirms | Medium — safety, scope |
| `on_site_customer_absent` | Provider only | **Photo/video/checklist** | High — property, theft, honesty |
| `at_provider` | Customer travels | Customer confirms | Low |
| **`representation`** | **Provider acts for absent principal** | **Structured evidenced report** | **Highest — agency risk** |

**[REC] `representation` is a distinct mode and not a variant of `on_site`.** In every other mode the provider performs a task. In representation the provider **exercises judgement on someone else's behalf, at a distance, usually with money at stake.** It requires: a structured report format (not free text), tamper-evident evidence capture, an explicit conflict-of-interest declaration, and — for high-value matters — dual coverage. See `06`.

---

## The three buying experiences (Brief §8, §9)

### Model 1 — Book a service *(the default; ~70% of volume)*
Customer knows what they need → browses a productised catalogue or a storefront → sees fixed price and availability → books and pays → done. **[REC] Optimise for this relentlessly.** It is the only flow with no waiting, no negotiation and no drop-off between intent and payment.

### Model 2 — Post a task *(the fallback; ~25%)*
Customer describes a need → matched providers quote → customer selects on price, rating, history and availability.

**[REC] Constrain this hard, because it is the model Lynk abandoned:**
- **Cap quotes at 5.** More is noise and wastes provider effort.
- **Show a platform price guide** from real completed transactions, so the customer is not anchoring blind.
- **Quotes expire in 24 hours.**
- **Providers have a weekly quote quota** that grows with reputation — this is the anti-spam mechanism and it also prevents the Thumbtack failure where pros pay to shout.
- **Never charge providers to quote.** **[FACT]** Thumbtack charges $8–150 per lead shared with 4–5 pros; that model extracts from supply and decouples revenue from completed work. It would be resented and it kills your data.
- **Every completed Model 2 job is a product backlog item:** if a task shape recurs, productise it into Model 1 with a fixed price.

### Model 3 — "Just ask" *(V2/V3, not MVP)*
Free-text need → structured request. **[REC] At MVP this is a human, not a model.** Ops reads the request and builds the job. That is faster to ship, more accurate, and — as with the previous blueprint — the manual process is the specification for the eventual automation. Do not build the LLM layer before you have several hundred real requests to train the taxonomy on.

---

## Scope: the anti-dispute structure

```yaml
ScopeItem:
  description: "Photograph and video every room, including ceilings and under sinks"
  included: true
  quantity: 1
  acceptance_criterion: "Minimum 20 photos + 1 continuous video walkthrough"

exclusions:                    # explicit, mandatory, non-empty
  - "Structural or legal opinion on title"
  - "Negotiation with the landlord or agent"

materials:                     # THE Kenyan fundi trust failure — model it explicitly
  who_supplies: provider | customer | platform_advance
  budget_kes: 800
  receipts_required: true
  unused_returned: true
```

**[REC] The `materials` block is one of the highest-value things in this document.** Advancing cash for materials — and its disappearance, inflation, or substitution with inferior goods — is the single most common trust breakdown in Kenyan trade work, and no competitor I found models it. Treat the materials advance as a **separately escrowed, receipted, photographed milestone**. It protects the customer from theft and the honest fundi from suspicion, which — per Lynk's class-mistrust finding — matters just as much.

---

## Evidence: how "done" is proven

```yaml
Evidence:
  type: photo | video | document | checklist | geo_checkin | qr_scan
        | customer_confirmation | file_delivery
  captured_at, captured_by
  geo: {lat, lng, accuracy}     # captured in-app, not uploaded from gallery
  device_attested: bool
  hash                          # tamper-evidence
```

**[REC] Three rules:**
1. **Evidence requirements are declared in the job spec before work starts**, so both sides know what completion looks like.
2. **In-app capture with geotag for `on_site` and `representation` modes.** A gallery upload proves nothing; a photo taken in-app at the property at 14:22 proves a great deal.
3. **Evidence is the release trigger.** No evidence, no release — and correspondingly, complete evidence plus customer silence triggers **auto-release at 5 days** exactly as in the original blueprint. That protection is more important here, not less: a fundi who has bought materials and done a day's labour cannot be left unpaid because a customer stopped replying.

---

## State machines (Brief §38, §51)

**[REC] One core lifecycle, with optional stages switched on per fulfilment mode.** Your brief correctly warns against one giant unmaintainable machine; the answer is a small spine plus mode-specific extensions, not five parallel machines.

```
                        ── THE SPINE (every transaction) ──
DRAFT → REQUESTED → [QUOTED → QUOTE_ACCEPTED] → FUNDED → SCHEDULED
      → IN_PROGRESS → EVIDENCE_SUBMITTED → CUSTOMER_REVIEW
      → APPROVED → RELEASED → SETTLED → REVIEWED → CLOSED

Terminal at any point: CANCELLED_BY_CUSTOMER · CANCELLED_BY_PROVIDER
                       EXPIRED · DISPUTED · REFUNDED
```

Mode-specific stages inserted into the spine:

| Mode | Extra stages |
|---|---|
| `on_site` / `representation` | `PROVIDER_EN_ROUTE` → `CHECKED_IN` → `ON_SITE_COMPLETE` |
| Quote-based | `SITE_VISIT_SCHEDULED` → `SCOPE_AGREED` |
| With materials | `MATERIALS_ADVANCED` → `MATERIALS_RECEIPTED` |
| Recurring | Parent `SERIES` spawns child transactions; each runs the full spine |
| Application (creator) | `APPLIED` → `SHORTLISTED` → `SELECTED` |

**The timers, which are the real product:**

| Timer | Duration | On expiry | Protects |
|---|---|---|---|
| Quote validity | 24h | Expire | Customer |
| Acceptance → funding | 24h | Cancel + customer penalty | **Provider** |
| Scheduled → check-in | 30 min grace | Late flag; customer may cancel free | Customer |
| **Evidence → customer decision** | **5 days** | **AUTO-APPROVE + RELEASE** | **Provider** |
| Approval → payout | **<60 min target** | Escalation alert | **Provider** |
| Escrow maximum life | 60 days | Force-resolve | Compliance |
| Review window | 14 days | Double-blind reveal | Both |

**[REC]** Every transition emits an immutable event. Reputation, analytics, dispute evidence and eventual model training are all *derived* from that log and never stored as mutable fields — unchanged from the original blueprint, and now serving five verticals instead of one.

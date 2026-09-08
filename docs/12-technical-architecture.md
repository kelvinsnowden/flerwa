# 12 — Technical and Data Architecture (Brief §36, §37, §48–51, §53)

## The stack — reconsidered, mostly confirmed

**[REC] The previous recommendation holds, and the pivot strengthens rather than weakens it.**

| Layer | Choice | Change from before |
|---|---|---|
| Frontend | Next.js on Vercel, TypeScript | Unchanged |
| **Database** | **PostgreSQL (Supabase)** | **Unchanged — and now more strongly indicated** |
| Auth | Supabase Auth, **phone OTP primary** | Unchanged; more important — providers may have no email |
| Storage | **Cloudflare R2** (evidence masters), Supabase Storage (avatars, KYC, PDFs) | Unchanged |
| Video | Cloudflare Stream | Now for evidence video and creator portfolios |
| Payments | Licensed aggregator behind a `PaymentProvider` interface | Unchanged |
| Jobs/timers | Inngest | Now driving more timers |
| Notifications | WhatsApp Business API, SMS, push | Unchanged; WhatsApp even more central |
| Geo | **PostGIS + a travel-time matrix** | **Expanded — dispatch is now geographic** |
| Ops console | Build in week one | **Now non-negotiable** |

**Why Postgres is a stronger call now than it was for the creator marketplace:** the pivot adds geospatial dispatch, per-category reputation, recurring series with parent/child transactions, materials sub-ledgers and multi-vertical scope modelling. Every one of those needs joins, constraints and transactions. **[REC] Firestore was wrong before; it is now emphatically wrong.**

**[FACT] Two serverless constraints carry over unchanged:** Vercel's dynamic outbound IPs versus Daraja's production IP whitelisting (resolved by the aggregator), and Supavisor transaction-mode pooling on port 6543 with a reduced application-side pool.

**[REC] Two additions specific to physical services:**

1. **Offline-tolerant evidence capture.** A provider in a basement with no signal must complete a job and sync later. Local queue, background upload, idempotent submission. **[FACT]** SweepSouth's Kenya failure was attributed partly to slow and unstable technology in new markets — provider-side reliability is where that surfaces first.
2. **Evidence integrity.** In-app capture only for Tier 3 work, EXIF and geotag captured at source, hash on upload, perceptual hashing to detect recycled photos across jobs. This is a trust control, not a storage decision. (`06`)

---

## Core entities

**[REC] The naming principle: nothing in the schema names a vertical.** No `inspection`, no `campaign`, no `cleaning_job`. A vertical is data, not structure.

```
                              ┌────────────┐
                              │    User    │ phone, email, auth, kyc_tier
                              └─────┬──────┘
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
             ┌────────────┐  ┌────────────┐  ┌────────────┐
             │  Provider  │  │  Customer  │  │  Business  │ (either side)
             └─────┬──────┘  └─────┬──────┘  └────────────┘
                   │               │
     ┌─────────────┼──────────┐    │
     ▼             ▼          ▼    │
 Verification  Storefront  Coverage│      ┌──────────────────┐
     │             │        Area   └─────▶│ ServiceTransaction│◀── the spine
     ▼             ▼                      └────────┬─────────┘
 CategoryCompetence  ServiceOffering                │
                          │          ┌─────────────┼──────────────┬─────────┐
                          ▼          ▼             ▼              ▼         ▼
                    ServiceTemplate  ScopeItem  Escrow      Evidence   Review
                    (productised)       │       Milestone       │      Dispute
                                        ▼          │            ▼
                                   Materials   LedgerEntry  EvidenceAsset
                                                   │
                                                Payout

  RecurringSeries ──spawns──▶ ServiceTransaction (1:N)
  TransactionEvent (append-only)  ──derives──▶  ReputationSnapshot
```

### The tables that carry real design

```sql
service_transaction (
  id, customer_id, provider_id,
  service_template_id NULL,        -- NULL = custom/quoted job
  category_id,                     -- verification | trade | content | ...
  pricing_model,                   -- fixed | quote | hourly | recurring | application
  fulfilment_mode,                 -- remote_digital | on_site_present
                                   -- | on_site_absent | at_provider | representation
  state, origin,                   -- storefront | assigned | task_post | deal_desk | rebook
  currency,
  service_amount_minor,            -- what the provider is paid for labour
  materials_amount_minor,          -- pass-through: NOT revenue, NOT GMV
  customer_fee_minor, provider_fee_minor,
  location_id, scheduled_for, travel_time_estimate_s,
  parent_series_id NULL,
  funded_at, scheduled_at, checked_in_at, evidence_at, approved_at, settled_at,
  auto_approve_at,                 -- evidence_at + 5 days
  escrow_expires_at                -- funded_at + 60 days
)

-- Reputation split. THIS is the schema expression of the §8 correction.
provider_reliability (             -- ONE row per provider: portable
  provider_id PK, on_time_rate, completion_rate, response_time_s,
  dispute_rate, cancellation_rate, integrity_score,
  score, confidence_lower, sample_size, computed_at
)
provider_category_competence (     -- ONE row per provider PER CATEGORY: never portable
  provider_id, category_id, jobs_completed, quality_rating,
  rework_rate, first_time_right, assessment_score,
  score, confidence_lower, PRIMARY KEY (provider_id, category_id)
)

-- Gate: a provider may only be offered in a category they are cleared for.
provider_category_clearance (
  provider_id, category_id, tier, cleared_at, cleared_by, expires_at,
  evidence_ref, PRIMARY KEY (provider_id, category_id)
)

evidence_asset (
  id, transaction_id, scope_item_id, type,
  captured_in_app boolean NOT NULL,     -- false is disqualifying for tier 3
  captured_at, geo geography(Point), accuracy_m,
  content_hash, perceptual_hash, storage_ref
)

location (id, country, county, town, ward, geo geography(Point), parent_id)
travel_time (from_ward_id, to_ward_id, hour_of_day, seconds)   -- NOT straight-line
```

**[REC] Six schema rules, each expensive to retrofit:**

1. **Money is `amount_minor bigint` + `currency`.** Never a float.
2. **`materials_amount_minor` is structurally separate from `service_amount_minor`.** It is a liability pass-through and must never enter GMV or revenue.
3. **The ledger is append-only.** Corrections are reversing entries.
4. **Reputation is derived from `transaction_event`, never authored.** Lets you change the formula and recompute history — which you will do at least twice.
5. **`provider_category_clearance` is enforced in the query layer, not in application logic.** A provider without clearance must be *unable* to surface in that category. This is a safety control expressed as a constraint.
6. **Location is a hierarchy plus geography plus a travel-time matrix.** "Kilimani" as a string makes dispatch impossible.

---

## State machines

One spine, mode-specific stages, as specified in `04`. **[REC] Implement as a table-driven state machine, not a switch statement**: `(from_state, event, fulfilment_mode) → to_state + guards + side_effects`. New verticals add rows, not branches. This is the concrete answer to your brief's warning about one unmaintainable giant machine.

Every transition writes an immutable `transaction_event` with an idempotency key.

---

## The ops console (Brief §53)

**[REC] This is a primary product, not internal tooling, and it should be staffed in the first sprint.** V0 and V1 are manually operated marketplaces; the console is the operating surface of the company.

**Day-one requirements:** live job board by state with SLA breach highlighting · provider verification queue with document review · **report/evidence QC queue** (every report reviewed before the customer sees it) · manual assignment and reassignment · dispute workspace showing both sides' evidence and the full event timeline · payment operations (retry payout, manual release, refund, reconciliation breaks) · **incident log with escalation** · provider and customer 360 views.

**[REC] Two things founders consistently under-build and regret:** the **reconciliation break queue** (payment discrepancies compound silently and surface at the worst moment) and the **incident log** (safety events need a documented, timestamped, reviewable trail from the first one, not the first serious one).

---

## AI — position unchanged (Brief §39)

**[REC] LLMs interpret and draft. Deterministic code decides money, ranking, reputation, clearance and disputes.** Unchanged from the original blueprint and more important now, because the decisions carry physical and financial consequence.

| Version | AI role |
|---|---|
| **MVP** | **None.** Ops reads free-text requests and structures them by hand. |
| V2 | LLM structures intake into a `ServiceTransaction` draft — always human-reviewed before dispatch. Trained on the manual corpus. |
| V3 | Learned ranking on completed-job outcomes; demand forecasting for supply planning. |

**[REC] Never let a model decide who is dispatched to a customer's home, or whether a provider is cleared for a category.** Those are deterministic, auditable, testable decisions — and the ones you will have to defend.

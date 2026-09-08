# Parts 22, 37, 38 — Technical Architecture

## Part 37 — The stack

### The database decision — answered directly

You asked: *"Firebase/Firestore or recommend an alternative if better."*

**[REC] Use PostgreSQL. Do not use Firestore. This is the most consequential technical decision in the project and it is not close.**

| Requirement | Postgres | Firestore |
|---|---|---|
| Multi-row ACID transactions for escrow/ledger | ✅ Native | ⚠️ Limited, awkward |
| Foreign keys and integrity constraints | ✅ | ❌ None |
| Joins across creators × socials × services × availability | ✅ | ❌ **No joins at all** |
| Compound filters (12+ discovery dimensions) | ✅ | ❌ Composite index per query shape |
| Geospatial (ward proximity, travel time) | ✅ PostGIS | ❌ Bolt-on only |
| Full-text + vector search for matching | ✅ `pg_trgm` + `pgvector` | ❌ External service |
| Aggregate analytics | ✅ | ❌ Must denormalise everything |
| Double-entry ledger with invariants | ✅ Constraints + transactions | ❌ Application-enforced only |

**The decisive argument:** your discovery and matching queries filter on **location + niche + type + price + availability + rating + reliability + audience simultaneously**. This is the defining query of the product. Firestore fundamentally cannot express it — every filter combination needs a pre-built composite index, and the combinatorics explode. You would end up shipping a search service alongside Firestore and syncing between them, which is strictly worse than starting with Postgres.

The second argument: **you are moving other people's money.** A financial ledger without foreign keys and multi-row transactions is a source of quiet, compounding corruption that surfaces as unreconciled balances six months in.

**[REC] Supabase** (managed Postgres + auth + storage + realtime + row-level security) for V1 — it gives you Firebase's developer velocity on a real relational database. **Neon** if you prefer to assemble the pieces yourself.

### Recommended stack

| Layer | V1 (MVP) | Why |
|---|---|---|
| **Frontend** | Next.js 15 (App Router), TypeScript, Tailwind | Your stated preference; SSR matters for creator-storefront SEO |
| **Hosting** | Vercel | Stated preference; fine at this scale |
| **Database** | **Postgres (Supabase)** | See above |
| **Auth** | Supabase Auth — **phone OTP primary**, email secondary, Google optional | **[REC] Phone-first. Kenyan creators may not have an email they check; everyone has a phone.** |
| **Storage** | Supabase Storage / Cloudflare R2 | R2 has no egress fees — material when serving video portfolios |
| **Video** | **Cloudflare Stream or Mux** | **[REC] Do not roll your own transcoding.** Video is the product; adaptive bitrate matters on Kenyan mobile networks. |
| **Payments** | Licensed aggregator (IntaSend / Paystack / Pesapal) behind your own `PaymentProvider` interface | See `05-payments-mpesa.md` |
| **Background jobs** | Inngest / Trigger.dev | Timers, reconciliation, proof re-checks, payout retries |
| **Notifications** | WhatsApp Business API (primary), Africa's Talking (SMS), Resend (email), FCM (push) | See Part 22 |
| **Search** | Postgres `pg_trgm` + `pgvector` | Do not add Elasticsearch until Postgres actually fails you |
| **Analytics** | PostHog | Product analytics + feature flags + session replay in one |
| **Errors/APM** | Sentry | |
| **AI** | Claude API for brief parsing and generation | Structured extraction with schema validation |
| **Admin** | Retool or a bespoke Next.js admin | **[REC] Build the ops console in week one — see below** |

**[REC] The ops console is not a V2 item.** V0 and V1 are *manually operated marketplaces*. Your team needs to intervene in every collaboration: verify creators, moderate campaigns, resolve disputes, trigger payouts, fix stuck states. Founders who defer the admin tool end up running the marketplace from the database console, which does not scale past about fifty orders and produces errors that cost real money.

### Social platform APIs — what is realistically integrable

**[FACT] Verified constraints as of 2026:**
- **Instagram's Basic Display API was deprecated in December 2024.** All access is now via the Graph API, requires app review, and works **only for Business and Creator accounts**. The `instagram_manage_insights` scope returns audience demographics **only for the authenticated account owner** — you cannot query a creator's audience on their behalf without their explicit app authorisation.
- **TikTok does not expose audience age, gender or geographic breakdown through direct API calls.** This is described as one of the most significant gaps for influencer marketing platforms.
- TikTok's API surface expanded through 2025–26, notably with TikTok Shop APIs. TikTok app review is reported at 5–10 days; Instagram's is slower and stricter. Full integration is typically 4–6 weeks including review.
([Phyllo social media API guide](https://www.getphyllo.com/post/social-media-api-guide-on-top-apis-for-developers), [Instagram Graph API guide](https://elfsight.com/blog/instagram-graph-api-complete-developer-guide-for-2026/))

**[REC] Plan honestly around these limits:**

| Platform | V1 | V2 | V3 |
|---|---|---|---|
| **TikTok** | OAuth login, profile, video list, **own-account metrics** | Video-level performance on submitted content | TikTok Shop affiliate attribution; Spark Ads codes |
| **Instagram** | OAuth (Business/Creator only), profile, media | Insights for authorised accounts | Meta Partnership Ads access requests |
| **YouTube** | Data API: channel stats, video stats | Analytics API for authorised channels | |
| **Facebook** | Page insights for authorised pages | | |
| **X** | ❌ **[REC] Skip.** API pricing is not justifiable for Kenyan reach | | |

**[REC] Three consequences to design around now:**
1. **Never promise brands audience demographics you cannot source.** Where API data is unavailable, show an estimate, label it an estimate, and say where it came from.
2. **Creator OAuth is the only path to verified data**, so make connecting accounts visibly rewarding: a "Verified Audience" badge plus a real ranking uplift. Track connection rate as a core funnel metric.
3. **Manual verification is a legitimate V1 fallback.** A screen-recorded walkthrough of the creator's own analytics, reviewed by ops, is slow but honest. **[FACT]** Every incumbent has some version of this. Do not block launch on API approvals.

---

## Part 22 — WhatsApp architecture

**[FACT]** WhatsApp and TikTok were the most frequently used social platforms in Kenya in a Q2 2025 survey. **[REC] Treat WhatsApp as the primary notification and engagement channel, and — critically — as a *read* interface, never a *write* one.**

### The architectural principle

```
       WhatsApp = NOTIFICATION + LIGHT INTERACTION
       Platform = SYSTEM OF RECORD (always)

  Platform event ──► Notification Service ──► channel router
                                              ├─ WhatsApp (primary)
                                              ├─ Push (if app installed)
                                              ├─ SMS (fallback, urgent only)
                                              └─ Email (records, receipts)

  WhatsApp reply ──► Webhook ──► Intent parser ──► Deep link into platform
                                                   (state changes happen THERE)
```

**[REC] The hard rule: no state-changing action completes over WhatsApp.**

A creator can tap "View campaign" in WhatsApp and land in the app. They cannot *accept a contract* over WhatsApp. The reason is not squeamishness — it is that acceptance, approval, and payment authorisation must be attributable, auditable, and consented-to against terms you can produce in a dispute. A WhatsApp message is not that record.

**The one justified exception: [REC] simple confirmations with an audit trail** — "Reply 1 to confirm you'll attend Friday 7pm" — where the reply is logged as an event with message ID and timestamp, and the platform holds the authoritative state. That is a confirmation, not a contract.

### What goes over WhatsApp

| Event | Channel | Template |
|---|---|---|
| New matching campaign | WhatsApp | *"KSh 7,500 · Restaurant visit in Westlands · 3 slots left. Apply → [link]"* |
| Application accepted | WhatsApp + push | |
| **Payment released** | **WhatsApp + SMS** | *"KSh 7,500 sent to 0712*** — M-Pesa ref QK12ABC3"* |
| Deadline in 24h | WhatsApp | |
| Revision requested | WhatsApp + push | |
| Brand: new applications | WhatsApp + email | |
| Brand: content ready for review | WhatsApp + email | |
| Dispute update | WhatsApp + email | |

**[REC] The payment notification is the most valuable message you will ever send.** It is the proof that the platform works, it arrives at the moment of maximum goodwill, and it is the thing creators screenshot and share in WhatsApp groups. Make it clear, include the M-Pesa reference, and never let it be late.

### Constraints and cautions

**[ASSUMPTION — verify current WhatsApp Business Platform policy and pricing before committing]** Business-initiated messages generally require pre-approved templates and are charged per conversation; free-form replies are typically permitted only inside a customer-initiated service window. Template approval takes time and template rejection is common. **[REC]** Budget for per-conversation costs in your unit economics (they are real at 50,000 collaborations/month), get templates approved early, and always maintain SMS as a fallback for payment-critical messages.

**[REC] Also run community WhatsApp groups — but manually and deliberately.** A curated group of active creators is the highest-signal feedback channel you will have in year one, and it is where your first hundred creators will actually live. Do not automate it. Have a human in it every day.

---

## Part 38 — Database design

### Core entities and relationships

```
                            ┌──────────┐
                            │   User   │  (phone, email, auth, kyc_tier)
                            └────┬─────┘
              ┌──────────────────┼──────────────────┐
              ▼                  ▼                  ▼
        ┌──────────┐      ┌──────────┐       ┌──────────┐
        │ Creator  │      │  Brand   │       │  Agency  │
        └────┬─────┘      └────┬─────┘       └────┬─────┘
             │                 │  ▲               │
             │                 └──┴───────────────┘  (agency manages N brands)
             │
   ┌─────────┼──────────┬─────────────┬──────────────┐
   ▼         ▼          ▼             ▼              ▼
SocialAcct Portfolio  Service    Availability   ReputationSnapshot
                        │
                        ▼
                    Package

        ┌──────────┐         ┌──────────────┐
        │ Campaign │────1:N──│Collaboration │◄──── the central entity
        └──────────┘         └──────┬───────┘
                                    │
   ┌────────────┬──────────┬────────┼────────┬───────────┬──────────┐
   ▼            ▼          ▼        ▼        ▼           ▼          ▼
Application Deliverable Milestone Escrow  Message   RightsGrant  Review
                │                    │
                ▼                    ▼
          Asset / Proof         LedgerEntry ──► Payout
                                     │
                                     ▼
                                  Dispute
```

### Table sketch (the ones with non-obvious design)

```sql
-- One row per brand↔creator contract. All money and reputation attach here.
collaboration (
  id, campaign_id NULL,          -- NULL = direct storefront booking
  creator_id, brand_id,
  type,                          -- seeding|ugc|influencer|visit|event|affiliate|hybrid|licensing|package|custom
  state,                         -- see 09-workflow-states.md
  origin,                        -- campaign_application | brand_invite | storefront | deal_desk
  currency, creator_amount_minor, platform_fee_minor, total_amount_minor,
  rights_grant_id, brief_id,
  accepted_at, funded_at, due_at, delivered_at, approved_at, settled_at,
  auto_approve_at,               -- computed: delivered_at + 5 days
  escrow_expires_at              -- computed: funded_at + 60 days
)

-- Append-only. Every state change. The source of truth for reputation & analytics.
collaboration_event (
  id, collaboration_id, type, actor_type, actor_id,
  from_state, to_state, payload jsonb, created_at, idempotency_key UNIQUE
)

-- Double-entry. Never mutate; only append.
ledger_entry (
  id, transaction_id,            -- groups the balanced set
  account_type,                  -- escrow_held|creator_payable|platform_revenue|payment_costs|tax_withheld|brand_receivable
  account_ref,                   -- creator_id | brand_id | collaboration_id
  direction,                     -- debit | credit
  amount_minor, currency,
  collaboration_id, external_ref, created_at
  -- INVARIANT: SUM(debits) = SUM(credits) per transaction_id
)

-- Rights are structured data, not prose. Enables the pricing slider and machine-checkable terms.
rights_grant (
  id, base_scope,
  paid_ads_channels text[], paid_ads_until date,
  brand_organic_until date, website_until date, ooh_until date,
  whitelisting boolean, whitelisting_until date,
  exclusivity_category text, exclusivity_until date,
  territory text[], edit_rights jsonb, perpetual boolean,
  price_multiplier numeric, contract_pdf_url
)

-- Ward-level geography. PostGIS point + hierarchy.
location (id, country, county, town, ward, geo geography(Point), parent_id)

-- Per-type, time-decayed reputation. Recomputed from events, never hand-edited.
reputation_snapshot (
  creator_id, collaboration_type, computed_at,
  reliability, quality, brand_satisfaction, authenticity, performance,
  crs numeric, confidence_lower numeric, sample_size int
)
```

### Design rules

**[REC]** Seven, each of which is expensive to retrofit:

1. **Money is `amount_minor bigint` + `currency`, never a float, never a bare number.** Cents/shillings as integers. Currency present from day one even while KES-only.
2. **The ledger is append-only.** Corrections are reversing entries, not updates. No `UPDATE` on `ledger_entry`, enforced by permissions.
3. **Reputation is derived, never stored as truth.** `reputation_snapshot` is a materialised cache recomputed from `collaboration_event`. This lets you change the formula and recompute history — which you will do, at least twice.
4. **Location is a hierarchy with geography, not a string.** "Westlands" as free text makes proximity matching impossible.
5. **Soft-delete everything financial or reputational.** Records referenced by disputes must survive account deletion — and note this sits in tension with Data Protection Act erasure rights, so define a retention policy with counsel (see `13-legal-compliance.md`).
6. **Idempotency keys on every payment and state transition.** M-Pesa callbacks duplicate as a matter of routine.
7. **Row-level security from the start** if using Supabase. Retrofitting authorisation is how marketplaces leak one user's data to another.

---

## Version roadmap (technical)

| | **MVP (V1)** | **V2** | **V3** |
|---|---|---|---|
| Auth | Phone OTP | + Google, team seats, roles | SSO |
| Payments | Aggregator STK + B2C, escrow, single release | Milestones, split payments, refund automation | Trust account, multi-currency, cards, FX |
| Social | Manual verification + TikTok OAuth | IG/YouTube OAuth, automated proof | Spark Ads, Meta Partnership Ads, Shop attribution |
| Matching | SQL filters + hand-tuned score | LLM brief parsing, explainable ranking | Learned ranking, portfolio optimisation |
| Messaging | In-app threads | Voice notes, files, templates | — |
| Notifications | WhatsApp templates + SMS | Push, preference centre | Intelligent batching |
| Analytics | Basic dashboards | Attribution, promo codes | Full ROAS, cohorts, forecasting |
| Ops | **Admin console (week one)** | Automated moderation, risk scoring | ML fraud detection |
| Rights | Structured grant + PDF contract | Rights library, renewals | Automated enforcement monitoring |
| Logistics | State tracking only | Courier API integration | Consolidated dispatch |

**[REC] One team-shaping note.** The MVP column is roughly **3–4 engineers for 10–14 weeks**, and the largest single risk in it is not code — it is **[FACT]** the 6–8 weeks typically required to go from Daraja sandbox to production, which includes shortcode registration, a signed go-live letter, and IP whitelisting. **Start the M-Pesa go-live paperwork in week one, before you write the first line of payment code.** It is the critical path, and it is the one part of the build that no amount of engineering effort can accelerate.

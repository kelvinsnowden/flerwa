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
| **Storage** | **Cloudflare R2** for deliverable masters; Supabase Storage for avatars, ID docs, PDFs | Split by workload — see *Video and storage* below |
| **Video** | **Cloudflare Stream** | Portfolio clips and watermarked review previews. See *Video and storage* below. |
| **Payments** | Licensed aggregator (IntaSend / Paystack / Pesapal) behind your own `PaymentProvider` interface | See `05-payments-mpesa.md` **and the static-IP constraint below** |
| **Background jobs** | Inngest / Trigger.dev | Timers, reconciliation, proof re-checks, payout retries |
| **Notifications** | WhatsApp Business API (primary), Africa's Talking (SMS), Resend (email), FCM (push) | See Part 22 |
| **Search** | Postgres `pg_trgm` + `pgvector` | Do not add Elasticsearch until Postgres actually fails you |
| **Analytics** | PostHog | Product analytics + feature flags + session replay in one |
| **Errors/APM** | Sentry | |
| **AI** | Claude API for brief parsing and generation | Structured extraction with schema validation |
| **Admin** | Retool or a bespoke Next.js admin | **[REC] Build the ops console in week one — see below** |

**[REC] The ops console is not a V2 item.** V0 and V1 are *manually operated marketplaces*. Your team needs to intervene in every collaboration: verify creators, moderate campaigns, resolve disputes, trigger payouts, fix stuck states. Founders who defer the admin tool end up running the marketplace from the database console, which does not scale past about fifty orders and produces errors that cost real money.

### Video and storage — three workloads, not one

**[REC] Treating "video" as a single problem is what makes these bills explode.** Flerwa has three video workloads with opposite characteristics, and they belong in different places.

| Workload | Size | Reads | Private? | Transcoding? | **Goes to** |
|---|---|---|---|---|---|
| **A. Portfolio clips** (profile, storefront) | Small (~40s) | **Very high** | Public | Yes — adaptive bitrate | **Cloudflare Stream** |
| **B. Deliverable masters** (what the brand buys) | **Large** (100MB–2GB) | Very low (~3) | Private | No | **Cloudflare R2** |
| **C. Review previews** (draft under review) | Small | Low | Private | Yes — low-res | **Cloudflare Stream** |

**[FACT] Pricing that drives the split (verified September 2026 — re-verify before committing):**
- **Cloudflare Stream:** $5 per 1,000 minutes stored, $1 per 1,000 minutes delivered, **transcoding included with no encoding fees**.
- **Mux:** priced separately for encoding (~$0.0075/min), storage (~$0.003/min) and delivery (~$0.0008–0.0048/min by resolution and tier). On a normalised workload Stream came out ~$150 vs Mux ~$170.
- **Cloudflare R2:** ~$0.015/GB stored, **zero egress**, with a permanent free allowance (10GB stored, 1M Class A / 10M Class B ops).
- **Supabase Storage (Pro):** $25/mo including 100GB storage and 250GB egress; overages ~$0.021/GB storage and **~$0.09/GB egress**.
([BuildMVPFast — video](https://www.buildmvpfast.com/api-costs/video), [BuildMVPFast — storage](https://www.buildmvpfast.com/api-costs/cloud-storage), [PkgPulse](https://www.pkgpulse.com/guides/mux-vs-cloudflare-stream-vs-bunny-stream-video-cdn-2026), [Adam Arant](https://adamarant.com/en/blog/cloudflare-r2-vs-s3-vs-supabase-storage-in-2026-which-to-pick))

**[REC] Stream over Mux:** cheaper, simpler, transcoding included. Mux wins on DRM and per-view analytics — you need neither, because creator performance data lives on TikTok and Instagram, not on your player.

**[REC] R2 over Supabase Storage for masters:** brands downloading deliverables is a pure egress workload, which is precisely what R2's zero-egress model exists for. Keep Supabase Storage for avatars, KYC documents and contract PDFs, where RLS-governed access is worth more than egress pricing.

**[ASSUMPTION] Rough cost at V2 scale** (5,000 creators, 1,500 collaborations/month): ~$300/mo portfolio + ~$150/mo masters (~10TB accumulated) + ~$50/mo previews ≈ **$500/month against KSh 27M GMV — immaterial.** The architecture matters not because it is cheap now, but because it prevents this becoming $5,000/month at V3.

#### The watermark gate — this closes a fraud hole, not just a cost problem

**[REC] This is a correction to the dispute design in `06-trust-reputation-fraud.md`.** As originally specified, a brand could receive a draft, **download the file**, refuse to approve, open a dispute, obtain a refund, and still hold the asset. That is free content.

The storage split fixes it, using infrastructure you are building anyway:

```
DRAFT_SUBMITTED  → brand sees a WATERMARKED, low-res STREAMING preview only
                   No download. Visible watermark. Stream-delivered, never a file.
PAYMENT_RELEASED → clean master unlocked from R2 via a signed, expiring URL
```

Standard practice in stock-media and design marketplaces, and it makes download-then-dispute pointless. It also gives the rights system real teeth: **the master is gated on settlement, not on approval.**

#### Upload is the hard problem in Kenya, not playback

**[REC] Most designs optimise playback and ignore upload. Here it is the reverse.** A creator on Nairobi mobile data uploading a 200MB video *will* fail partway, and a failed upload after a completed shoot is a churn event — the creator did the work and cannot deliver it.

Four requirements:
1. **Resumable uploads (tus protocol)** — supported by both Cloudflare Stream and Supabase Storage. Non-negotiable on mobile.
2. **Direct-to-storage via signed URL.** Never proxy video through Next.js API routes — Vercel serverless functions cap request bodies at roughly 4.5MB, and proxying is slow and expensive regardless.
3. **Client-side compression before upload**, with a visible size and time estimate so the creator knows what they are committing to.
4. **Cap required resolution at 1080p** unless the rights grant genuinely needs more. Demand a large master only when the brand purchased OOH or print rights — this ties file size to what was actually paid for.

**[REC] On playback, adaptive bitrate matters more here than in a Western market.** Shipping a 1080p rendition to a phone on a variable network both fails to play and burns the viewer's data bundle. That is a cost borne by your users, not your invoice — and in a market where mobile data is expensive, it is a retention issue.

---

### The M-Pesa static-IP constraint (serverless gotcha)

**[FACT]** Vercel deployments use **dynamic outbound IPs**, and any destination that allowlists by IP will reject that traffic ([Vercel — Static IPs](https://vercel.com/docs/networking/static-ips), [QuotaGuard](https://www.quotaguard.com/integrations/vercel-static-ip), [Fixie](https://usefixie.com/vercel-static-ip)).

**[FACT — sources conflict]** Some Daraja documentation states the API works over the public internet with no VPN or IP whitelisting required (unlike the legacy SOAP API), while multiple go-live guides state that **Safaricom whitelists your production server IPs before enabling live endpoints**. **[REC] Assume whitelisting is required and design defensively** — discovering otherwise costs nothing; discovering it late blocks go-live.

Note the asymmetry: **inbound callbacks are fine on serverless** (any public HTTPS endpoint works). It is the **outbound** calls to Daraja that need a fixed source address.

**[REC] Three ways out, in order of preference:**

| Option | Trade-off |
|---|---|
| **1. Use the licensed aggregator** (IntaSend / Paystack / Pesapal) | **Preferred.** They hold the Daraja relationship and the static IPs. This is already the recommendation for regulatory reasons in `13-legal-compliance.md` — that two independent constraints point to the same answer is a good sign. |
| 2. Static-IP egress proxy (QuotaGuard, Fixie) | Route only outbound Daraja calls through it. Cheap, adds a dependency and a latency hop. |
| 3. Small always-on VM as a payments service | Fixed IP, full control, direct Daraja relationship at scale. Vercel handles everything else. Most operational overhead. |

**[REC] Whichever you choose, keep it behind the `PaymentProvider` interface.** Moving from aggregator (V1) to direct Daraja (at scale) should be a provider swap, not a refactor.

---

### Connection pooling (the other serverless gotcha)

**[FACT]** Next.js on Vercel plus Postgres will exhaust connections unless you use **Supavisor's transaction-mode pooler on port 6543**, and reduce or disable your application-side pool. Transaction mode is optimised for short-lived, stateless serverless functions. Prepared-statement support in transaction mode has improved — Supavisor now parses and broadcasts named prepared statements across connections — but it historically caused problems with Prisma. ([Supabase — connecting to Postgres](https://supabase.com/docs/guides/database/connecting-to-postgres), [Supavisor 1.0](https://supabase.com/blog/supavisor-postgres-connection-pooler), [Supavisor FAQ](https://supabase.com/docs/guides/troubleshooting/supavisor-faq-YyP5tI))

**[REC] Spike this before committing to an ORM.** It is a one-day test that prevents a painful migration later.

**[REC] Two more Supabase-specific decisions:**
- **Do not let the client write money.** RLS is defence-in-depth, not your authorisation model for financial logic. All escrow transitions, ledger writes, payout instructions and state-machine changes go through server-side routes using the service role. An RLS bug in a marketplace is a security incident; an RLS bug on the ledger is unrecoverable.
- **Benchmark region latency from Nairobi before provisioning.** East African traffic routes both north to Europe and east via Indian Ocean cables, so do not assume Frankfurt beats Mumbai. This also interacts with the cross-border transfer question in `13-legal-compliance.md`, and a project's region cannot be changed later without a migration.

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

**[REC] Two critical-path notes.** First, resolve the **static-IP question with your aggregator in week one** alongside the Daraja paperwork — it determines whether payments can live on Vercel at all.

**[REC] One team-shaping note.** The MVP column is roughly **3–4 engineers for 10–14 weeks**, and the largest single risk in it is not code — it is **[FACT]** the 6–8 weeks typically required to go from Daraja sandbox to production, which includes shortcode registration, a signed go-live letter, and IP whitelisting. **Start the M-Pesa go-live paperwork in week one, before you write the first line of payment code.** It is the critical path, and it is the one part of the build that no amount of engineering effort can accelerate.

# BUILD PLAN — Trusted Services Marketplace

**Strategic source of truth:** `docs/` (rendered as `Trusted-Services-Marketplace-Blueprint.pdf`).
**Tag discipline is preserved throughout:** **[FACT]** verified · **[REC]** recommendation · **[ASSUMPTION]** unverified · **[LEGAL — COUNSEL REQUIRED]**.

---

## Phase 0 — Existing System Audit

### What I found

**[FACT] There is no existing application.** The repository contains documentation only:

| Path | Contents | Verdict |
|---|---|---|
| `docs/` (16 files) | The trusted-services strategic blueprint | **Retain** — source of truth |
| `docs/archive-creator-marketplace/` (18 files) | The original creator blueprint + V1 PDF | **Retain** — Vertical 2 playbook |
| `build/` | Python + Playwright PDF renderer (`playwright-core`, `pdf-lib`) | **Retain, isolate** — unrelated to the app |
| `README.md`, `*.pdf` | Documentation | Retain |

**There is no** Next.js app, `package.json` for an application, `tsconfig.json`, route, component, API handler, Supabase client, schema, migration, auth flow, payment code, creator-marketplace implementation, admin surface, `.env` file, or deployment config. Git history is seven documentation commits.

**[FACT] Supabase was not connected to this product.** The account contained exactly one project — **`NEXUS CRM`** (`anzeklqnfugkvtufgydk`, eu-west-1, created 2025-12-06, status **INACTIVE**) — which is a different product.

### Conflicts with the brief, stated plainly

The brief instructs me to audit existing code, preserve existing creator-marketplace functionality, use the existing Supabase connection, and avoid creating a second database. **Three of those four premises do not hold**, so:

| Brief instruction | Reality | Action taken |
|---|---|---|
| "Audit the existing codebase" | No application code exists | Audited; documented above |
| "Preserve the creator marketplace that already exists" | Only a *blueprint* exists, never implemented | Preserved as documentation; its **concepts** are carried into the generic schema (Vertical 2) |
| "Supabase is already connected — use it" | Not connected. Only an unrelated, paused project | **Created a new free project** (see below) |
| "Do not create a second database" | There was no first database for this product | Honoured in spirit: exactly one database for this product |

**[REC] Decision — new Supabase project.** Writing this product's schema into `NEXUS CRM` would pollute an unrelated product's database and it is paused. Creating a project cost **$0/month** (verified before creating) and is reversible. New project: **`trusted-services-marketplace`** — ref `famdxoardiibonghxepl`, eu-west-1, ACTIVE_HEALTHY. To point at a different project instead, change `.env.local`; nothing is hard-coded.

### What this means for the plan

This is a **greenfield build against an existing strategy**, not a migration. Every phase below creates rather than refactors. Nothing is destroyed because nothing executable exists.

---

## Phase 1 — Architecture

**Objective.** Establish a generic service-transaction platform whose launch catalogue is narrow (Remote-Principal wedge) but whose schema admits new verticals by **data, not code**.

**Decisions**
- **Next.js 15 App Router + TypeScript + Tailwind v4.** Mobile-first, SSR for SEO on public pages.
- **Supabase**: Postgres + Auth + Storage + RLS. No Firebase, no second database.
- **Business logic lives in Postgres**, not the browser. Every state transition is a `SECURITY DEFINER` function that re-validates the caller. A future Android app calls the same functions and inherits identical rules.
- **Money is `amount_minor bigint` + `currency`.** No floats anywhere, enforced by column types.
- **Append-only** `transaction_events` and `ledger_entries`; enforced by triggers rejecting UPDATE/DELETE.
- **Payment provider abstraction** with an honest manual adapter (see Phase 9).

**Security considerations.** Service-role key server-only. Client never sets price, status, role, verification or reputation.
**Acceptance.** App builds and typechecks; `/` renders; Supabase reachable from server and browser with anon key only.

---

## Phase 2 — Supabase / Database

**Objective.** One relational schema serving all verticals.

**Tables.** `profiles` · `providers` · `provider_verifications` · `provider_categories` (competence) · `provider_service_areas` · `categories` · `services` · `service_checklist_items` · `service_transactions` · `transaction_scope_items` · `transaction_checklist_results` · `transaction_evidence` · `transaction_events` · `payments` · `payment_events` · `ledger_accounts` · `ledger_entries` · `reviews` · `reliability_scores` · `disputes` · `messages` · `notifications` · `service_requests` · `quotes` · `saved_providers` · `audit_logs`.

**Key design.**
- `service_transactions` is the single spine. A creator campaign, a property inspection and a future plumbing job are all rows here, differing by `category_id`, `pricing_model`, `fulfilment_mode`.
- **Reliability is portable** (one row per provider); **competence is per-category** (`provider_categories`) and gates catalogue visibility — a provider cannot be booked in a category they are not cleared for. This is the blueprint's §8 correction expressed as a constraint.
- Category-specific attributes (creator audience/platforms, trade certifications) live in `provider_categories.attributes JSONB`, never on `providers`.
- `materials_amount_minor` is separate from `service_amount_minor` — **pass-through, never revenue, never GMV**.

**Security.** RLS on every table, default deny. Append-only triggers on events and ledger.
**Acceptance.** Migration applies cleanly; RLS enabled on all tables; advisors show no errors.

---

## Phase 3 — Authentication

**Objective.** One account, multiple roles.
**Decisions.** Email+password and magic link at MVP; **phone OTP wired but requires an SMS provider** — surfaced honestly rather than faked. `profiles.role` is `customer|provider|admin`, **settable only by admins**; a user cannot escalate themselves (RLS + column trigger).
**Acceptance.** Signup creates a profile via trigger; role change from the browser is rejected.

---

## Phase 4 — Provider Onboarding & Verification

**Objective.** A real, admin-driven verification workflow with defensible claims.
**States.** `pending → submitted → under_review → verified | rejected | expired`.
**[REC]** Badges mean exactly what `docs/06-trust-architecture.md` says. **No "background checked" claim** — not substantiable. **[LEGAL — COUNSEL REQUIRED]** before any criminal-record claim.
**Acceptance.** Provider submits documents to a private bucket; only admins and the owner can read them; only an admin can set `verified`; storefront goes live only when verified.

---

## Phase 5 — Service Catalogue

**Objective.** Productised fixed-price services, admin-editable, seeded with the Remote-Principal wedge.
**[ASSUMPTION]** All seed prices come from `docs/09-verticals.md` and are explicitly placeholders pending validation; every one is editable in admin.
**Acceptance.** Admin creates a category, service, price and checklist without a deploy.

---

## Phase 6 — Customer Booking (primary flow)

**Objective.** The cleanest flow in the product: service → provider → schedule → details → pay → track → evidence → approve → review.
**Acceptance.** A customer completes a booking end-to-end; price is computed server-side and cannot be altered by the client.

---

## Phase 7 — Transaction Engine

**Objective.** One state machine, mode-specific stages, all timers.
```
DRAFT → REQUESTED → [QUOTED → QUOTE_ACCEPTED] → FUNDED → SCHEDULED
      → EN_ROUTE → CHECKED_IN → IN_PROGRESS → EVIDENCE_SUBMITTED
      → CUSTOMER_REVIEW → APPROVED → RELEASED → SETTLED → REVIEWED → CLOSED
Terminal: CANCELLED_BY_CUSTOMER · CANCELLED_BY_PROVIDER · EXPIRED · DISPUTED · REFUNDED
```
**Security.** Transitions only via `SECURITY DEFINER` functions validating actor, current state and ownership. Illegal transitions raise.
**Acceptance.** A customer cannot approve their own provider's work as the provider; a provider cannot self-approve; every transition writes an event.

---

## Phase 8 — Evidence

**Objective.** Make the provider prove what they did.
**Decisions.** Configurable per-service checklists; evidence rows bound to a transaction and optionally to a checklist item; capture uploader, timestamp, type, optional GPS, description. Private bucket + signed URLs. Structured reports, not "looks fine".
**Acceptance.** Completion cannot be submitted while required checklist items lack evidence. Non-participants get 403 on evidence URLs.

---

## Phase 9 — Payments

**Objective.** Provider-agnostic payment layer, honest about capability.
**[FACT]** Kenya requires CBK PSP authorisation to process retail payments, operate wallets or aggregate — see `docs/07-payments.md`. **[LEGAL — COUNSEL REQUIRED].**
**[REC] Honesty rule, enforced in code and copy:** the MVP ships a `ManualPaymentProvider` — the customer pays to a business number out-of-band and **an operator confirms receipt**. That is real and truthful. A `DarajaPaymentProvider` adapter exists but **throws unless credentials are configured**; it is never silently stubbed. The UI says *"payment confirmed by our team and held until you approve the work"* — **never "escrow" and never a legal guarantee** we cannot make.
**States.** `unpaid → payment_pending → funded → released | refunded`, plus `disputed`.
**Acceptance.** No code path marks a payment funded from the browser. Confirmation is admin- or webhook-only and writes balanced ledger entries.

---

## Phase 10 — Reputation

**Objective.** Reliability (portable) and Competence (per category), never conflated.
**Decisions.** Reviews only from settled transactions. Bayesian shrinkage to the category median (k=5) so new providers are not unrankable. Recomputed from events; never hand-edited.
**Acceptance.** A user cannot review a transaction they were not party to, nor one that is not settled.

---

## Phase 11 — Messaging & Notifications

**Objective.** Per-transaction messaging and an in-app notification abstraction with channel adapters stubbed for WhatsApp/SMS/email (clearly unconfigured, not faked).
**Acceptance.** Only transaction participants read its messages.

---

## Phase 12 — Admin / Ops Console

**Objective.** Treated as a primary product — V0/V1 is a manually operated marketplace.
**Surfaces.** Verification queue · catalogue editor · transaction search and intervention · evidence review · payment confirmation · disputes · marketplace metrics (GMV excluding materials, completion, repeat rate).
**Security.** Admin routes guarded server-side by `profiles.role`, never by a client flag.
**Acceptance.** A non-admin receives 404/403 on every admin route and admin RPC.

---

## Phase 13 — Creator Vertical Migration

**Objective.** Carry the creator concepts into the generic model without polluting it.
**Mapping.** `Creator → Provider` · `Campaign → service_transaction` (`pricing_model='application'`) · `Deliverable → transaction_evidence` · `Creator Review → reviews`. Audience, platforms, engagement and portfolio live in `provider_categories.attributes` for the content category only.
**[REC]** Ships as a **seeded but not launched** category — architecture proven, catalogue narrow, per `docs/09-verticals.md`.
**Acceptance.** A content-category transaction runs the same engine with no creator-specific columns on `providers`.

---

## Phase 14 — QA & Security

Run the checks in `SECURITY.md`: cross-tenant reads, self-role escalation, client price/status tampering, private evidence access, review forgery, admin route access, storage policy. **Fix everything found.**

---

## Phase 15 — Launch Readiness

Typecheck, lint, build, Supabase advisors, seed a demo dataset **flagged as demo and confined to non-production**, and document the 30-day validation from `docs/11-roadmap.md` as the next business step.

---

## Deliberately NOT built (per brief §39 and `docs/11-roadmap.md`)

Native apps · AI matching or intake · lending, insurance or financial products · subscriptions · 100+ categories · nationwide rollout · complex bidding or lead-selling · automated background checks · automated dispute resolution · loyalty programmes · enterprise accounts · advanced analytics. The schema admits each later; none is scaffolded as a fake button.


---

## Build status (this session)

**Phases 0–9 and 12 implemented and applied to a live Supabase project.
Phases 10–11 partially implemented. Phases 13–15 partially done — see
gaps below.**

| Phase | Status |
|---|---|
| 0 — Audit | ✅ Done |
| 1 — Architecture | ✅ Done — see `ARCHITECTURE.md` |
| 2 — Database | ✅ Done, applied, verified — see `DATABASE.md` |
| 3 — Auth | ✅ Email/password only. Phone OTP not wired — needs an SMS provider. |
| 4 — Provider onboarding & verification | ✅ Application, admin review queue, category clearance all real and working against RLS |
| 5 — Service catalogue | ✅ Admin-editable schema; 4 services seeded, 1 with a full checklist |
| 6 — Customer booking | ✅ Real end-to-end: browse → book → server-resolved price → RPC |
| 7 — Transaction engine | ✅ Full state machine, all timers, applied |
| 8 — Evidence | ✅ In-app capture (photo/video), geotag attempt, checklist-gated submission |
| 9 — Payments | ✅ Honest manual adapter only. No real payment rail connected — see `SECURITY.md` |
| 10 — Reputation | ⚠️ Reliability score computed and displayed; Competence score schema exists but no UI surfaces it yet |
| 11 — Messaging/notifications | ⚠️ Schema and RLS complete; no UI built (not blocking the core booking flow) |
| 12 — Admin/Ops | ✅ Verification queue, payment confirmation, transaction list, overview stats — all real |
| 13 — Creator vertical migration | ⚠️ Category seeded (`business-content`), no services populated, no dedicated UI — correctly deferred per `docs/09-verticals.md`'s launch sequencing |
| 14 — QA & security | ⚠️ Database-layer security independently verified (see `SECURITY.md`). Live browser click-through NOT performed — blocked by this sandbox's network policy, not an application defect. Do this before declaring launch-ready. |
| 15 — Launch readiness | ⚠️ Build and typecheck clean. No automated tests. No demo data seeded (correctly — brief §49 prohibits fake data in production flows, and there are legitimately zero real bookings/providers yet). |

**The most important thing to do next, before anything else in this table:**
run the full customer → provider → admin journey in a real browser against
this live Supabase project, from an environment without this sandbox's
egress restriction. Nothing in this codebase is fake or stubbed, but
nothing has been click-tested end-to-end either, and those are different
claims — see `SECURITY.md` for the precise distinction.

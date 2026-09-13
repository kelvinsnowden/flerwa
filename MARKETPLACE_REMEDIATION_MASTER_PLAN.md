# Marketplace Remediation Master Plan

Status: **planning document only**. Nothing in this document or its companion
documents was implemented, migrated, committed, or pushed as part of writing
it. No production data was read in a way that could mutate it; no destructive
command was run; no external service was called. Where a claim below states
something has already been fixed, it is because it was implemented, tested,
and verified in an **earlier, separate session** on this same branch — see
the citation next to each such claim. This document does not re-verify those
older claims; it treats them as the most recent evidence on record and flags
anything that has not been independently re-checked.

## 0. How to read this document

This is the top-level strategy document. It does not repeat detail that
already exists and is current:

- **Database/RLS/performance findings**: `MARKETPLACE_SCALE_READINESS_AUDIT.md`
  (baseline audit) and its own §14 (implementation-status — what was actually
  fixed, with live verification, in the immediately preceding session: the
  auto-approve scheduler, 7 missing FK indexes, RLS `auth_rls_initplan` +
  `multiple_permissive_policies` fixes on `messages` and 3 shared predicate
  functions, bounded/paginated messaging queries, idempotent payment-webhook
  ingestion, idempotent request-mode booking, narrow catalog caching,
  Postgres-backed rate limiting on 5 actions, and `/api/health`).
- **UX/product-surface findings**: `MARKETPLACE_UX_AUDIT.md` (live
  click-through findings — zero published providers/supply on production as
  of that pass, catalog narrowness, onboarding gate inconsistency).
- **Security model, live-verified**: `SECURITY.md` (RLS shape, function grant
  surface, two real bugs found and fixed during the original build:
  `providers.is_published` self-escalation and a function-grant leak).
- **Business strategy, pricing, trust architecture, legal surface**:
  `docs/06` through `docs/14` — these are strategy documents, not
  implementation status, and are treated here as **decided direction unless
  flagged otherwise**, not as things to re-litigate.

This document, its 11 companion documents (§26), and the issue register
(`MARKETPLACE_REMEDIATION_REGISTER.md`) turn all of the above — plus the
gaps that inspection during this pass found and that no prior document
covers (trust & safety enforcement, fraud controls, dispute UI, refund
automation, provider-quality framework beyond identity, notification
delivery, disaster recovery, load-testing execution, release process,
analytics instrumentation) — into a single, evidence-graded, executable
plan.

**Calibration note, stated plainly rather than hidden:** the originating
task asks, for every lifecycle stage, all 18 failure-mode questions
(duplication, retry, late arrival, out-of-order events, disconnects, browser
close, provider timeout, provider disappearance, customer unreachability,
partial completion, fraud, admin repair, auditability, support resolvability,
reconciliation). Answering all 18 for all ~20 lifecycle stages independently
would be several hundred near-duplicate answers. Instead, §4 answers them
**once per mechanism** (the state machine, the idempotency layer, the ledger,
the admin repair tooling) and then maps every lifecycle stage to which
mechanisms cover it and which don't — this is the same information, ordered
so it can actually be acted on, not a smaller version of it.

## 1. Evidence classes used throughout this program

Every claim in the master plan, the register, and the 10 other companion
documents is tagged with one of:

| Tag | Meaning |
|---|---|
| **Confirmed (code)** | Read directly from the current repository — a migration, an RLS policy, a route handler, a server action. |
| **Confirmed (live DB)** | Verified by a live, read-only query or a role-simulated `begin; ...; rollback;` transaction against the connected Supabase project in a prior session (cited). |
| **Confirmed (test)** | An automated or manual test was actually run and passed. |
| **Not confirmed** | Plausible from code shape but not independently checked this pass. |
| **Missing** | Actively absent — grepped for and not found, or a table/column/function that would need to exist does not. |
| **Assumption** | Stated as a working assumption because verifying it requires access this session does not have. |
| **Blocked — external access** | Requires a Supabase, Vercel, IntaSend, Kora, or other dashboard/account this session cannot reach. |
| **Requires business decision** | No amount of engineering resolves it; a named person must decide. See `DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL` (§27, below). |
| **Requires legal review** | Carried over from `docs/14`'s own `[LEGAL — COUNSEL REQUIRED]` markers, not newly invented. |

## 2. What must be true — the eleven load-bearing questions

### 2.1 What could prevent this marketplace from operating safely?

**Confirmed (code/live DB):** the core financial state machine is
server-authoritative — every price, state transition, and payment
confirmation goes through a `SECURITY DEFINER` RPC that re-checks identity,
RLS is default-deny on all tables, and the two real authorization bugs found
during the original build (`providers.is_published` self-escalation,
function-grant leakage to `anon`) were fixed and verified (`SECURITY.md`
§8–9). A third, smaller instance of the same bug class was self-caught and
fixed in the immediately preceding session (`rpc_book_service` picked up an
unintended `anon` grant from a `CREATE OR REPLACE` that silently created a
second function overload — caught via a live `pg_proc` check, corrected in
the next commit; see `MARKETPLACE_SCALE_READINESS_AUDIT.md` §14).

**Missing:** there is no automated regression suite (`package.json` has no
test runner — confirmed repeatedly across three separate sessions). Every
"verified" claim in this codebase's history is a manual, one-time,
role-simulated SQL check or a live click-through — real, but **not
regression-proof**. A future change can silently reintroduce any of the
already-fixed bugs with nothing to catch it. This is **REG-001** in the
register and is the single highest-leverage safety investment available:
turning the ~40 manual verifications already performed across this
project's history into an executable suite that runs on every change.

**Missing:** no automated fraud/abuse detection exists at all (§7).
**Missing:** disputes have no time-bounded deadline in the schema
(`disputes` has no `deadline`/`expires_at` column — confirmed, §4/§17).
**Missing:** no disaster-recovery restore has ever been tested (§21).

### 2.2 What could cause financial loss or incorrect payment states?

Covered in full in `MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md`.
Headline: the payment architecture is currently `manual` only — no real
aggregator (IntaSend/Kora) is connected (**Confirmed, code**:
`payment_providers` seed row `is_active=true` for `key='manual'` only;
`INTASEND_SECRET_KEY` unset — `.env.example`). This means the two highest-risk
financial failure modes (webhook forgery, double-funding from webhook
retries) are **not yet live risks** because there is no live webhook traffic
— but the code paths for them (`rpc_ingest_payment_event`) were hardened and
verified idempotent in the immediately preceding session, ahead of actually
needing it. What **is** a live risk today: `rpc_confirm_manual_payment` is
admin-triggered and has no dual-control/second-approval requirement (a single
compromised or careless admin account can mark any transaction funded) — see
**PAY-004**.

### 2.3 What could cause customers or providers to lose trust?

Ranked by the strategy documents (`docs/14` items 1–5) as the ones that
"decide the outcome": horizontal over-expansion before liquidity, agency
fraud (a bribed inspector), and a safety incident. All three are
**process/product** risks, not yet **engineering** risks, because the
platform has zero real supply (`MARKETPLACE_UX_AUDIT.md` §12: 0 of 15
services has a single published provider) and therefore zero real
transactions. The engineering task is to have every control from `docs/06`
(structured evidence, dual coverage, conflict-of-interest declarations,
tiered verification) actually implemented **before** real supply is onboarded
— today, none of the tiered-verification (Tier 0–3), dual-coverage, or
conflict-of-interest mechanisms described in `docs/06` exist in code. This is
the largest gap in the entire program and is broken into concrete tasks in
`MARKETPLACE_TRUST_AND_SAFETY_PLAN.md`.

### 2.4 What could cause poor marketplace liquidity?

See §5 and `MARKETPLACE_ANALYTICS_AND_UNIT_ECONOMICS_PLAN.md`. Headline risk,
**Confirmed (live DB, prior session)**: zero published providers exist today.
No matching/ranking algorithm exists in code beyond `ilike` text search
(**Confirmed, code**: `src/app/page.tsx`'s services query). There is no
"time to first quote," "% zero-quote requests," or any liquidity metric
instrumented anywhere (**Missing**).

### 2.5 What could cause service quality to deteriorate?

No competence-evidence framework beyond a free-text `attributes` jsonb field
providers self-declare (`rpc_set_provider_category` — **Confirmed, code**: it
only ever writes `attributes`, never `is_cleared`). No random QA audit
mechanism. No repeat-offender tracking beyond the existing `reliability_scores`
table (whose write path is `recompute_reliability()`, not independently
re-verified this pass — **Not confirmed**).

### 2.6 What could cause the platform to fail under load?

Substantially addressed already: `MARKETPLACE_SCALE_READINESS_AUDIT.md` §14
lists 8 concrete fixes with live verification. What remains: **no load test
of any kind has ever been run** (§23/`MARKETPLACE_LOAD_TESTING_PLAN.md`), RLS
optimization is incomplete for ~25 of ~29 tables (only `messages` and 3
shared predicate functions were fixed), and infra plan limits
(Supabase/Vercel tier) remain unconfirmed (**Blocked — external access**,
carried over unresolved across three sessions now).

### 2.7 What could cause the company to lose money as usage grows?

`docs/10`'s own model: breakeven sits around KSh 120–150M GMV/month: cost to
serve must fall ~3× between early and mature scale, and average order value
is the dominant lever (same job count, 6× swing in gross profit across
AOV bands). Engineering's job is to make `cost to serve per completed job`
and `contribution per job` **actually measurable** — right now there is no
analytics pipeline computing either (**Missing**, `MARKETPLACE_ANALYTICS_AND_UNIT_ECONOMICS_PLAN.md`).

### 2.8 What could make the platform legally or operationally unsafe?

Carried over verbatim from `docs/14` (not re-derived — that document already
did this analysis with named legal citations) and turned into a checklist in
§16/`MARKETPLACE_SECURITY_AND_PRIVACY_REMEDIATION_PLAN.md`'s legal section.
Nothing in `docs/14`'s `[LEGAL — COUNSEL REQUIRED]` items has been resolved
by any engineering work to date — they remain exactly as open as when written.

### 2.9 What could happen during outages, fraud, disputes, failed payments, or partial completion?

Answered per-mechanism in §4 and in full in
`MARKETPLACE_TRANSACTION_STATE_MACHINE.md`,
`MARKETPLACE_TRUST_AND_SAFETY_PLAN.md`, and
`MARKETPLACE_DISASTER_RECOVERY_PLAN.md`.

### 2.10–2.14 What must be fixed before launch / 100 / 1,000 / 5,000 registered / 5,000 concurrent / new categories or cities?

Answered in full in §25 (roadmap) and cross-referenced to register items.

## 3. Marketplace-system organization, not just technical components

The register (`MARKETPLACE_REMEDIATION_REGISTER.md`) is organized by domain,
but every domain maps onto the customer/provider experience, not an
org-chart:

```
CUSTOMER JOURNEY                    PROVIDER JOURNEY
Discover → Search → Select         Apply → Verify → Publish
Book / Request → Pay               Get matched → Quote/Accept
Wait, message, track                Travel → Check in → Do the work
Approve or dispute                  Submit evidence → Get paid
Review                              Get reviewed → Build reputation
Repeat                              Repeat, or churn

           ↓ both sides touch these shared systems ↓
   Payments & ledger · Messaging · Notifications · Trust & Safety
   Admin & support tooling · Analytics · Infrastructure & scale
```

Every register item is tagged with which journey stage(s) and which shared
system(s) it affects (the register's "Affected system components" and a
lifecycle-stage tag), so a person planning "what do we need before we can
onboard the first 20 providers" can filter by provider-journey stage, and a
person planning "what do we need before accepting real M-Pesa payments" can
filter by the payments shared system.

## 4. The complete lifecycle, answered per-mechanism

Full detail lives in `MARKETPLACE_TRANSACTION_STATE_MACHINE.md`. Summary:

### 4.1 Source of truth and states, per stage

| Stage | Source of truth | States |
|---|---|---|
| Request/quote | `service_requests`, `quotes` | `service_requests.state`: open→converted/closed; `quotes.state`: pending/accepted/declined |
| Booking (fixed-price) | `service_transactions` | `draft→requested→quote_accepted→funded→checked_in→evidence→approved→released→settled→reviewed→closed`, plus `disputed`, `cancelled`, `revision_requested` |
| Payment | `payments`, `payment_provider_events`, `ledger_entries` | `payments.state`: funded (only state currently written); ledger is append-only |
| Messaging | `messages`, `conversations` | no state machine — append-only, RLS-scoped |
| Dispute | `disputes` | `open→...→resolved` (exact intermediate states **not confirmed** — `dispute_state` enum not re-read this pass; flagged for the register) |
| Review | `reviews` | write-once (no update/delete policy exists — **Confirmed, code**) |

### 4.2 Who is authorized to transition each state

**Confirmed (code, `SECURITY.md`):** every transition goes through a named
`SECURITY DEFINER` RPC that independently re-checks `auth.uid()`/`is_admin()`
— never a raw table UPDATE from the client (RLS grants no generic UPDATE
policy on `service_transactions` beyond `"txn admin update"`, itself
`is_admin()`-gated). This is the correct architecture and should be
preserved unconditionally (non-negotiable constraint #4 in the founding
brief, and re-confirmed here as still true).

### 4.3–4.18 The 16 failure-mode questions, answered once per mechanism

| Failure mode | Mechanism that answers it | Status |
|---|---|---|
| **Duplicated request** | Idempotency keys on `rpc_book_service` (customer-scoped) and `rpc_ingest_payment_event` (provider+reference+event_type) | **Confirmed (live DB, prior session)** — both implemented and verified. `rpc_submit_quote`/`rpc_accept_quote`/`rpc_start_conversation` have **no** idempotency key (**Missing** — TXN-010, TXN-011 in register). |
| **Retried request** | Same as above for the 2 covered RPCs. All other write RPCs (`rpc_provider_check_in`, `rpc_submit_completion`, `rpc_approve_and_release`, `rpc_cancel_booking`, `rpc_open_dispute`, `rpc_resolve_dispute`, `rpc_convert_deal_desk_request`) rely only on their own state guards (e.g. "must be in `requested` state") to make a retry a safe no-op-or-error, not a true idempotency key — a retry that arrives when the state has *already* moved past the expected precondition correctly errors, but two retries racing to be the *first* valid call are not provably safe without a `for update` lock (some have it — `_fund_transaction`, `rpc_accept_quote` — confirmed; others **not independently re-verified this pass**). |
| **Late-arriving response** | The state machine is the only truth; a late webhook or late RPC response either matches current state (safe) or is rejected by the guard (safe) — client-side "loading" UI is cosmetic, not authoritative. **Confirmed by design**, not independently load-tested. |
| **Out-of-order events** | `payment_provider_events` records every event regardless of order and only *acts* on `collection.completed`; an earlier "pending" event arriving after a later "completed" one is recorded but does not roll back the completed state (**Confirmed, code** — there is no compensating logic for this, which is correct: money already released should never be un-released by a stale event). |
| **Network disconnect mid-action** | Every RPC is a single Postgres transaction — a disconnect after the client sent the request but before receiving the response leaves the DB in a consistent (either fully applied or fully rolled back) state; the *client* doesn't know which, which is a UX problem (§14), not a data-integrity one. |
| **Browser/app closed mid-action** | Same as above — data integrity is fine; the user returns to whatever the true state is on next load, no "resume" mechanism exists or is needed for a single-RPC action. Multi-step client flows (the 5-step provider apply wizard) persist each step server-side on `Continue`, so a closed browser only loses the *current, unsubmitted* step (**Confirmed, code**, `MARKETPLACE_UX_AUDIT.md` §13). |
| **Payment provider timeout** | Not yet reachable (no real aggregator connected). Code path exists (`rpc_ingest_payment_event` records `processing_error` on any guard failure) but has never processed a real timeout. **PAY-002** in register. |
| **Provider disappears** | No no-show/timeout detection exists in code — `docs/07`'s "no-show → 100% refund, 3-in-90-days → suspension" rule is **not implemented** anywhere (**Missing** — TSF-005). |
| **Customer unreachable** | No unreachability detection exists; `docs/06`'s "customer fails to fund twice → book without prepayment restriction" rule is **not implemented** (**Missing** — TSF-006). |
| **Partial completion** | `transaction_checklist_results` supports per-item completion and `rpc_submit_completion` blocks on required items not done (**Confirmed, live DB, prior session** — verified against the Viewed For You checklist). No *prorated payment for partial work* exists — `docs/07`'s "work incomplete → prorated by scope items completed" rule is **not implemented** in any RPC (**Missing** — PAY-005). |
| **Fraud by either party** | Structured-evidence and dual-coverage controls from `docs/06` are **entirely unimplemented** — no in-app-capture enforcement (gallery uploads are not currently blocked — **Missing**, TSF-002), no geotagging requirement, no dual-inspector assignment, no conflict-of-interest declaration field. This is the single largest gap in the whole program relative to the strategy documents' own stated priority. |
| **Admin repair** | `rpc_resolve_dispute` and `rpc_convert_deal_desk_request` exist and are verified (`SECURITY.md`); there is no general-purpose "admin adjusts a stuck transaction" tool beyond those two specific RPCs — an admin who needs to fix something outside those two shapes has no sanctioned path other than a raw SQL statement run outside the app, which is exactly what `MARKETPLACE_OPERATIONS_AND_SUPPORT_PLAN.md` says must not be the normal support workflow (**OPS-002**). |
| **Auditability** | `transaction_events` and `ledger_entries` are both append-only (**Confirmed, live DB, prior session** — cleanup of test fixtures was blocked by this exact property, which is the control working as designed) and `admin_actions` records every admin RPC call. This is genuinely strong and should not be weakened. |
| **Support resolvability** | Currently **no**, without direct DB access — there is no admin transaction-detail view that surfaces `transaction_events` + `ledger_entries` + `payment_provider_events` + `messages` in one screen (**Missing** — OPS-001). |
| **Financial reconciliation** | No reconciliation job exists (comparing `ledger_entries` sums against an aggregator's settlement report) because there is no live aggregator yet — but the *ledger invariant* (`docs/07`: `Σ escrow_held + Σ materials_held + Σ provider_payable == aggregator settlement balance`) is not even checked against **itself** today (no job sums `ledger_entries` and asserts it balances) — **Missing**, PAY-006. |

## 5. Liquidity and matching — summary (full plan in Analytics doc + register)

**Confirmed (live DB, prior session):** 0 published providers exist across
all 15 services. This is not a code defect — the storefront/booking
machinery works end-to-end (verified via role simulation throughout the
project's history) — it is a **supply problem that cannot be solved by
engineering**. What engineering must do is:

1. **Instrument every liquidity metric named in `docs/13`** — none exist
   today (Missing: `time_to_assignment`, `fill_rate`, `coverage_depth`,
   `quote_rate`, `%_zero_quote_requests`). LIQ-001.
2. **Build the matching/ranking logic `docs/06`'s Trust Score describes** —
   today ranking is implicit list order from the DB query, not a computed
   score (**Missing** — LIQ-002).
3. **Build the "new provider guarantee" cold-start mechanism** (`docs/06`:
   platform-underwritten first 5 jobs) — **Missing**, LIQ-003, a genuine
   product feature with a real cost line, needs business sign-off on budget
   before building (**Requires business decision**).
4. **Category-by-category launch gating** — `docs/14`'s density rule ("≥5
   verified providers per active service with <24h availability before
   opening a new area") has no operational enforcement mechanism (no admin
   toggle to close a category/area) — **Missing**, LIQ-004.
5. **Zero-quote-request handling** — a customer whose request gets no quotes
   within a defined window has no fallback (no waitlist, no "we'll call you"
   escalation) — **Missing**, LIQ-005.

## 6. Provider quality — summary (full plan in Trust & Safety doc)

The founding brief for this task is explicit: **do not treat verified
identity as proof of competence.** Current state, **Confirmed (code)**:
`providers.verification_status` (admin-gated, guarded against
self-escalation) is the *only* trust signal enforced anywhere in the code.
The tiered model in `docs/06` (Tier 0 phone → Tier 1 ID+M-Pesa-match → Tier 2
address+references+category-assessment → Tier 3 Certificate of Good Conduct
+ interview + paid trial + conflict-of-interest) is **not implemented as
tiers** — there is one boolean-ish `verification_status` enum with no
concept of "which tier" or "which category this verification applies to."
This is PROV-001 and is the largest single schema gap identified in this
pass.

## 7. Trust, safety, fraud, and abuse — summary (full plan in dedicated doc)

Nearly everything in the founding brief's §7 list is **Missing**: no risk
scoring, no automated multi-accounting detection, no rate-based abuse
detection beyond the 5 actions rate-limited in the prior session (booking,
quoting, messaging, task-posting, signup — which cap *volume*, not
*fraud pattern*), no moderation queue, no report/flag mechanism on messages
or reviews, no evidence-tampering detection (no perceptual-hash duplicate
detection on uploaded photos, despite `docs/06` naming this explicitly), no
emergency-pause control. See `MARKETPLACE_TRUST_AND_SAFETY_PLAN.md` for the
full breakdown and remediation tasks.

## 8. Payments — summary (full plan in dedicated doc)

See §2.2 and `MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md`.

## 9–24. Cross-references

Sections 9 through 24 of the originating task brief (booking/idempotency
hardening, DB/RLS/performance, caching/jobs/rate-limiting, messaging/
realtime, notifications, mobile/PWA resilience, security/privacy, legal,
disputes/refunds/safety, admin/support, analytics, unit economics,
disaster recovery, release engineering, load testing, testing strategy) are
each answered in full in their own companion document (§26) and summarized
with concrete counts in the register. This master plan intentionally does
not duplicate that content here.

## 25. Staged execution roadmap

### Phase 0 — Immediate launch blockers (block accepting the first real transaction)

Objective: nothing here can corrupt money, leak identity documents, or leave
a transaction unrecoverable.

| # | Item | Register ID | Why Phase 0 |
|---|---|---|---|
| 1 | No automated test suite covering financial/auth RPCs | REG-001 | Every fix to date is a one-time manual check with nothing to catch a regression |
| 2 | Dual-control (2-person approval) missing on `rpc_confirm_manual_payment` and `rpc_resolve_dispute` | PAY-004, OPS-005 | A single admin account compromise can move real money with no second check |
| 3 | Disputes have no deadline/time-bound field | TXN-012 | Open-ended disputes have no forced resolution path |
| 4 | No admin transaction-detail "single pane of glass" view | OPS-001 | Support cannot resolve a real incident without raw SQL access, which itself is a risk |
| 5 | No reconciliation job asserting the ledger invariant holds | PAY-006 | The one check that would catch a ledger bug before a customer does, absent |
| 6 | No emergency transaction-pause / category-pause control | LIQ-004, TSF-014 | Cannot stop a bleeding category or a fraud pattern without a raw DB edit |
| 7 | Legal opinions not yet commissioned (PSP status, contractor classification, property-representation regulation) | LEGAL-001..003 | Taking money before this is resolved is an existential risk, not a technical one |
| 8 | No incident-response / safety-escalation protocol written | TSF-013 | `docs/06` calls a safety incident a "company-level event... decision made within hours" — nothing operational backs that today |
| 9 | Storage buckets have no malware/content scanning on uploads | SEC-011 | Identity documents and evidence photos are uploaded to buckets with MIME/size limits but no scanning |
| 10 | No backup-restore has ever been tested | DR-001 | "We have backups" is unverified until a restore has actually been performed |

**Exit criteria:** all 10 items Verified (not just Implemented) with evidence
attached in the register. **Required evidence:** a passing test run for
item 1; a documented and tested dual-control flow for item 2; a populated
`deadline` column with an enforcement job for item 3; a live-demoed admin
screen for item 4; a scheduled, alerting reconciliation job for item 5; a
demoed pause control for item 6; signed legal opinions for item 7; a written,
reviewed protocol for item 8; a scanning step in the upload path for item 9;
a completed restore-to-a-scratch-project test for item 10.

### Phase 1 — Minimum trustworthy marketplace

Objective: a real customer and a real provider can complete one real,
protected transaction end to end, with a human able to support it.

Work items: provider tiered-verification model (PROV-001..004), structured
evidence + in-app-only capture enforcement (TSF-001, TSF-002), no-show/
unreachable-party handling (TSF-005, TSF-006), admin transaction-detail view
completed (carried from Phase 0 if not finished), basic customer-facing
payment-status states (MOBILE-005), core funnel analytics (ANALYTICS-001..003),
security hardening pass on file uploads and Storage (SEC-010..012), support
queue triage (OPS-003, OPS-004), review-integrity checks already in place
(re-confirmed, not re-built), category-level policy docs (cancellation,
refund, dispute — LEGAL-004..006, **requires business decision** on the
actual numbers).

**Exit criteria:** one real transaction has been run through the full
lifecycle in a staging environment with a synthetic customer and provider,
including a deliberately-triggered dispute, resolved through the admin UI
(not raw SQL).

### Phase 2 — Early growth readiness

Objective: the platform can absorb organic growth to several hundred active
users without engineering babysitting every transaction.

Work items: the remaining RLS optimization for ~25 tables (PERF-002,
deferred from the prior session's own plan), notification delivery beyond
in-app (email at minimum — NOTIF-001), fraud/risk signals and a moderation
queue (TSF-003, TSF-007..010), liquidity instrumentation (LIQ-001, LIQ-002),
a real staging environment with synthetic data (LOADTEST-001), unit-economics
dashboarding (ANALYTICS-004), release-process formalization
(REL-001..003).

**Exit criteria:** staging environment exists and is used for every
migration before it touches production; at least one category has
`coverage_depth ≥ 5` in one launch corridor per `docs/14`'s density rule.

### Phase 3 — 5,000-user readiness

Objective: capacity is validated with real evidence, not projection.

Work items: the full staged load test (100→500→1,000→2,500→5,000 virtual
users) per `MARKETPLACE_LOAD_TESTING_PLAN.md`, infra plan-limit confirmation
(**Blocked — external access**, PERF-006), disaster-recovery drill executed
and timed (DR-002), on-call/escalation staffing decided
(**Requires business decision**), category-level contribution-margin
reporting live (ANALYTICS-005), incident-response process rehearsed.

**Exit criteria:** a load-test report exists with pass/fail against the
criteria in `MARKETPLACE_LOAD_TESTING_PLAN.md`, run against a staging
environment with synthetic data, never production.

### Phase 4 — Expansion readiness

New categories, new cities, native apps, provider tiers, automated risk
scoring, more sophisticated payouts. Out of scope for this planning pass
beyond naming it — every item here depends on Phases 0–3 being complete and
on category-level unit economics (`docs/10`) actually clearing the
thresholds decided in Phase 2/3, which is a business decision, not an
engineering one.

## 26. Companion documents

1. `MARKETPLACE_REMEDIATION_MASTER_PLAN.md` — this document.
2. `MARKETPLACE_REMEDIATION_REGISTER.md` — every issue, full field set.
3. `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` — full lifecycle detail.
4. `MARKETPLACE_TRUST_AND_SAFETY_PLAN.md`
5. `MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md`
6. `MARKETPLACE_OPERATIONS_AND_SUPPORT_PLAN.md`
7. `MARKETPLACE_SECURITY_AND_PRIVACY_REMEDIATION_PLAN.md`
8. `MARKETPLACE_DISASTER_RECOVERY_PLAN.md`
9. `MARKETPLACE_ANALYTICS_AND_UNIT_ECONOMICS_PLAN.md`
10. `MARKETPLACE_LOAD_TESTING_PLAN.md`
11. `MARKETPLACE_RELEASE_AND_ROLLBACK_PLAN.md`
12. `MARKETPLACE_DEFINITION_OF_DONE.md`

## 27. DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL

See the dedicated, complete list in
`MARKETPLACE_REMEDIATION_REGISTER.md`'s final section — kept there rather
than duplicated here so there is exactly one place decisions are tracked
against their downstream register items. The headline decisions, unresolved
as of this pass:

1. Which service categories/verticals launch first, and in which corridor —
   `docs/09`/`docs/14` give strong recommendations, not a final decision.
2. Platform fee model and exact percentages by vertical — `docs/10` gives a
   recommended model; not yet ratified as the number written into pricing
   code (**Confirmed, code**: the current live code hardcodes a flat 12%
   platform fee regardless of vertical, category, or repeat-pair status —
   `rpc_book_service`'s `v_fee := round(v_price * 0.12)` — which does not
   match `docs/10`'s vertical-differentiated table at all. This is a real,
   material gap between strategy and implementation, not just an unresolved
   decision — **PAY-007**).
3. What qualifies as "verified" at each tier, and the exact evidence
   required per category.
4. Cancellation/refund/dispute policy numbers (the `docs/07` failure matrix
   is a strong recommendation, not yet a ratified, published policy).
5. Whether/when to pursue a real payment aggregator integration (IntaSend
   go-live) and who owns that vendor relationship.
6. Legal engagement: which of the 6 `[LEGAL — COUNSEL REQUIRED]` items in
   `docs/14`/`docs/06`/`docs/07` get commissioned first, and budget
   (`docs/14` recommends KSh 1.2–2.0M).
7. Support hours, on-call ownership, and incident severity definitions.
8. Who is authorized to trigger a refund, a payout override, a provider ban,
   or an emergency category pause — currently, technically, any `is_admin()`
   account can do all four with no second approval (Phase 0 item).

## 28. Executive summary

See the final chat response accompanying this document for the required
concise executive summary (most serious risks, first 10 tasks, evidence
required to declare readiness). It is intentionally not duplicated here in
full — this document is the reference; the chat response is the digest.

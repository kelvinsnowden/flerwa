# Marketplace Admin Capability Matrix

Evidence-based inventory of every admin capability the platform needs, mapped
against what actually exists today. Every "Implemented" claim below was
checked against the real route/component/RPC — not assumed from a doc or a
page that merely renders data. Status values used throughout:

- **Implemented and verified** — code exists and its authorization/audit
  behavior was directly confirmed (grants, RLS, or a live/rollback-safe test).
- **Implemented but unsafe** — code exists but has a confirmed gap (missing
  audit trail, no dual control where the business needs it, etc).
- **Partially implemented** — some of the function exists (e.g. read-only
  visibility) but the action itself doesn't.
- **Missing** — nothing exists.
- **Blocked** — depends on an unresolved product/legal/finance/infra decision
  (cross-referenced to `MARKETPLACE_REMEDIATION_REGISTER.md`'s
  `DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL` list where applicable).
- **Not applicable** — deliberately out of scope for UI access (e.g. raw SQL).

Companion documents: `MARKETPLACE_REMEDIATION_REGISTER.md` (the standing
issue register — this matrix does not duplicate its P0–P3 severity items,
it cross-references them), `MARKETPLACE_TRANSACTION_STATE_MACHINE.md`,
`MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md`.

## How to read the per-area tables

Columns: **ID** · **Function** · **Status** · **Route/Component** ·
**RPC/API** · **Role** · **Risk** · **Audit req'd** · **Dual approval** ·
**Reversible** · **Priority** (Phase A/B/C/D per this doc's §"Implementation
phases", or "N/A" for read-only/low-stakes items) · **Decision blocker**
(cross-ref to the register's numbered list, or "—" if none).

"Role" uses today's actual model — a single binary `profiles.role = 'admin'`
(confirmed via `is_admin()`, `SECURITY.md`, and every RPC read this pass).
**There are no admin sub-roles today** — every function below that says
"Admin" therefore means *any* admin, full stop, which is itself the single
biggest gap in §P (Roles and Governance). Proposed future roles are noted
per-function only where they'd clearly change the intended reviewer.

---

## A. Operations Dashboard

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Dual approval | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|---|
| OPS-A1 | Pending verifications count | Implemented and verified | `/admin` (`page.tsx`) | direct query on `provider_verifications` | Admin | Low | N/A (read) | No | N/A | — | — |
| OPS-A2 | Payments-to-confirm count | Implemented and verified | `/admin` | direct query on `service_transactions` | Admin | Low | N/A | No | N/A | — | — |
| OPS-A3 | Open disputes count | Implemented and verified | `/admin` | direct query on `disputes` | Admin | Low | N/A | No | N/A | — | — |
| OPS-A4 | Settled-jobs count + GMV | Implemented and verified | `/admin` | direct query, `formatMoney` | Admin | Low | N/A | No | N/A | — | — |
| OPS-A5 | Auto-approve sweep status card | Implemented and verified | `/admin` | `scheduler_runs` (job `auto_approve_sweep`) | Admin | Low | N/A | No | N/A | — | — |
| OPS-A6 | Ledger reconciliation status card | Implemented and verified | `/admin` | `scheduler_runs` (job `ledger_reconciliation`) + `sendOpsAlert` on imbalance | Admin | Low | N/A | No | N/A | — | — |
| OPS-A7 | Bookings requiring intervention queue (evidence stuck, revision loops, overdue check-in) | Missing | — | — | Admin | Med | Yes (view only) | No | N/A | **A** | — |
| OPS-A8 | Overdue provider/customer action queue (quote not responded, evidence not submitted past SLA) | Missing | — | — | Admin | Med | No | No | N/A | **A** | — |
| OPS-A9 | Unreconciled-payment / orphaned-payment queue | Missing | — | — | Admin | High | Yes | No | N/A | **A** | — |
| OPS-A10 | Suspicious-activity feed | Missing | — | — | Admin | High | Yes | No | N/A | C | needs TSF risk-signal work first (see §J) |
| OPS-A11 | Emergency-paused categories indicator | Missing (no pause mechanism exists yet — see §R) | — | — | Admin | Med | N/A | No | N/A | B | depends on R1 existing first |
| OPS-A12 | Supply/demand by category, booking funnel, response-time trends | Missing | — | — | Admin | Low | N/A | No | N/A | D | — |
| OPS-A13 | Date-range / category / status filters on the dashboard | Missing (dashboard has zero filters today) | — | — | Admin | Low | N/A | No | N/A | A | — |
| OPS-A14 | "Requires attention" unified queue (single view aggregating A7–A10) | Missing | — | — | Admin | Med | N/A | No | N/A | **A** | — |

**Finding:** the dashboard today is 6 static numbers with no drill-down and
no filters — exactly the "decorative numbers" anti-pattern this task warns
against. None of the 6 existing tiles link anywhere; a click on "Open
disputes" should go to `/admin/disputes` pre-filtered, and doesn't.

---

## B. Bookings and Transactions

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Dual approval | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|---|
| BK-B1 | List all transactions | Implemented and verified | `/admin/transactions` | direct query, `.limit(100)` | Admin | Low | N/A | No | N/A | — | — |
| BK-B2 | Booking detail/timeline page (single transaction, full history) | Missing — the list links to the *customer-facing* `/account/bookings/[id]` page, which is scoped by RLS to the booking's own participants, not an admin detail view | — | — | Admin | Med | N/A | No | N/A | **A** | — |
| BK-B3 | Search by booking ID / customer / provider / phone / payment ref / status / date | Missing (no filters or search on the list at all) | — | — | Admin | Low | N/A | No | N/A | **A** | — |
| BK-B4 | State-transition history view | Partially implemented — `transaction_events` (append-only, confirmed via table comment) has the data; no admin UI reads it | — | `transaction_events` table | Admin | Low | N/A | No | N/A | **A** | — |
| BK-B5 | Pagination | Missing — hard `.limit(100)`, nothing beyond row 100 is reachable | — | — | Admin | Low | N/A | No | N/A | **A** | — |
| BK-B6 | Place booking under review / pause progression | Missing — no "hold" state exists in `txn_state` | — | — | Admin | Med | Yes | No | Yes | B | needs a state-machine addition, not a UI-only fix |
| BK-B7 | Cancel booking (admin-initiated) | Missing (customer-initiated `rpc_cancel_booking` exists; no admin equivalent) | — | — | Admin | High | Yes | Consider for funded txns | Partial (refund logic if funded) | B | TXN-005 fee-tiering still founder-blocked |
| BK-B8 | Initiate refund (admin, outside dispute) | Missing — only path to refund today is `rpc_resolve_dispute` (requires an open dispute) or `rpc_cancel_booking` (customer-only, pre-check-in) | — | — | Admin | High | Yes | **Yes**, above a threshold | No (money moves) | B | PAY-009/PAY-004 — refund policy + dual-control threshold unresolved |
| BK-B9 | Add internal admin notes to a booking | Missing (no `admin_notes` column/table exists on `service_transactions`) | — | — | Admin | Low | Yes | No | Yes | B | — |
| BK-B10 | Assign case owner / change priority | Missing | — | — | Admin | Low | Yes | No | Yes | C | — |
| BK-B11 | Escalate to supervisor | Missing (no supervisor role exists — see §P) | — | — | Admin | Low | Yes | No | Yes | C | needs role model first |
| BK-B12 | Export booking record | Missing | — | — | Admin | Med (PII) | Yes | No | N/A | D | — |
| BK-B13 | View messages/evidence/revisions/review linked to a booking, in one place | Partially implemented — each exists in its own table (`messages`, `transaction_evidence`, `transaction_checklist_results`, `reviews`) but no single admin view assembles them | — | — | Admin | Low | N/A | No | N/A | **A** | — |

**Finding:** this is the single largest gap relative to the task's own
framing — "an operations team should be able to run the marketplace without
developer intervention" is not true today for the most basic case (*"show
me everything about booking X"*), because there is no admin booking-detail
page at all. `/admin/transactions` is a flat, unfiltered 100-row list.

---

## C. Payments and Finance

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Dual approval | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PAY-C1 | Confirm manual payment | **Implemented and verified this pass** (was "unsafe" — no audit trail — until this pass; see `MARKETPLACE_REMEDIATION_REGISTER.md`) | `/admin/payments` | `rpc_confirm_manual_payment` — now logs to `admin_actions` | Admin | High | **Yes (fixed this pass)** | No (PAY-004: recommended, not built) | No | — | PAY-004 threshold/dual-control policy |
| PAY-C2 | Payment search (by reference, transaction, status) | Missing | — | — | Admin | Low | N/A | No | N/A | **A** | — |
| PAY-C3 | Payment event / webhook delivery history | Missing (`payment_provider_events` table exists, 0 rows today since no aggregator is connected — PAY-001) | — | `payment_provider_events` | Admin | Med | N/A | No | N/A | B | depends on PAY-001 |
| PAY-C4 | Duplicate webhook detection view | Missing — the *mechanism* exists (`payment_provider_events_dedupe_idx`, verified live this session) but nothing surfaces a dedupe hit to an admin | — | unique index on `(provider_key, external_reference, event_type)` | Admin | Low | N/A | No | N/A | B | — |
| PAY-C5 | Payment-to-ledger matching view | Missing | — | — | Admin | Med | N/A | No | N/A | B | — |
| PAY-C6 | Refund (partial) | Missing — no partial-refund path exists anywhere (PAY-005) | — | — | Admin | High | Yes | Yes | No | C | PAY-005 proration policy |
| PAY-C7 | Payment reversal | Missing | — | — | Admin | High | Yes | Yes | No | C | undefined policy |
| PAY-C8 | Ledger balance / reconciliation status | **Implemented and verified** (PAY-006, this continuation) | `/admin` status card | `rpc_check_ledger_balance`, `rpc_run_ledger_reconciliation`, daily cron + email alert | Admin (view) | Low (read) | N/A | No | N/A | — | — |
| PAY-C9 | Full ledger-entries browser (search by transaction_group/account_type) | Missing — data exists (`ledger_entries`, append-only, confirmed) but no UI | — | `ledger_entries` table | Admin | Med | N/A | No | N/A | **A** | — |
| PAY-C10 | Financial exports (daily reconciliation report, CSV) | Missing | — | — | Admin (finance role, once it exists) | Med | Yes | No | N/A | D | — |
| PAY-C11 | Orphaned payment/booking detection | Missing | — | — | Admin | High | Yes | No | N/A | B | — |
| PAY-C12 | Payment-provider activation (switch active aggregator) | **Implemented and verified this pass** — now gated on an explicit legal-signoff attestation before any `kind='aggregator'` provider can go live | `/admin/integrations` | `rpc_set_active_payment_provider`, `rpc_confirm_payment_provider_legal_signoff` (new this pass) | Admin | Critical | Yes | Recommended, not enforced in code | Yes (can switch back) | — | LEGAL-001/002/005/006/008 |
| PAY-C13 | Sandbox/test transaction visibility toggle | Missing (no `is_test` flag exists on `service_transactions`/`payments`) | — | — | Admin | Low | N/A | No | N/A | D | ties to the QA-fixture-data finding in the register |
| PAY-C14 | Webhook replay control | Not applicable for now | — | — | — | — | — | — | — | — | explicitly listed as "if safe" in the brief — not safe until idempotency is proven in production (PAY-001 unconnected), so deferred rather than built speculatively |

**Verified this pass, not merely re-stated:** `rpc_confirm_manual_payment`'s
missing audit trail (PAY-C1) was found by directly diffing every admin RPC
against `admin_actions` usage via `pg_get_functiondef` — it was the *only*
admin-gated RPC in the entire schema that didn't log. Fixed via migration
`20260913150829_audit_log_manual_payment_confirmation.sql`, applied live.

---

## D. Customers

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| CUST-D1 | Customer search | Missing | — | — | Admin | Med (PII) | N/A | N/A | **A** | — |
| CUST-D2 | Customer profile (booking/payment/dispute/review history) | Missing | — | — | Admin | Med | N/A | N/A | **A** | — |
| CUST-D3 | Account suspension | Missing — `profiles.role` exists but no `is_suspended`/restriction field or RPC | — | — | Admin | High | Yes | Yes | B | — |
| CUST-D4 | Account restoration | Missing (depends on D3) | — | — | Admin | Med | Yes | Yes | B | — |
| CUST-D5 | Risk indicators / fraud flags | Missing (no risk table exists — see §J) | — | — | Admin | Med | Yes | N/A | C | needs §J schema first |
| CUST-D6 | Internal notes | Missing | — | — | Admin | Low | Yes | Yes | B | — |
| CUST-D7 | Data export request (privacy) | Missing | — | — | Admin | High (legal) | Yes | N/A | C | LEGAL-007 retention periods |
| CUST-D8 | Account deletion workflow | Missing | — | — | Admin | High (legal) | Yes | **No** | C | LEGAL-004/007 — conflicts with financial/audit retention if built naively |
| CUST-D9 | Field-level sensitive-data masking (phone, ID number) for non-privileged admins | Missing — every admin sees every field today, since there is only one admin role | — | — | — | Med | N/A | N/A | C | needs §P role model first |

**Finding:** there is genuinely no customer-management surface at all. Every
customer-related admin need today is served by direct database access,
which is exactly the state this task asks to eliminate.

---

## E. Providers

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| PROV-E1 | Verification approve/reject | Implemented and verified | `/admin/verifications` | `rpc_set_verification_status` (logs to `admin_actions`, confirmed) | Admin | High | Yes | Yes (can re-set) | — | — |
| PROV-E2 | Category clearance toggle | Implemented and verified | `/admin/verifications` | `rpc_set_category_clearance` (logs, confirmed) | Admin | Med | Yes | Yes | — | — |
| PROV-E3 | Publish/unpublish provider | **Implemented and verified this pass** — was a direct `providers` table update with no audit trail; converted to `rpc_admin_set_provider_published`, which now logs to `admin_actions` | `/admin/verifications` | `rpc_admin_set_provider_published` (new this pass) | Admin | Med | Yes (fixed this pass) | Yes | — | — |
| PROV-E4 | Provider search / general profile view | Missing — no `/admin/providers` list exists at all; the only providers visible in admin UI are those in the verification queue | — | — | Admin | Low | N/A | N/A | **A** | — |
| PROV-E5 | Provider detail (earnings, completion rate, cancellation rate, disputes) | Missing | — | — | Admin | Med | N/A | N/A | **A** | — |
| PROV-E6 | Suspend / reinstate provider | Missing (no suspension mechanism for providers distinct from `verification_status`) | — | — | Admin | High | Yes | Yes | B | — |
| PROV-E7 | Restrict service category access post-verification | Partially implemented (E2 exists as an approve mechanism; no explicit "revoke" UI flow beyond re-toggling the same checkbox) | `/admin/verifications` | `rpc_set_category_clearance` | Admin | Med | Yes | Yes | B | — |
| PROV-E8 | Location/corridor access control | Missing (no concept of provider service-area restriction beyond `provider_service_areas`, which is self-managed) | — | — | Admin | Low | N/A | N/A | C | — |
| PROV-E9 | Provider notes | Missing | — | — | Admin | Low | Yes | Yes | B | — |
| PROV-E10 | Payout readiness / payout history | Not applicable yet — no payout feature exists (PAY-010, blocked on PAY-001) | — | — | — | — | — | — | — | PAY-001/010 |

---

## F. Provider Verification and Trust

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| VER-F1 | Verification queue (submitted docs) | Implemented and verified | `/admin/verifications` | direct query on `provider_verifications` | Admin | Med | N/A (view) | N/A | — | — |
| VER-F2 | Identity-check record view | Partially implemented — `identity_verification_checks` table exists (0 rows — no verification-provider connected yet) and `rpc_record_identity_check`/`rpc_submit_for_verification` exist, but no dedicated queue UI beyond the flat verifications list | `/admin/verifications` | `identity_verification_checks` | Admin | Med | N/A | N/A | B | — |
| VER-F3 | Document expiry tracking | Missing (no expiry field on any verification record) | — | — | Admin | Med | N/A | N/A | C | — |
| VER-F4 | Duplicate-account / identity-mismatch detection | Missing | — | — | Admin | High | Yes | N/A | C | — |
| VER-F5 | Verification appeal / re-verification workflow | Missing | — | — | Admin | Med | Yes | Yes | C | — |
| VER-F6 | Least-privilege access to identity documents (not every admin sees full docs by default) | Missing — today's single admin role means full document access for anyone who is an admin at all | — | — | — | High | N/A | N/A | C | needs §P role model |

---

## G. Service Catalog

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| CAT-G1 | Create/edit service | Missing (services were seeded via migrations, not an admin UI — confirmed no `/admin/services` route exists) | — | — | Admin (catalog manager) | Med | Yes | Yes | B | — |
| CAT-G2 | Publish/unpublish service | Missing | — | — | Admin | Med | Yes | Yes | B | — |
| CAT-G3 | Category management (create/edit/order) | Missing | — | — | Admin | Med | Yes | Yes | B | — |
| CAT-G4 | Pricing model edit (fixed vs. quote-required) | Missing | — | — | Admin | High (affects live pricing) | Yes | Yes | C | needs effective-dating design |
| CAT-G5 | Emergency category pause | Missing — `categories.is_active` column exists (confirmed, used by RLS) but **no admin UI toggles it** | — | `categories.is_active` | Admin | High | Yes | Yes | **B** (cheapest fix in §R) | — |
| CAT-G6 | Version history / rollback on catalog changes | Missing | — | — | Admin | Med | Yes | N/A | D | — |
| CAT-G7 | Bulk updates | Missing | — | — | Admin | Med | Yes | Depends | D | — |

**Finding:** `categories.is_active` already exists in the schema and is
already enforced by RLS — this is the cheapest possible win in the entire
Emergency Controls area (§R) once built, since it needs a UI toggle only,
no new schema or RPC.

---

## H. Requests, Quotes, and Matching

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| REQ-H1 | Deal Desk request queue | Implemented and verified | `/admin/deal-desk` | `rpc_convert_deal_desk_request`, `rpc_decline_deal_desk_request` (both log to `admin_actions`, confirmed) | Admin | Med | Yes | Convert: no. Decline: no. | — | — |
| REQ-H2 | General request queue (`service_requests`, task-mode) | Missing — Deal Desk covers off-platform provider-submitted leads; the customer-initiated `service_requests`/`quotes` flow (task posting) has no admin visibility at all | — | `service_requests`, `quotes` tables | Admin | Low | N/A | N/A | B | — |
| REQ-H3 | Quote comparison / matching-failure view | Missing | — | — | Admin | Low | N/A | N/A | C | — |
| REQ-H4 | Unserved-request detection (no quotes received) | Missing | — | — | Admin | Med (liquidity signal) | N/A | N/A | C | — |
| REQ-H5 | Manual provider invitation to a request | Missing | — | — | Admin | Low | Yes | N/A | D | — |

---

## I. Disputes, Support, and Case Management

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Dual approval | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|---|
| DIS-I1 | Dispute queue (open disputes) | Implemented and verified | `/admin/disputes` | direct query | Admin | Med | N/A (view) | No | N/A | — | — |
| DIS-I2 | Resolve dispute (split provider/customer amounts) | Implemented and verified | `/admin/disputes` | `rpc_resolve_dispute` (logs, confirmed; row-locked `for update`, confirmed lock audit) | Admin | High | Yes | No (recommended, not enforced) | No (money moves) | — | PAY-004 dual-control policy |
| DIS-I3 | Case priority / severity / SLA deadline | Missing — `disputes` has no deadline field (TXN-004, register) | — | — | Admin | Med | Yes | N/A | Yes | B | TXN-004 |
| DIS-I4 | Case assignment / reassignment | Missing (no assignee field) | — | — | Admin | Low | Yes | N/A | Yes | B | — |
| DIS-I5 | Internal notes vs. customer-visible notes distinction | Missing | — | — | Admin | Low | Yes | N/A | Yes | B | — |
| DIS-I6 | Response templates | Missing | — | — | Admin | Low | N/A | N/A | D | — |
| DIS-I7 | Appeal workflow | Missing | — | — | Admin | Med | Yes | N/A | C | — |
| DIS-I8 | General support inbox (non-dispute cases) | Missing — there is no support-case concept distinct from a dispute at all | — | — | Admin | Med | Yes | N/A | C | founder decision: is support routed through disputes or a separate system? |
| DIS-I9 | Reopen a closed dispute | Missing (`rpc_resolve_dispute` sets `state='resolved'`; nothing reverses it) | — | — | Admin | High | Yes | **Yes** | Partial | C | policy: when is reopening allowed |

---

## J. Trust, Safety, Fraud, and Risk

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| RISK-J1 | Risk/suspicious-activity queue | Missing — no `risk_flags`/fraud-signal table exists anywhere in the schema (confirmed via `list_tables`) | — | — | — | High | — | — | C | needs schema design — TSF-009 in register |
| RISK-J2 | Repeated-cancellation detection | Missing | — | — | — | Med | — | — | C | depends on J1 |
| RISK-J3 | Multiple-account / duplicate-identity detection | Missing | — | — | — | High | — | — | C | depends on J1, F4 |
| RISK-J4 | Off-platform-payment-attempt detection | Missing (no message-content scanning exists) | — | — | — | High | — | — | D | — |
| RISK-J5 | Harassment/abuse report intake | Missing — no `reports`/`flags` table (TSF-007, register, confirmed) | — | — | — | High | — | — | **B** | TSF-007 is P0 in the register for the user-facing side; admin queue depends on it existing |
| RISK-J6 | Temporary account/category hold | Missing (see §R) | — | — | — | High | — | — | B | — |
| RISK-J7 | Safety-incident report + timeline | Missing | — | — | — | High | — | — | C | needs TSF-013 written protocol first (register) |
| RISK-J8 | Escalation to legal/law enforcement | Not applicable for UI — this is a human process, not a button. Document the runbook (TSF-013), don't build a "call police" action. | — | — | — | — | — | — | — | — |

**Finding:** this entire area is unbuilt from the schema up. It cannot be
"implemented" as an admin UI feature without first deciding what a risk
signal even is (TSF-009 in the register already says the same). Nothing
here should be faked with placeholder heuristics.

---

## K. Reviews and Moderation

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| REV-K1 | Review queue | Missing (no admin view of `reviews` at all) | — | — | Admin | Low | N/A | N/A | B | — |
| REV-K2 | Reported/flagged review handling | Missing — depends on J5 (report mechanism) existing first | — | — | Admin | Med | Yes | N/A | C | TSF-007 |
| REV-K3 | Hide/unhide review | Missing (no `is_hidden`/visibility field on `reviews`) | — | — | Admin | Med | Yes | Yes | C | — |
| REV-K4 | Silent edit of a review | **Not applicable — must never be built.** The task explicitly forbids this; noted here only to record that it was considered and rejected. | — | — | — | — | — | — | — | — |

---

## L. Messaging and Notifications

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| MSG-L1 | Conversation search (admin) | Missing — `messages`/`conversations` have no admin read path at all | — | — | Admin | Med (privacy) | N/A | N/A | C | — |
| MSG-L2 | Reported-message handling | Missing (depends on J5) | — | — | Admin | Med | Yes | N/A | C | TSF-007 |
| MSG-L3 | Notification delivery status | Partially implemented — `notifications` table exists and is populated (2 rows, confirmed); no admin view of delivery/read status | — | `notifications` table | Admin | Low | N/A | N/A | D | — |
| MSG-L4 | Resend notification | Missing | — | — | Admin | Low | Yes | N/A | D | — |
| MSG-L5 | "Send as support" impersonation-labeled message | Missing — genuinely not built, correctly, since it needs the explicit labeling/audit the brief requires; do not build without that | — | — | Admin | Med | Yes | N/A | D | — |
| MSG-L6 | Email/SMS/WhatsApp delivery history | Not applicable yet — no external notification channel is connected (NOTIF-001/002, register) | — | — | — | — | — | — | — | NOTIF-001/002 vendor decision |

---

## M. Analytics and Reports

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| AN-M1 | GMV (settled, service-amount-only) | Implemented and verified — correctly excludes materials pass-through per `docs/10`, confirmed in `/admin/page.tsx` source | `/admin` | direct query | Admin | Low | N/A | N/A | — | — |
| AN-M2 | Net platform revenue / fees | Missing (GMV shown; fee/net revenue is not) | — | — | Admin | Low | N/A | N/A | D | — |
| AN-M3 | Cancellation/dispute/refund rate | Missing | — | — | Admin | Low | N/A | N/A | D | — |
| AN-M4 | Category/service-area performance | Missing | — | — | Admin | Low | N/A | N/A | D | — |
| AN-M5 | Cohort retention, unit economics, contribution margin | Missing — `MARKETPLACE_ANALYTICS_AND_UNIT_ECONOMICS_PLAN.md` documents the model; nothing computes it live | — | — | Admin (analyst) | Low | N/A | N/A | D | — |
| AN-M6 | Exports | Missing | — | — | Admin | Med | Yes | N/A | D | — |

---

## N. Audit Logs

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| AUD-N1 | Append-only `admin_actions` table | Implemented and verified — confirmed no INSERT policy exists for any client role (RLS: `SELECT` only, `is_admin()`), so it is genuinely append-only from the app's side | — | `admin_actions` | — | — | — | N/A (append-only) | — | — |
| AUD-N2 | Audit-log viewer UI | **Implemented and verified this pass** — new `/admin/audit-log` page: filter by action (substring) and target table, pagination (50/page), admin-name resolution, JSON payload detail per row, correct empty/error states | `/admin/audit-log` (new) | reads `admin_actions` directly, RLS-gated | Admin | Low (read) | N/A | N/A | — | — |
| AUD-N3 | Coverage — every privileged action actually logs | **Implemented and verified this pass** — found and fixed the two admin-privileged actions in the entire schema with no `admin_actions` entry: `rpc_confirm_manual_payment` (PAY-C1) and provider publish/unpublish (PROV-E3). Every other admin-gated RPC was confirmed (via `pg_get_functiondef`) to already log. | — | — | Admin | Low | Yes | N/A | — | — |
| AUD-N4 | IP/device metadata on audit rows | Missing — `admin_actions` has no such columns (confirmed via `information_schema.columns`) | — | — | — | Low | — | — | D | only if lawfully collected — no decision made either way yet |
| AUD-N5 | Before/after values on state-changing actions | Partially implemented — `payload` is free-form jsonb per-RPC; some (`rpc_resolve_dispute`) include the decision detail, none systematically capture before/after | — | — | — | Low | — | — | C | — |
| AUD-N6 | Correlation/request ID | Missing | — | — | — | Low | — | — | D | — |

---

## O. System Health and Background Jobs

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| SYS-O1 | Auto-approve sweep last-run status | Implemented and verified | `/admin` | `scheduler_runs` | Admin | Low | N/A | N/A | — | — |
| SYS-O2 | Ledger reconciliation last-run status + alert | Implemented and verified this continuation (alert added this pass, delivery blocked on Resend domain setup — see register) | `/admin` | `scheduler_runs`, `sendOpsAlert` | Admin | Low | N/A | N/A | — | — |
| SYS-O3 | Dedicated scheduler/jobs history view (not just "last run") | Missing — `scheduler_runs` has full history; only the single latest row per job is surfaced | — | `scheduler_runs` | Admin | Low | N/A | N/A | **A** | — |
| SYS-O4 | `/api/health` endpoint | Implemented but unverified in production (confirmed to correctly return 503 on DB-unreachable in the prior session's local test; 200-on-healthy path never observed against the real deployment — Vercel project access gap, register) | `/api/health` | direct DB ping | — | — | — | — | — | — |
| SYS-O5 | Admin-visible system-health page (aggregates O1–O4, Vercel/Supabase status) | Missing | — | — | Admin | Low | N/A | N/A | B | — |
| SYS-O6 | Retry a safe idempotent failed job from the UI | Missing | — | — | Admin | Med | Yes | Yes (idempotent by design) | C | — |
| SYS-O7 | Pause/resume a scheduler from the UI | Missing (no on/off flag on any scheduled job) | — | — | Admin | Med | Yes | Yes | C | — |
| SYS-O8 | Arbitrary SQL execution in Admin UI | **Not applicable — explicitly forbidden by this task's own rules; never build this.** | — | — | — | — | — | — | — | — |

---

## P. Roles, Permissions, and Admin Governance

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| GOV-P1 | Any admin sub-role beyond the single binary `is_admin()` | Missing — confirmed via `SECURITY.md` and every RPC read this session: `profiles.role = 'admin'` is the entire model | — | `is_admin()` | — | High (systemic) | — | — | **C** | founder decision: which roles, per §P's own proposed list |
| GOV-P2 | Role assignment UI | Missing (depends on P1) | — | — | Super admin (proposed) | High | Yes | Yes | C | depends on P1 |
| GOV-P3 | Permission matrix / per-action authorization beyond "is admin" | Missing — every admin RPC checks `is_admin()` only, confirmed across all 20 admin-gated functions read this session | — | — | — | High | — | — | C | depends on P1 |
| GOV-P4 | Dual control for high-impact actions | Missing everywhere it's recommended (PAY-004, refunds, bans) — confirmed no RPC in the schema implements a two-step approval pattern | — | — | — | High | — | — | **C** | founder decision #8 in the register |
| GOV-P5 | Privileged reauthentication (step-up auth before a dangerous action) | Missing | — | — | — | Med | — | — | D | — |
| GOV-P6 | Admin session/access review | Missing | — | — | Super admin | Med | Yes | N/A | D | — |
| GOV-P7 | Admin activity report (who did what, this week) | Partially implemented — `admin_actions` + the new §N audit-log viewer make this queryable manually; no dedicated report/summary view | `/admin/audit-log` | `admin_actions` | Admin | Low | N/A | N/A | C | — |

**This is the load-bearing gap for the entire capability model.** Nearly
every "dual approval" and "restricted to X role" cell above depends on P1–P4
existing. Building granular roles is explicitly Phase C in this document's
own phase plan (§ Implementation phases) — not attempted this pass, and
correctly so: retrofitting roles onto 20+ already-shipped admin RPCs is a
real migration project, not a quick add, and guessing the role boundaries
without founder input would be exactly the kind of policy invention this
task's Safety and decision rules forbid.

---

## Q. Privacy and Data Governance

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| PRIV-Q1 | Data-access/export request handling | Missing | — | — | — | High (legal) | — | — | C | LEGAL-007 |
| PRIV-Q2 | Deletion request handling | Missing | — | — | — | High (legal) | — | — | C | LEGAL-004/007 — must not conflict with financial/audit retention |
| PRIV-Q3 | Consent/communication-preference history | Missing (no consent table exists) | — | — | — | Med | — | — | D | — |
| PRIV-Q4 | Legal hold | Missing | — | — | — | High | — | — | D | — |
| PRIV-Q5 | Retention-period enforcement (esp. identity documents) | Missing — SEC-012 in the register already names this exact gap (P0, blocked on LEGAL-007) | — | — | — | High | — | — | — | LEGAL-007 |

**No implementation attempted here this pass** — every item is explicitly
gated on an unresolved legal decision (LEGAL-004/007), consistent with this
task's own instruction not to guess retention/privacy policy.

---

## R. Emergency Controls

| ID | Function | Status | Route/Component | RPC/API | Role | Risk | Audit | Reversible | Priority | Decision blocker |
|---|---|---|---|---|---|---|---|---|---|---|
| EMG-R1 | Category pause toggle | Missing UI — `categories.is_active` column + RLS enforcement already exist (confirmed), just no admin control surface | — | `categories.is_active` | Admin | High | Yes | Yes | **B (cheapest win in this whole section)** | — |
| EMG-R2 | Geographic corridor pause | Missing (no corridor/region concept beyond `locations`) | — | — | — | High | — | — | C | — |
| EMG-R3 | Pause new bookings platform-wide | Missing | — | — | — | Critical | — | — | C | needs a global switch design + founder sign-off on when it's used |
| EMG-R4 | Pause provider onboarding | Missing | — | — | — | Med | — | — | C | — |
| EMG-R5 | Disable a payment method | Partially implemented — switching the *active* aggregator (`rpc_set_active_payment_provider`) is a coarse version of this; no per-method (e.g. "disable M-Pesa Till specifically") granularity | `/admin/integrations` | `rpc_set_active_payment_provider` | Admin | Critical | Yes | Yes | — | — |
| EMG-R6 | Maintenance mode | Missing | — | — | — | High | — | — | C | — |
| EMG-R7 | Freeze payouts | Not applicable yet — no payout feature exists | — | — | — | — | — | — | — | PAY-001/010 |
| EMG-R8 | Disable a compromised account | Missing (depends on §D/§E suspension mechanisms) | — | — | — | High | — | — | C | depends on D3/E6 |
| EMG-R9 | Emergency incident banner | Missing | — | — | — | Low | — | — | D | — |
| EMG-R10 | Every emergency control's scope/reason/actor/expiry/audit | Not applicable — no controls are built yet to apply this pattern to; **the pattern itself is the right one and should be the template for R1 onward** (a generic `emergency_controls` table: scope, target, reason, actor, expiry, active) | — | — | — | — | — | — | — | — |

**Not implemented this pass, deliberately.** R1 (category pause) is genuinely
the cheapest, safest starting point — the schema already supports it — but
it's still a new admin action with real blast radius (it stops customers
from booking an entire category), and building it well means the generic
`emergency_controls` audit pattern (R10) at the same time, not a one-off
toggle. That's real scope for a dedicated pass, not a same-session add-on
to an already-large capability-matrix pass.

---

## Implementation phases (as executed / recommended)

**Phase A — Critical operational visibility.** This pass implemented the
smallest, highest-leverage Phase A items that were both safe and fully
within reach without new schema decisions: the **audit-log viewer**
(AUD-N2), and closing the audit-trail gap on **both** admin-privileged
actions found to be missing one — `rpc_confirm_manual_payment` (PAY-C1, the
single highest-stakes existing action in the app) and provider publish/
unpublish (PROV-E3). Everything else marked **A** above
— booking detail/timeline, transaction search/pagination, a unified
"requires attention" queue, ledger-entries browser, provider list/detail —
is real, scoped, unblocked Phase A work **not done this pass**, given the
size of this single request; see "Recommended next step" in the final
report.

**Phase B — Safe operational actions.** Category emergency pause (EMG-R1)
is the standout candidate: schema already exists, RLS already enforces it,
only a UI + audit-logged RPC wrapper is needed. Provider suspend/reinstate,
admin booking notes, and case assignment are the next tier.

**Phase C — Governance and safety.** Correctly sequenced last, not first:
granular roles (GOV-P1–P4) and dual control (PAY-004) are large, and every
other area's "who can approve this" column depends on them. Building roles
before the actions that need them exist would mean guessing at boundaries.

**Phase D — Analytics and optimization.** Correctly last — nothing here
blocks operational safety, and several items (AN-M5, cohort retention)
depend on enough real transaction volume to be meaningful, which the
platform doesn't have yet (see the register's QA-fixture-data finding —
production has zero real users today).

No phase reordering was needed relative to the task's own suggested order —
the codebase inspection confirmed the same priority the task assumed:
visibility gaps (A) are the worst gaps today, governance (C) is real but
correctly sequenced after the actions it would govern exist.

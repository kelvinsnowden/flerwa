# Marketplace Transaction State Machine

Companion to `MARKETPLACE_REMEDIATION_MASTER_PLAN.md` §4 and the register's
`TXN-*` items. This document is the authoritative map of every state, every
legal transition, and every actor authorized to cause it — current state as
of this pass, evidence-tagged per `MASTER_PLAN.md` §1.

**Correction (marketplace remediation continuation pass):** the original
version of this document understated `txn_state`'s real value set and left
several RPCs' lock discipline unverified. Both are corrected below — see
`MARKETPLACE_REMEDIATION_GAP_ANALYSIS.md` §4 for what changed and why.

## 1. `service_transactions` — the spine

**Confirmed (code):** the real `txn_state` enum
(`supabase/migrations/20260908133816_core_schema.sql`) has 21 values, not
the simplified subset previously documented here:
`draft, requested, quoted, quote_accepted, funded, scheduled, en_route,
checked_in, in_progress, evidence_submitted, customer_review,
revision_requested, approved, released, settled, reviewed, closed,
cancelled_by_customer, cancelled_by_provider, expired, disputed, refunded`.
The simplified diagram below shows the states the currently-implemented
RPCs actually exercise — `quoted`, `scheduled`, `en_route`, `in_progress`,
`customer_review`, `cancelled_by_provider`, and `expired` exist in the type
but were **not found to be written by any current RPC** (re-checked this
pass; not exhaustively grepped against every function body, so treat their
absence below as "not observed," not "provably unreachable").

```
draft ──► requested ──► quote_accepted ──► funded ──► checked_in ──► evidence_submitted
                                                                        │
                                                                        ▼
                                            revision_requested ◄── approved
                                                   │                    │
                                                   └──────────────────► released ──► settled ──► reviewed ──► closed

  funded, pre-check-in ──► cancelled_by_customer (100% refund) or refunded
                            (rpc_cancel_booking — customer-only; re-read in
                            full this pass. Flat 100% refund, NO time-tiered
                            fee split per docs/07's >24h/<24h/after-check-in
                            matrix — confirmed NOT implemented, TXN-005/
                            PAY-009. Blocked entirely once checked_in — the
                            RPC raises rather than allowing a post-check-in
                            cancellation at all.)
  Any state after `funded`    ──► disputed    (rpc_open_dispute)
  disputed                    ──► settled | refunded   (rpc_resolve_dispute, admin-gated, financial split)
```

**Confirmed (code):** `service_transactions.state` is a Postgres enum
(`txn_state`), and the *only* write paths are the `SECURITY DEFINER` RPCs
listed below — RLS grants no generic client UPDATE (`SECURITY.md` §3, §7,
re-confirmed this pass by re-reading `20260908134652_rls_policies.sql`:
`"txn admin update"` is the only UPDATE policy, `is_admin()`-gated).

| Transition | RPC | Authorized caller | Guard | Lock discipline |
|---|---|---|---|---|
| → `requested` | `rpc_book_service` | Any authenticated customer | Service active, provider cleared for category if specified | N/A (insert) — idempotent via customer-scoped key (Confirmed, live DB, prior session) |
| `requested`/`quote_accepted` → `funded` | `rpc_confirm_manual_payment` (admin) or `rpc_ingest_payment_event`→`_fund_transaction` (webhook) | Admin, or trusted server webhook path | Transaction fundable state + amount/currency match (webhook path) | `_fund_transaction` uses `select ... for update` (Confirmed, code) |
| `funded`/`scheduled` → `checked_in` | `rpc_provider_check_in` | The assigned provider only | `providers.user_id = auth.uid()` (join-scoped select, not a separate RLS check) | `select ... for update` — **Confirmed, code, re-read in full this pass** |
| `checked_in`/`in_progress`/`revision_requested` → `evidence_submitted` | `rpc_submit_completion` | The assigned provider only | Every `is_required` checklist item must have a completed `transaction_checklist_results` row, or the RPC raises (Confirmed, live DB, prior session — Viewed For You test); sets `auto_approve_at = now() + 5 days` | `select ... for update` — **Confirmed, code, re-read in full this pass** |
| `evidence_submitted` → `approved`/`released` | `rpc_approve_and_release` | Customer, admin, or the auto-approve sweep (5-day silence) | — | **Not independently re-verified this pass** — TXN-003 (2 of 5 originally-flagged RPCs now closed; this one remains open) |
| `evidence` → `revision_requested` | `rpc_request_revision` | Customer | — | **Not independently re-verified this pass** |
| `approved` → `released` | (same RPC as approval, or a distinct step — **not independently re-verified this pass whether these are one RPC call or two**) | — | — | — |
| `released` → `settled` | — | — | — | — |
| any funded+ state → `disputed` | `rpc_open_dispute` | Either participant | — | — |
| `disputed` → `settled`/`refunded` | `rpc_resolve_dispute` | Admin only | Split must sum to service amount (Confirmed, live DB, prior session) | — |
| any pre-released state → `cancelled` | `rpc_cancel_booking` | Customer or provider (exact authorization split **not independently re-verified this pass**) | — | — |

**Open items from this pass, filed in the register:** TXN-003 (lock audit on
5 RPCs), TXN-005 (cancellation-fee logic unverified), PAY-009 (refund path
independent of dispute unverified).

## 2. `payments` / `payment_provider_events` / `ledger_entries`

```
payment_provider_events (append-only, every inbound webhook recorded
  regardless of outcome)
        │
        │  only on event_type='collection.completed' AND every guard passes
        ▼
   _fund_transaction()
        │
        ├──► payments row inserted (state='funded' — the only state this
        │    codebase currently writes; no 'failed'/'refunded' payments
        │    row shape confirmed to exist — Not confirmed)
        │
        └──► ledger_entries: 3 balanced rows per funding event
             (customer_receivable debit, funds_held credit,
              materials_held credit)
```

**Idempotency (Confirmed, live DB, prior session):**
`rpc_ingest_payment_event` dedupes on `(provider_key, external_reference,
event_type)` via a partial unique index — a retried webhook delivery is a
provable no-op, verified live (2 identical deliveries → 1 event, 1 funding).

**What is NOT yet true:** no `payments` row transitions to any state other
than `funded` (no refund/reversal row shape confirmed) — PAY-009. No
reconciliation job ever asserts `Σ ledger_entries` balances — PAY-006. No
real aggregator is connected, so this entire pipeline has zero live-traffic
verification — PAY-001, PAY-002.

## 3. `quotes` / `service_requests`

```
service_requests: open ──► converted (via accepted quote OR Deal Desk) ──► closed
                     └──► closed (customer/admin cancels with no acceptance)

quotes: pending ──► accepted (one quote; all siblings auto-declined
                     under `for update` locks — Confirmed, code,
                     SECURITY.md §10)
          └──► declined
```

**Confirmed (code):** capped at 5 quotes/request (`trg_enforce_quote_cap`),
one quote per provider per request (`unique(request_id, provider_id)`,
which doubles as the duplicate-submission guard — TXN-001/002 in the
register, downgraded from "needs an idempotency key" to "UX-only gap" on
this basis).

**Missing:** no expiry on a `pending` quote (TXN-008); no fallback when a
request gets zero quotes (LIQ-003).

## 4. `disputes`

```
open ──► (states between here are DEFINED IN STRATEGY, docs/06's 5-tier
          ladder — L0 self-serve, L1 guided, L2 auto, L3 mediation,
          L4 adjudicate — but NOT represented as distinct `dispute_state`
          enum values in the schema; Not confirmed whether the enum has
          intermediate values or only open/resolved)
      ──► resolved (via rpc_resolve_dispute, financial_outcome recorded)
```

**The single largest gap in this state machine:** no `deadline` field
exists (TXN-004, register P0) — the 5-tier ladder's own timers (0–24h,
48h, 72h, 5 days) have no enforcement. An open dispute can sit
indefinitely with nothing forcing resolution.

## 5. `reviews`

Write-once, gated to `settled`/`reviewed`/`closed` transactions
(`SECURITY.md` §6, re-confirmed this pass). No state machine — a review
either exists or doesn't. No edit, no delete (Confirmed, code — no such RLS
policy exists). This is a deliberate, correct design (anti-gaming keystone
per `docs/06`) and should not change.

## 6. Cross-cutting: what's true for every state machine above

- **Server-authoritative, always.** No client ever writes a state directly;
  every transition is a named RPC. This is the correct architecture and is
  the one constraint in this entire program that should never be weakened
  for any reason, including performance.
- **Auditability.** `transaction_events` (append-only) and `admin_actions`
  record every meaningful transition and every admin action respectively —
  genuinely strong, confirmed multiple times across sessions by the fact
  that test-fixture cleanup was *blocked* by these append-only guards
  working as designed.
- **What's missing across all of them:** a generic "admin repair" path for
  states that fall outside the two existing repair RPCs (OPS-002); SLA/
  deadline enforcement beyond the auto-approve sweep (TXN-004 for disputes;
  TXN-008/009 for quotes/bookings); genuinely concurrent-load verification
  of the lock discipline (LOADTEST-003).

## 7. Recommended next engineering steps, in dependency order

1. Read the exact current bodies of `rpc_provider_check_in`,
   `rpc_submit_completion`, `rpc_request_revision`, `rpc_cancel_booking`,
   `rpc_open_dispute` in full (TXN-003) — this state machine document
   currently has several "Not independently re-verified this pass" gaps
   that a direct read would close cheaply, before any other transaction-
   layer work proceeds.
2. Add `disputes.sla_deadline` and the sweep that enforces it (TXN-004).
3. Confirm and, if needed, fix `rpc_cancel_booking`'s financial handling
   against the `docs/07` cancellation-fee matrix (TXN-005).
4. Build the general-purpose admin repair RPC(s) (OPS-002/TXN-010).

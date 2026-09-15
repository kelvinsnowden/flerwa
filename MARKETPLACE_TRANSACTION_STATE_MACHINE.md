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

  funded (any pre-evidence state, including checked_in/in_progress)
    ──► cancelled_by_customer | refunded | settled
                            (rpc_cancel_booking — customer-only, confirmed:
                            `v_txn.customer_id <> auth.uid()` is the only
                            gate, the provider cannot call this RPC. TXN-005
                            RESOLVED: docs/07's >24h full-refund / <24h 50%-
                            to-provider / post-check-in 100%-to-provider
                            tiers are now implemented — see register. Result
                            state is `refunded` when the provider gets 0%,
                            `settled` otherwise. `select ... for update` —
                            Confirmed, code.)
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
| `evidence_submitted` → `released`→`settled` | `rpc_approve_and_release` | Customer, admin, or the auto-approve sweep (5-day silence) | — | `rpc_approve_and_release` itself has no lock — it's a thin auth check that delegates entirely to `_release_transaction`, which does `select ... for update` — **Confirmed, code + live `pg_proc` check, TXN-003 closed** |
| `evidence_submitted` → `revision_requested` | `rpc_request_revision` | Customer | Max 2 revisions, or the RPC raises directing the customer to open a dispute instead | `select ... for update` — **Confirmed, code + live `pg_proc` check, TXN-003 closed** |
| `evidence_submitted` → `released` → `settled` | Both transitions happen inside one call to `_release_transaction` (one RPC invocation, not two) — **Confirmed, code, this pass** | — | — | — |
| any funded+ state (through `in_progress`) → `disputed` | `rpc_open_dispute` | Either participant | `is_txn_participant()` | `select ... for update` — **Confirmed, code + live `pg_proc` check, TXN-003 closed**. Sets a 48h `sla_deadline` since TXN-004; see `rpc_escalate_overdue_disputes` for the escalation sweep. |
| `disputed` → `settled`/`refunded` | `rpc_resolve_dispute` → dual-control `_execute_refund` | Trust & safety or finance admin proposes, a **different** admin decides (GOV-P4) | Split must sum to service amount (Confirmed, live DB, prior session) | — |
| any pre-`evidence_submitted` state (funded, scheduled, en_route, checked_in, in_progress) → `cancelled_by_customer`/`refunded`/`settled` | `rpc_cancel_booking` | Customer only — confirmed, `v_txn.customer_id <> auth.uid()` is the sole gate, no provider path exists | — | `select ... for update` — Confirmed, code |

**TXN-003 (lock audit on 5 RPCs): CLOSED, all 5 confirmed.** `_fund_transaction`,
`rpc_provider_check_in`, and `rpc_submit_completion` were confirmed in
earlier passes; `rpc_request_revision` and `rpc_open_dispute` take the lock
directly, and `rpc_approve_and_release` delegates to `_release_transaction`,
which takes it — all reconfirmed directly against `pg_proc.prosrc` on the
live database, not just the migration files. **TXN-005 (cancellation-fee
logic): RESOLVED** — see register. **PAY-009 (refund path independent of
dispute): investigation closed** — `rpc_cancel_booking` already serves this
role for pre-completion cancellations; a full dispute record is only
required once work is underway, which is the intended boundary.

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

# Marketplace Payments and Reconciliation Plan

Companion to the register's `PAY-*` items and `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` §2.

**Corrections (marketplace remediation continuation pass):** this
document's original §2.1 incorrectly stated "no `payments` row transitions
to any state other than `funded`... no refund/reversal row shape confirmed."
That was wrong — `payments.state` uses a real `payment_state` enum
(`unpaid, payment_pending, funded, released, refunded, failed`) and
`rpc_cancel_booking` does write `state = 'refunded'` on a funded
cancellation, confirmed by direct re-read this pass. §2.5's "Investigating"
status on `rpc_cancel_booking` is now resolved to a definite finding. **PAY-006
(ledger self-consistency) has been implemented and verified live this
pass** — see §3, updated.

## 1. Current architecture, confirmed

Treat payments as a financial system, per the founding brief's instruction.
What's real today (**Confirmed, code + live DB, this pass and prior
sessions**):

- Money as integer minor units (`bigint amount_minor`) throughout — no
  floating-point currency anywhere in the schema (re-confirmed this pass).
- One active payment provider: `manual` — a human admin confirms receipt of
  an out-of-band M-Pesa payment via `rpc_confirm_manual_payment`.
- `_fund_transaction` is the single shared internal function both the manual
  path and the (not-yet-live) webhook path call — same ledger entries, same
  guarded state transition, same escrow-expiry clock, for either path. This
  is good architecture: fixing or auditing funding logic once covers both
  present and future payment methods.
- `payment_provider_events` records every inbound webhook attempt
  (processed or not) with `processing_error` explaining any rejection —
  nothing is silently dropped.
- Idempotency: `rpc_ingest_payment_event` dedupes on `(provider_key,
  external_reference, event_type)`; `rpc_book_service` dedupes on a
  customer-scoped client key. Both implemented and verified live in the
  prior session (`MARKETPLACE_SCALE_READINESS_AUDIT.md` §14).
- Append-only `ledger_entries` and `transaction_events` — verified multiple
  times across sessions by test-fixture cleanup being *blocked* by these
  guards, i.e., the control demonstrably works.

## 2. For every financial operation: input, authorization, boundary, behavior

Per the founding brief's explicit template. "Confirmed" rows were
independently re-checked this pass or in the immediately preceding session;
"Not confirmed" rows are the audit gaps this plan exists to close.

### 2.1 Funding a transaction (`_fund_transaction`, called by 2 paths)

| Property | Value | Status |
|---|---|---|
| Input | transaction_id, provider_key, external_reference, confirmed_by, notes | Confirmed |
| Authorization | Admin (manual path, `is_admin()`) or trusted service-role webhook (automated path) | Confirmed |
| DB transaction boundary | Single function call, `select ... for update` on the transaction row | Confirmed |
| State transition | `requested`/`quote_accepted` → `funded` | Confirmed |
| Event recording | `payments` insert, 3 `ledger_entries` rows, `transaction_events` insert | Confirmed |
| Retry behavior | Manual path: no idempotency key — a genuine double-click by an admin could theoretically double-fund if the state guard didn't catch it; the guard *does* catch it (state must be `requested`/`quote_accepted`, and after the first call it's `funded`) so a retry safely errors, but there is no dual-control (PAY-004) | Confirmed (guard) / Missing (dual-control) |
| Automated path retry | Idempotent via dedupe key, verified live | Confirmed |
| Duplicate behavior | Automated: no-op, returns original event id. Manual: second call errors (state guard) | Confirmed |
| Failure behavior | Automated: recorded with `processing_error`, transaction untouched. Manual: RPC raises, no partial state | Confirmed |
| Reconciliation behavior | **None exists** | Missing — PAY-006 |
| User-visible outcome | Customer/provider see the new `funded` state on next load | Confirmed (architecturally — not pixel-verified this pass) |
| Support repair process | None beyond re-running the same RPC (which correctly no-ops/errors if already funded) — no path to *reverse* an erroneous funding | Missing — OPS-002 |
| Test coverage | Manual role-simulated SQL only, not automated | Missing — SEC-001 |

### 2.2 Refunding / resolving a dispute (`rpc_resolve_dispute`)

| Property | Value | Status |
|---|---|---|
| Input | dispute_id, provider_minor, customer_refund_minor, resolution text | Confirmed |
| Authorization | Admin only | Confirmed, verified live |
| DB boundary | Single transaction, split must sum to service amount (verified: an invalid split is rejected) | Confirmed, verified live |
| State transition | `disputed` → `settled` or `refunded` depending on split | Confirmed |
| Event recording | Balanced `ledger_entries`, dispute row updated with `financial_outcome` | Confirmed, verified live |
| Retry/duplicate | An already-resolved dispute cannot be resolved again, verified live (no duplicate ledger entries) | Confirmed, verified live |
| Reconciliation | Feeds into the same unasserted ledger invariant as §2.1 | Missing — PAY-006 |
| Support repair | This IS the repair tool for disputes specifically — but has no dual-control regardless of amount (PAY-004/OPS-005) | Missing (dual control) |
| Test coverage | Manual only | Missing — SEC-001 |

### 2.3 Converting a Deal Desk request (`rpc_convert_deal_desk_request`)

| Property | Value | Status |
|---|---|---|
| Authorization | Admin only, verified live | Confirmed |
| Duplicate behavior | Already-converted request cannot be converted again, verified live | Confirmed |
| Known limitation | Customer must already have an account (no invite-and-create flow) — explicitly documented as a known gap in `SECURITY.md`, not new to this pass | Confirmed limitation, accepted |
| Fee calculation | Uses the same flat rate as `rpc_book_service`, not the Deal Desk-specific 5% rate `docs/10` specifies — **not independently re-verified this pass**, flagged | Investigating — folds into PAY-007 |

### 2.4 Ingesting a payment webhook (`rpc_ingest_payment_event`)

Fully covered in `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` §2 and
`MARKETPLACE_SCALE_READINESS_AUDIT.md` §14. Headline: idempotent and
verified live, but has never processed a single real webhook (PAY-001/002).

### 2.5 Cancellation (`rpc_cancel_booking`)

Re-read in full this pass, resolving the prior "Investigating" status:

| Property | Value | Status |
|---|---|---|
| Who can call it | Customer only (`v_txn.customer_id <> auth.uid()` check) — a **provider cannot self-cancel** via this RPC at all | Confirmed, code |
| Allowed source states | `requested, quoted, quote_accepted, funded, scheduled, en_route` — blocked entirely from `checked_in` onward ("the Pro has already checked in") | Confirmed, code |
| Financial outcome | **Flat 100% refund** if `funded_at is not null` (writes 3 balanced `ledger_entries` rows, sets `payments.state = 'refunded'`); no ledger entries at all if never funded | Confirmed, code |
| `docs/07`'s cancellation-fee matrix (>24h full refund / <24h 50% to provider / after-check-in 100% to provider) | **Not implemented.** No time comparison against `scheduled_for` exists anywhere in this function; the after-check-in case isn't a "100% to provider" outcome, it's a hard block on cancelling at all | **Confirmed not fixed** — TXN-005 |
| Lock discipline | `select ... for update` | Confirmed, code |
| Notification | Provider notified with the reason, if a provider was assigned | Confirmed, code |

**Financial risk, stated plainly:** a customer can cancel a scheduled job
minutes before it's due to start and receive a full refund, while the
assigned provider — who may have already traveled or blocked out the time
— receives nothing and has no recourse through this RPC. This directly
contradicts `docs/07`'s own stated design principle ("release travel/
callout components at check-in... withholding it until a customer approves
days later is the kind of unfairness that loses supply") and is now
`MARKETPLACE_REMEDIATION_GAP_ANALYSIS.md`'s highest-priority open payments
finding after PAY-006 (below).

## 3. The ledger invariant — implemented and verified this pass

`docs/07`: `Σ escrow_held + Σ materials_held + Σ provider_payable ==
aggregator settlement balance`. With only the manual payment method live,
the right-hand side doesn't exist yet — but the **left-hand side's
internal consistency** (do the ledger entries themselves balance, debits
equal credits, by transaction_group and currency) is now checked.

**PAY-006 — Fixed and verified this pass:**
`rpc_check_ledger_balance()` (returns only imbalanced groups) and
`rpc_run_ledger_reconciliation()` (jsonb summary for logging), both
`SECURITY DEFINER`, service-role only (re-verified via `pg_proc`: exactly
one overload each, no `anon`/`authenticated` grant). A new
`/api/cron/ledger-reconciliation` route mirrors the auto-approve sweep's
exact pattern (fails closed without `CRON_SECRET`, `scheduler_runs`
logging), scheduled daily at 04:00 UTC in `vercel.json`, and its last-run
status is now surfaced on `/admin` alongside the sweep's own card.

Verified live: the current production ledger is balanced (0 imbalances
across every existing `transaction_group`), and a deliberately-introduced
unbalanced entry (inserted and immediately rolled back, never committed)
was correctly detected and reported with the exact imbalance amount before
being discarded.

## 4. Payment provider outage behavior

**Not yet meaningfully testable** — there is no live provider to have an
outage. Recommended design, to build alongside PAY-001 rather than
speculatively now: `rpc_ingest_payment_event`'s existing pattern (record
first, act only if every guard passes) already degrades gracefully to "not
processed, logged with a reason" under a malformed/partial webhook, which is
most of what's needed; add a scheduled reconciliation-exception sweep
(PAY-003) so payments stuck in an ambiguous state because the provider
never sent a webhook at all are surfaced to an admin rather than silently
lost.

## 5. Recommended sequencing

1. Read `rpc_cancel_booking` in full; close the TXN-005/PAY-009
   investigation with a definite finding.
2. Build PAY-006 (ledger self-assertion job) — no dependencies, highest
   value per unit of engineering effort in this entire document.
3. Build PAY-004/OPS-005 (dual control) before connecting any real
   aggregator — the risk PAY-004 describes is present *today*, with manual
   confirmation, not only once real money is automated.
4. Resolve the PAY-007 fee-model decision with the founder, then implement
   if approved.
5. Only then: PAY-001 (connect a real aggregator), sequenced last on
   purpose — every other item in this document is cheaper to fix before
   real money is moving than after.

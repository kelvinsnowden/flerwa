# 16 — Connecting a real payment/verification provider (generic architecture)

This documents the seam added in this pass: a registry-driven way to plug
in **any** payment aggregator or KYC/identity vendor without rewriting the
app around one vendor's specific API. It generalizes the pattern already
established for phone-OTP's SMS vendor ("the app code has zero knowledge
of which vendor is behind it" — see `SECURITY.md`), applied to money and
identity checks.

## Why generic, not IntaSend/Kora-specific

The founder's own plan names IntaSend (payments) and Kora (identity) as
the first real integrations, but the architecture below does not hardcode
either — it's a small, typed adapter interface plus a database registry
that says which already-coded adapter is authoritative right now. Adding
IntaSend, Paystack, Pesapal, Flutterwave, Kora, Smile ID, or anything else
later is: write one adapter file implementing the interface, add one line
to the registry, flip the DB flag. Nothing about the webhook routes, the
RPCs, or the admin UI changes per vendor.

## What's real vs. illustrative in this pass

**Real, verified against the live database via role-simulated SQL
testing** (same method as every other RPC in this project — see
`SECURITY.md`'s own methodology):

- `payment_providers` / `verification_providers` — the registry tables.
  Exactly one row per table can be `is_active` (enforced by a partial
  unique index, not just application logic).
- `payment_provider_events` / `identity_verification_checks` — audit
  tables. Every inbound event is recorded, matched or not — nothing is
  silently dropped.
- `rpc_ingest_payment_event` — the only path an automated webhook can use
  to fund a transaction. Verified live: a matching, signed, correctly-
  amounted event funds the transaction with the exact same ledger
  invariants `rpc_confirm_manual_payment` already had (they now share one
  internal helper, `_fund_transaction`); an amount mismatch, a currency
  mismatch, an unsigned/unverified payload, or a non-fundable transaction
  state each correctly refuse to fund and record why.
- `rpc_record_identity_check` — records a vendor's KYC result. Verified
  live: it **never** changes `providers.verification_status` itself, even
  on a clean "passed" result. That decision stays behind the existing
  admin-gated `rpc_set_verification_status` — see "Why verification stays
  human-gated" below.
- `rpc_set_active_payment_provider` / `rpc_set_active_verification_provider`
  — admin-gated (verified: a non-admin call is rejected). What flips
  `/admin/integrations`.
- Function grants verified via `has_function_privilege`, same discipline
  as `SECURITY.md` §8: `rpc_ingest_payment_event` and
  `rpc_record_identity_check` are executable **only** by `service_role` —
  a browser session (anon or authenticated) cannot call them at all, by
  grant, not just by internal check. They're reached exclusively from the
  webhook route handlers via `src/lib/supabase/admin.ts`.

**Illustrative, not fabricated as working** — clearly marked in the code
itself:

- `src/lib/payments/adapters/intasend.ts` — field names (`invoice_id`,
  `state`, `api_ref`, `net_amount`/`value`, `currency`, `failed_reason`)
  are taken from IntaSend's published docs
  (developers.intasend.com/docs/payment-collection-events,
  .../docs/payment-status) as of this writing. **Signature verification
  is not implemented** — it fails closed (`verifyWebhookSignature` always
  returns `false`) rather than invent a scheme this session couldn't
  confirm against a real IntaSend account. A closed gate means every
  event is recorded with `processing_error: "Webhook signature did not
  verify."` for manual reconciliation — never a silently-trusted forgery.
- `src/lib/verification/adapters/kora.ts` — same honesty pattern.
  Additionally: Kora's own docs describe verification as request/query
  based (you `GET .../identities/verifications/:reference`), not
  confirmed here as webhook-push. The realistic integration point may
  actually be a **direct synchronous call** from wherever a provider
  submits for verification, not this webhook route — confirm against
  Kora's current docs before building the real call.

## What "connecting a real vendor" actually requires

1. **A real account** with the vendor (IntaSend business account, Kora
   dashboard access) — this is the piece that needs real capital-free
   sign-up but real usage-based cost once transactions/checks flow.
2. **Confirm the adapter's field mapping and signature scheme** against
   the vendor's *current* docs — vendor APIs change between doc
   revisions; nothing here was tested against a live account.
3. **Implement `verifyWebhookSignature`** for real, using an env var
   secret (`INTASEND_WEBHOOK_SECRET`, `KORA_WEBHOOK_SECRET` — not
   committed to the repo, set in Vercel's environment settings).
4. **Build the "create a collection request" half** — this pass only
   built the *inbound* webhook side. Initiating a collection (calling
   IntaSend's API when a customer is ready to pay, attaching our
   `service_transactions.id` as `api_ref` so the webhook can round-trip
   it back) is a new, separate piece of work, not yet built.
5. **Flip the registry** at `/admin/integrations` once 1–4 are done and
   tested against the vendor's sandbox.

## Why verification stays human-gated by default

`rpc_record_identity_check` deliberately never auto-approves, even though
the schema has a `config` jsonb column on `verification_providers` that
could carry an `auto_approve_on_pass` flag for a future pass. This was a
conscious choice, not an oversight: `docs/06-trust-architecture.md` is
explicit that "verified" is a claim made to a customer, and the
established rule in this codebase is that a human admin makes that claim
through one function. A vendor's "passed" result is strong evidence, not
a substitute for that — the `/admin/verifications` queue now shows it
inline on each provider's card precisely so the admin decides faster, not
so the system decides for them. If the founder wants to relax this later
(e.g. auto-approve Tier 1 checks below some risk threshold), that's a
deliberate product/legal decision to make explicitly, not something to
wire in quietly.

## Second pass: real signature verification + the outbound half

A follow-up pass replaced the fail-closed signature stubs with real
verification, grounded in each vendor's docs found after the first pass:

- **IntaSend**: not HMAC — a "challenge" string set once in their
  dashboard and echoed back on every webhook call
  (developers.intasend.com/docs/webhooks). `verifyWebhookSignature` now
  does a constant-time string compare against `INTASEND_WEBHOOK_CHALLENGE`.
  Still fails closed (`false`) if that env var isn't set — which it isn't,
  by default.
- **Kora**: `x-korapay-signature` header, HMAC-SHA256 of the JSON-
  stringified `data` object, hex digest
  (developers.korapay.com/docs/webhooks). `verifyWebhookSignature` now
  computes and constant-time-compares this for real. Still fails closed
  if `KORA_SECRET_KEY` isn't set.

Both were sanity-checked in isolation (Node one-liners: equal/unequal/
different-length string compares, HMAC digest length and determinism) —
not against a live vendor account, since none exists, but the algorithms
themselves are now real, not placeholders.

**The outbound half** (previously the biggest stated gap) is now built:

- `createIntasendCollection()` (`src/lib/payments/adapters/intasend.ts`)
  — `POST /api/v1/payment/mpesa-stk-push/` with `api_ref` set to our
  transaction id, so the inbound webhook can round-trip it back. Wired
  into a real "Pay with M-Pesa" button on `/account/bookings/[id]`
  (`pay-now-button.tsx` + `initiatePayment` in that route's `actions.ts`)
  — it only appears when an aggregator is actually active, re-validates
  server-side that the caller owns the booking and the amount is the
  server-computed total (never client-supplied), and shows a generic
  customer-facing message on failure while logging the precise reason
  server-side.
- `verifyKenyaNationalId()` (`src/lib/verification/adapters/kora.ts`) —
  `POST /identities/ke/national-id`. Wired into `submitForVerification`
  (provider apply wizard, step 5): a new "Identity verification
  (optional)" panel collects a National ID number and explicit consent
  (`providers.national_id_number`, `providers.identity_verification_consent`
  — new nullable/self-editable columns, NOT covered by
  `trg_guard_provider_trust_fields`, verified live via role-simulated
  update). If Kora is the active verification provider and both fields
  are present, the action calls Kora synchronously and records the
  result via `rpc_record_identity_check` — same human-gated rule as
  before, this never auto-verifies.

Both outbound calls fail with a clear, logged reason (missing env var,
vendor HTTP error) rather than a silent success — checked by inspecting
the code path, since no real account exists to actually trigger a
success response. `.env.example` documents every new var
(`INTASEND_ENV`, `INTASEND_SECRET_KEY`, `INTASEND_PUBLIC_KEY`,
`INTASEND_WEBHOOK_CHALLENGE`, `KORA_SECRET_KEY`), all unset by default.

**What's still genuinely unconfirmed**, stated rather than assumed: the
exact Authorization header scheme for Kora's identity endpoints
specifically (implemented as `Bearer <secret key>`, the pattern Kora's
payments API and every peer aggregator uses, but not found written down
for the identity product itself); and whether IntaSend's `net_amount` or
`value` field is the one to compare against `total_amount_minor` in the
amount-match guard (both appear in their docs; using the wrong one would
make every real payment fail the guard, not succeed one it shouldn't —
the failure mode is safe, just noisy, so this is a "fix once you see a
real payload" item, not a security gap).

## Reconciliation

`/admin/integrations` lists the most recent `payment_provider_events`
with an unprocessed count called out — this is the "reconciled daily
against the aggregator, owned by a named person" surface
`docs/07-payments.md` calls for. An event that failed to match (wrong
amount, stale reference, inactive provider) is never silently lost; it's
a row an admin can chase down by hand.

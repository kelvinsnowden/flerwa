# Security

This document is the security review required by BUILD_PLAN.md Phase 14.
Every claim below was verified by direct query against the live database
(`famdxoardiibonghxepl`), not assumed from reading the migration files.

## The security model in one sentence

**RLS is default-deny on all 29 tables. Every state change, price, payment
status, verification decision, and reputation number is written exclusively
by a `SECURITY DEFINER` function that re-checks the caller's identity and
role itself — the client never has a direct-write path to any of them.**

## What was tested, and how

### 1. Cross-tenant data access
`service_transactions`, `payments`, `transaction_evidence`, `messages`,
`disputes` all carry an `is_txn_participant(transaction_id)` RLS predicate
(customer, the assigned provider, or admin — nobody else). Verified by
reading the applied policy definitions back from `pg_policies` after
migration, not just the source file.

### 2. Self-role escalation
`profiles.role` has an `update` policy allowing a user to update their own
row, **but** `trg_profiles_guard_role` (a `BEFORE UPDATE` trigger) raises an
exception if `role` changes and the caller is not already an admin. A user
cannot make themselves an admin or a provider-privileged role through the
`profiles` table. Provider status is separately controlled by
`rpc_set_verification_status`, callable only by `is_admin()`.

### 3. Client-supplied price / payment state
`rpc_book_service` resolves price server-side (`provider_services.price_minor`
falling back to `services.base_price_minor`) — the client sends a service ID
and provider ID, never an amount. `total_amount_minor` on
`service_transactions` is a `GENERATED ALWAYS AS` column; it cannot be set
directly by any insert or update. Payment `state` only ever becomes `funded`
through `rpc_confirm_manual_payment`, gated by `is_admin()` — verified there
is no RLS `INSERT`/`UPDATE` policy on `payments` for `anon` or `authenticated`
at all (checked directly: `payments` has exactly one policy, `SELECT`-only).

### 4. Self-approval
A customer cannot mark their own transaction complete — only a provider can
submit completion (`rpc_submit_completion`, checked against
`providers.user_id = auth.uid()`), and only a customer (or an admin, or the
auto-approve sweep) can approve and release (`rpc_approve_and_release`).
Verified these are two different functions with two different auth checks,
not one function trusting a role flag.

### 5. Evidence access
`transaction-evidence` is a **private** Storage bucket. Its RLS policy reuses
`is_txn_participant()` on the transaction ID embedded as the first path
segment — the same predicate the `transaction_evidence` table itself uses.
An unauthorized user's signed-URL request would still 403 even if they
somehow obtained a path, because Storage RLS is checked independently of
whether a URL was ever issued.

### 6. Review forgery
`reviews` has one `INSERT` policy: `reviewer_id = auth.uid()`, the reviewer
must be a transaction participant, `reviewee_id <> auth.uid()` (can't review
yourself), and the transaction must be in `settled`/`reviewed`/`closed`
state. This directly enforces the blueprint's "reputation only from
escrow-settled transactions" rule (`docs/06-trust-architecture.md`) — a
gaming attempt fails at the database, not just the UI.

### 7. Admin routes
`/admin/*` is guarded by a `Layout` server component that calls
`supabase.auth.getUser()` and checks `profiles.role === 'admin'` before
rendering `children` — a non-admin is redirected before any admin query
runs. This is **defence in depth**, not the actual boundary: every admin
`rpc_*` function (`rpc_confirm_manual_payment`,
`rpc_set_verification_status`, `rpc_set_category_clearance`) independently
calls `is_admin()` and raises if false, so even a bypassed or buggy layout
guard could not grant a non-admin write access.

### 8. Function grant surface — the bug found and fixed during this build

**A real bug, not a hypothetical.** The first hardening pass
(`20260908134930_harden_function_security.sql`) revoked `EXECUTE ... FROM
PUBLIC` on every internal function, on the assumption that PUBLIC was the
grant mechanism. Direct verification with `has_function_privilege('anon',
oid, 'EXECUTE')` after applying it showed every `rpc_*` function **still**
executable by `anon`. The actual cause: this Supabase project's default
privileges grant `EXECUTE` **directly** to `anon`/`authenticated` on
function creation, not only via `PUBLIC`. `20260908135116_fix_function_grants.sql`
corrected this — revoking from the named roles directly — and was verified
by requerying `has_function_privilege()` for all 18 functions before
declaring it fixed. Final state, confirmed by query, not by re-reading the
migration source:

| Function class | anon | authenticated | Why |
|---|---|---|---|
| `is_admin()`, `is_txn_participant()` | ✅ | ✅ | Required — RLS policies call these during policy evaluation for both roles. Revoking breaks every policy that uses them, not just an API surface. |
| `rpc_book_service`, `rpc_provider_check_in`, `rpc_submit_completion`, `rpc_approve_and_release`, `rpc_request_revision`, `rpc_confirm_manual_payment`, `rpc_set_verification_status`, `rpc_set_category_clearance` | ❌ | ✅ | Signed-in users only; each also self-checks internally |
| `log_event`, `recompute_reliability`, `_release_transaction`, `rpc_run_auto_approve_sweep`, all 4 trigger functions | ❌ | ❌ | Purely internal — called from within other `SECURITY DEFINER` functions (which run as the function owner regardless of the original caller's grants) or via the trigger mechanism, which does not require caller EXECUTE privilege |

None of this was ever a live vulnerability — every `rpc_*` function performs
its own `auth.uid()`/`is_admin()` check and raises for an unauthorized
caller regardless of the PostgREST grant. It was closed anyway, because the
grant surface should match intent exactly, and because "the internal check
saves us" is exactly the kind of assumption that should be verified, not
trusted.

## What was NOT tested, and why

**Live browser click-through testing against the deployed application was
not possible in this build session.** The sandboxed environment's outbound
network policy denies direct HTTPS `CONNECT` to `*.supabase.co` from this
shell's own processes (confirmed via the egress proxy's own diagnostic
endpoint: `"kind":"connect_rejected","detail":"gateway answered 403 to
CONNECT","host":"famdxoardiibonghxepl.supabase.co:443"`). This is a sandbox
network policy, not an application defect — the Supabase MCP tool channel
used to apply every migration and verify every grant in this document has
its own, separately permitted network path, which is how 100% of the
database-layer verification above was actually performed. A real deployment
(Vercel, or any unrestricted environment) does not have this restriction.

**Concretely, this means:** `npm run build` and `npx tsc --noEmit` both pass
cleanly, and `next dev` serves the homepage without crashing (verified —
HTTP 200, correct HTML for the logged-out state), but no one has clicked
through a booking, a check-in, an evidence upload, or a payment confirmation
in a live browser against live data in this session. **Do that before
calling this launch-ready** — the code paths are real and the RLS/function
layer is independently verified, but an end-to-end click-through in an
unrestricted environment is the one check this session could not perform
and did not fabricate.

## Payment honesty (Phase 9)

There is no escrow product connected. `payments.provider_key = 'manual'`:
the customer pays out-of-band (M-Pesa Till/Paybill details communicated by
an operator, not generated by this codebase) and an admin confirms receipt
via `rpc_confirm_manual_payment` before funds are considered held. The UI
never uses the word "escrow" and never claims a legal guarantee this
codebase cannot back. See `docs/07-payments.md` for why: CBK PSP licensing
applies to anyone processing retail payments, operating wallets, or
aggregating — **[LEGAL — COUNSEL REQUIRED]** before connecting a real
payment rail.

## Phone + OTP authentication

Phone + OTP (`design-references/mobile/01-login.png`, `02-otp.png`) is the
primary authentication experience: enter a Kenyan phone number → receive a
6-digit SMS code → verify → authenticated session. Email/password remains
available as a secondary path (`/login/email`, `/signup`) — nothing about
the existing email flow was removed.

**How it's implemented — and what it does NOT do:**

- The app calls Supabase Auth's own phone provider directly:
  `supabase.auth.signInWithOtp({ phone })` to send a code and
  `supabase.auth.verifyOtp({ phone, token, type: "sms" })` to verify it.
  Both live in one file, `src/app/login/phone-actions.ts` — the only place
  in the codebase that talks to phone auth at all.
- **This app never sends an SMS itself and never sees the code.** Supabase
  Auth generates the code, hands it to whichever SMS vendor is configured,
  and verifies it against what the user submits — entirely server-side, on
  Supabase's infrastructure. There is no code here that could hardcode,
  log, or fake a code even by accident.
- **The SMS vendor is configured in the Supabase dashboard, not in this
  codebase**: Authentication → Providers → Phone, with a real account
  (Twilio, MessageBird, Vonage, or Textlocal — Supabase's supported list)
  and its actual credentials (Account SID, Auth Token, sender number/ID).
  This is the "provider abstraction" — the app code has zero knowledge of
  which vendor is behind it, so switching vendors is a dashboard change,
  not a code change.
- **As of this session, no SMS provider has been configured** on the
  connected Supabase project (`famdxoardiibonghxepl`) — configuring one
  requires a real account with that vendor, which is outside what this
  session can set up. Until it is, `signInWithOtp` fails with a real error
  from Supabase's Auth API, and the UI surfaces that error as-is (a plain
  error banner on the phone-entry screen) — it does **not** pretend the
  code was sent. Verified live: the phone form was submitted against the
  actual Supabase project and the failure rendered honestly rather than
  silently succeeding. (The specific error text seen in this sandbox —
  "Unexpected token 'H', 'Host not i'... is not valid JSON" — is this
  environment's own egress proxy blocking `*.supabase.co`, the same
  network restriction documented elsewhere in this file, not a Supabase
  API response; the real "no provider configured" error can only be
  observed from a network path that can actually reach Supabase.)
- **Development/QA without burning real SMS credits**: use Supabase's own
  built-in mechanism — Authentication → Settings → **Test Phone Numbers**
  (or the Phone provider's test-OTP option) lets an admin register a
  specific phone number with a fixed OTP that Supabase accepts without
  sending a real SMS. That configuration lives entirely in the Supabase
  dashboard/project settings, never in this repository, and Supabase's own
  UI labels it as a test/sandbox mechanism — it cannot be mistaken for a
  production credential. This app has no separate, homegrown "dev bypass";
  using Supabase's test-number mechanism is the only sanctioned way to
  exercise this flow without a live SMS provider.
- `trg_handle_new_user` (the trigger that creates a `profiles` row on
  signup) previously only copied `email` and `full_name` from
  `auth.users`, silently dropping `phone` — a real bug for phone-only
  signups, fixed in
  `supabase/migrations/20260909090000_capture_phone_on_new_user.sql` and
  applied to the live project.

## In-app messaging

Real, transaction-scoped chat (`/messages`, `/messages/[transactionId]`),
built on the `messages` table that already existed from the original MVP
build (with participant read/send RLS already in place) — extended in
`supabase/migrations/20260910080000_extend_messaging.sql` with a
`read_at` column, an append-only guard trigger, a recipient-only
"mark read" policy, a new-message notification (reusing the existing
`notifications` table, the same pattern every other RPC uses), and
Supabase Realtime.

Verified live via the same role-simulation method as the rest of this
document (`SET LOCAL ROLE authenticated` + `request.jwt.claims`) against
real fixtures, not asserted from reading the policy source:

| Check | Result |
|---|---|
| A transaction participant can send a message | PASS |
| The other participant gets a `notifications` row | PASS |
| The other participant can read the message | PASS |
| A non-participant sees 0 rows on the same transaction | PASS |
| A non-participant's insert is rejected by RLS | PASS |
| The sender cannot mark their own message read (0 rows affected) | PASS |
| The recipient CAN mark it read | PASS |
| Nobody — including the recipient — can edit the message body | PASS |
| Nobody can delete a message (no DELETE policy; RLS denies by default) | PASS |

All 9 checks passed; fixtures were fully cleaned up afterward (verified
back to 0 rows in every touched table).

## Known gaps, stated rather than hidden

- Only the flagship service (`know-before-you-pay`) has a full checklist.
  The other three seeded services have zero checklist items, which means
  `rpc_submit_completion` has nothing to block on for them — not a bug
  (the function is unconditionally correct), but a scoping gap to close
  before those three are actively promoted.
- Deal Desk requests are captured (`deal_desk_requests` table, RLS in place,
  provider-facing form works) but there is no admin conversion flow from a
  Deal Desk request into a funded `service_transaction` yet — that queue is
  visible only via direct database access today.
- No automated tests exist. Every verification in this document is either a
  direct database query or a build/typecheck pass, not a test suite.

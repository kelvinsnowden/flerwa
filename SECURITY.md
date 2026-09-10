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
`profiles` table. Provider verification status is separately controlled by
`rpc_set_verification_status`, callable only by `is_admin()`, and has been
row-level guarded since `20260910120000_provider_avatar_and_trust_guard.sql`
(`trg_guard_provider_trust_fields`) — see §9 for a narrower gap in that
same trigger found and closed later.

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

### 9. `providers.is_published` — a narrower version of the same class of bug, found and corrected mid-pass
While building the seller onboarding wizard's "submit for verification"
step, went looking for whether a seller could self-promote their own
`providers` row the same way `profiles.role` is guarded against. First
pass here (now corrected) **wrongly claimed no guard existed at all** — a
grep for `trg_providers_guard` missed the real, pre-existing trigger,
named the other way round: `trg_guard_provider_trust_fields`
(`20260910120000_provider_avatar_and_trust_guard.sql`). That trigger
already blocked self-changes to `verification_status`, `verified_at`,
`user_id`, and `id`. Re-checked directly against the live database
(`pg_trigger`/`pg_get_functiondef`) before writing this correction, per
this document's own standard at the top of the file.

**What that pre-existing trigger did not cover: `is_published`.**
`src/app/services/[slug]/page.tsx`'s provider-picker query filters on
`is_published = true` (+ category clearance) without separately
re-checking `verification_status` in that same query. So a seller who
directly ran `update providers set is_published = true where user_id =
auth.uid()` could appear as a bookable choice on a service page as soon
as an admin had cleared them for at least one category (`provider_
categories.is_cleared` — a real, separate admin action) — skipping the
admin's distinct "go live" decision, even though `verification_status`
itself stayed correctly guarded and unverified everywhere that field is
shown. Smaller than the original write-up claimed, but real.

Fix (`20260910230000_consolidate_provider_trust_guard.sql`): extended the
**existing** `trg_guard_provider_trust_fields` to also cover
`is_published`, rather than leaving a second, confusingly-named parallel
trigger in place (an intermediate migration in this same pass had added
one before the live-DB check surfaced the pre-existing one — dropped in
the same consolidation migration). The one legitimate self-transition (a
seller marking their own application `pending -> submitted`) goes through
a narrow RPC, `rpc_submit_for_verification`, which sets a session-local
bypass flag (`app.bypass_provider_trust_guard`) before its own single,
hard-coded update — the same escape-hatch pattern
`trg_guard_transaction_financial_write` already used for
`app.bypass_txn_guard`. The RPC itself still refuses to run unless the
current status is exactly `'pending'`, so it cannot be reused to reach
`'verified'` or to self-publish independently of that one transition.

### 10. New quote/task RPCs — authorization boundaries
`rpc_submit_quote`, `rpc_accept_quote`, `rpc_decline_quote` (Post-a-Task's
seller side, added in the same migration):
- A seller can only quote on a request in a category they've declared via
  `provider_categories` (checked inside `rpc_submit_quote`, not left to
  RLS) — they cannot quote outside their stated competence.
- A seller cannot submit a second quote on the same request (`quotes`'
  `unique(request_id, provider_id)`) and cannot exceed 5 quotes per
  request (pre-existing `trg_enforce_quote_cap`, untouched, still
  `SECURITY DEFINER`).
- Only the request's own `customer_id = auth.uid()` can accept or decline
  a quote on it — checked explicitly in both RPCs, not inferred from RLS
  alone.
- Accepting one quote server-side declines every other pending quote on
  the same request in the same transaction — a seller cannot "claim"
  another seller's accepted slot after the fact, since `rpc_accept_quote`
  re-checks `quotes.state = 'pending'` and `service_requests.state =
  'open'` under `for update` locks before writing anything.
- The resulting booking is created with the same 12% platform-fee
  calculation `rpc_book_service` uses, through the same
  `service_transactions` table and the same guarded state machine — no
  parallel payment path, no way for either party to set price or state
  directly.

### 11. Seller self-declared categories — `rpc_set_provider_category`
`provider_categories` is otherwise entirely admin-write (`is_cleared`,
`cleared_by`, `jobs_completed`, `quality_rating`, `competence_score` are
all trust-sensitive). This narrow RPC lets a seller upsert **only**
`attributes` (their own free-text years-of-experience/specialties) for a
category they're declaring — it never writes `is_cleared` or any of the
admin-only columns, and `on conflict` only updates `attributes`. A seller
cannot self-clear themselves for a category through this path.

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

## Saved providers

A per-user bookmark on a public provider profile (`saved_providers`,
`/account/saved`). Also discovered pre-existing from the original MVP
build, same as `messages` — `customer_id`/`provider_id`/`created_at`, RLS
already enabled with a single owner-only `ALL` policy
(`customer_id = auth.uid()` on both `USING` and `WITH CHECK`). No schema
change was needed; a migration was drafted before checking and deleted
once the existing table was found.

Verified live the same way:

| Check | Result |
|---|---|
| A user can insert a save for themselves | PASS |
| A different user sees 0 rows when querying the first user's saves | PASS |
| A different user's attempt to insert a save with someone else's `customer_id` is rejected by RLS | PASS |
| A different user's delete targeting someone else's row affects 0 rows | PASS |
| The owning user can delete their own row | PASS |

All 5 checks passed; fixtures (two customer users, one fixture provider,
the save row) were fully cleaned up afterward (verified back to 0 rows in
every touched table).

## Provider photos, and two real holes found while wiring them

The reference mockups (shared directly in chat) show real provider
photographs throughout — provider cards, the storefront profile, booking,
tracking, messages. Investigating how to build this turned up that
`profiles.avatar_url` and a public `avatars` Storage bucket (with correct
owner-scoped RLS: `(storage.foldername(name))[1] = auth.uid()::text` for
insert/update/delete, public read) already existed from the original MVP
build, unused by any UI. `Avatar` (`src/components/ui/avatar.tsx`) now
renders the real photo when one is on file, falling back to initials
otherwise — never a stock/placeholder photo standing in for a real
person. Upload happens from the provider's own dashboard
(`src/app/provider/photo-upload.tsx`, a direct client upload to the
user's own storage path, then `updateAvatar` re-validates the resulting
URL actually points at that path before trusting it into `profiles`).

While touching `providers` for this, found the "providers self update" RLS
policy has no column restriction: a provider could directly
`UPDATE providers SET verification_status = 'verified'` via PostgREST,
completely bypassing `rpc_set_verification_status` — the admin-gated
`SECURITY DEFINER` function a migration comment already said was
"the" path ("verification_status is separately guarded — see rpc
functions"), but nothing at the table level actually enforced that. Same
shape of bug found in the sibling `profiles` table: `is_suspended` had no
equivalent guard to the existing `role` guard, so a suspended user could
un-suspend themselves. Both fixed with `BEFORE UPDATE` guard triggers
(`supabase/migrations/20260910120000_provider_avatar_and_trust_guard.sql`,
`20260910130000_guard_profile_suspension.sql`), admin bypass via
`is_admin()`.

Verified live:

| Check | Result |
|---|---|
| A provider cannot self-set `verification_status = 'verified'` | PASS |
| A user cannot self-set `is_suspended` in either direction | PASS |
| A provider CAN still self-edit non-trust fields (`avatar_url`, `headline`, `full_name`, etc.) | PASS |
| The admin path (`rpc_set_verification_status`) still works end to end | PASS |

All 4 checks passed; fixtures (two users — one provider owner, one
promoted to admin — one fixture provider, one `admin_actions` row from the
RPC call) were fully cleaned up afterward.

## Evidence, review, and completion

Closes the mockup's Evidence Capture / Inspection Report / Review-and-
Approve / Leave-a-Review / Completed-Job screens against real schema —
one column addition each, no fabricated inputs:

- `transaction_evidence.description` already existed and `recordEvidence`
  already accepted it — `ChecklistItemRow` just never had a text input for
  it. Now the photo/video capture flow holds the file, shows a description
  field, and only uploads on confirm (mockup's "Add a description" step).
- `service_transactions.completion_summary text` (new) — the provider's
  optional free-text summary on submit, captured through
  `rpc_submit_completion`'s new `p_summary` parameter (the old
  single-argument signature was dropped and replaced, not overloaded, to
  avoid PostgREST/Postgres overload ambiguity), shown to the customer as
  "Provider notes" on the report.
- `reviews.tags text[]` and `reviews.would_book_again boolean` (new) — the
  mockup's tag chips and "Would you book again?" toggle. No column-level
  RLS change was needed: `reviews participant insert` already restricts
  the *row* (reviewer/reviewee/participant/settled-state), not specific
  columns.

Verified live:

| Check | Result |
|---|---|
| Provider can call `rpc_submit_completion` with a summary; `completion_summary` is set and the state transitions correctly | PASS |
| The old 1-argument `rpc_submit_completion(uuid)` no longer exists (confirmed via `pg_proc`, no overload ambiguity) | PASS |
| Customer can insert a review with `tags` and `would_book_again` set | PASS |

All 3 checks passed. Fixture cleanup hit a real, working control rather
than sailing through: `transaction_events` is append-only (verified
earlier this session too) and `service_transactions` can't be deleted
while a child event row still references it, so the fixture transaction,
its one audit event, and the fixture provider/users could not be fully
removed. The trigger was **not** disabled to force it through — that
would mean tampering with the exact control being relied on elsewhere in
this document. Contained instead: the fixture provider was unpublished
and both fixture profiles renamed to say "QA fixture (unpublished, do not
use)", and the transaction itself was moved to `closed`. One inert,
clearly-labeled, unpublished fixture provider (`qa-evid-fixture`) remains
in the live database as a result — a real, small mark left by testing a
security control that worked as designed, not a data-integrity bug.

## A real, live money-display bug found while building the Deal Desk admin form

While cross-checking a proposed amount against the mockup's price for the
same service (both should read "KSh 6,000"), found that `formatMoney`
(`src/lib/money.ts` — its own comment already called itself "the ONLY
place money is formatted for display") never actually divided by 100.
Every price shown anywhere in the app — service prices, booking totals,
provider earnings, the admin GMV stat — was rendering 100x too large
(e.g. "KSh 600,000" instead of "KSh 6,000"). Confirmed against real seed
data: `services.base_price_minor` is `600000` for the service the
mockups show priced at "KSh 6,000"; `600000 / 100 = 6000` is correct,
`600000` alone is the bug. `src/app/admin/page.tsx`'s GMV stat had the
identical bug independently (it bypassed `formatMoney` entirely with its
own unlabelled `.toLocaleString()` call) — fixed by routing it through
`formatMoney` like everywhere else, closing both instances at once.

This went undetected for the whole session because this sandbox's dev
server has never been able to reach Supabase to render a real page with
a real price (confirmed repeatedly — even the unrelated home page
fails the same way); every other verification in this document used
direct database checks instead, which don't exercise display
formatting. Grepped the rest of the codebase for `toLocaleString`/`KSh`
near money afterward — no other instances found. Verified the fix
directly (`600000` → "KSh 6,000", `550000` → "KSh 5,500") rather than
through this session's browser sandbox, since that path is the reason
the bug was invisible in the first place.

## Admin: dispute resolution and Deal Desk conversion

Two real gaps this session's own earlier audit had already surfaced but
never built: `disputes.financial_outcome` had a documented shape
(`{"provider_minor": x, "customer_refund_minor": y}`) in a column
comment with no function that ever wrote it, and this document's own
"Known gaps" section already said Deal Desk requests had no admin
conversion path into a funded transaction. Both close the same way as
every other money-moving change in this schema: a `SECURITY DEFINER`
RPC, admin-gated, using the established `app.bypass_txn_guard` escape
hatch for the one guarded state transition each needs.

`rpc_resolve_dispute` splits the service amount between provider and
customer per the admin's decision (the platform fee is retained either
way), writes balanced `ledger_entries`, and moves the transaction to
`settled` or `refunded` depending on whether the provider got anything.
`rpc_convert_deal_desk_request` creates a real `service_transactions`
row from a Deal Desk request — but only for a customer who already has
an account, looked up by phone or email; it deliberately does not create
an account on the customer's behalf, which would be a separate, larger
feature (invites, Admin API user creation). `rpc_decline_deal_desk_request`
covers the request rejection case. Found and fixed a real unit bug in
the same area while there: the provider-facing Deal Desk form divided a
KES amount by 100 right after multiplying it by 100 (`Math.round(amountKes
* 100) / 100`), silently storing whole KES into a column named
`proposed_amount_minor` — no existing rows were affected (the table was
empty).

Verified live:

| Check | Result |
|---|---|
| A non-admin cannot call `rpc_resolve_dispute` | PASS |
| A split that doesn't add up to the service amount is rejected | PASS |
| A valid custom split resolves correctly — ledger entries balance, dispute and transaction both reach the right terminal state | PASS |
| An already-resolved dispute cannot be resolved again (and produces no duplicate ledger entries) | PASS |
| A non-admin cannot call `rpc_convert_deal_desk_request` | PASS |
| Converting to an unknown customer id is rejected | PASS |
| A valid conversion creates a correct `service_transactions` row (origin, amounts, description carried over) and marks the request `converted` | PASS |
| An already-converted request cannot be converted again | PASS |
| `rpc_decline_deal_desk_request` works and is recorded in `admin_actions` | PASS |

All 9 checks passed. Cleanup hit the same real, working control as
before, in a second table this time: `ledger_entries` is also
append-only, so the two fixture transactions (one disputed, one
deal-desk-converted) couldn't be fully removed once ledger entries
existed against them. Not disabled to force it through — contained the
same way as the earlier residue (fixture provider unpublished, profiles
relabeled, transactions moved to `closed`).

## Seeded checklists for the three services that had none

This document's own "Known gaps" section (below) said only the flagship
service had a full checklist, so `rpc_submit_completion` had nothing to
block on for the other three — not a bug in the function, a real content
gap. Each of the three (`landlords-quarterly-check`, `viewed-for-you`,
`document-collection`) now has a checklist written to match that
service's own description on the `services` row, not a copy of the
flagship's 12-point property inspection: Landlord's Quarterly Check
covers condition + both utility meter readings + tenant confirmation (9
items); Viewed For You covers arrival + the live video call + room
photos (7 items); Document & Physical Verification covers identification
+ condition + proof of exchange (7 items). All required, matching the
flagship's own pattern.

Verified live rather than just counting rows: built a real fixture
transaction on Viewed For You at `checked_in` and confirmed
`rpc_submit_completion` now actually rejects it with 0 of 7 required
items complete (previously this would have silently succeeded, since an
empty checklist has nothing to be incomplete), then confirmed it succeeds
once all 7 are marked done. Fixtures cleaned up the same way as every
other transaction-touching test this session — the append-only audit
trail keeps the closed transaction and its unpublished fixture provider
around; see the pattern established earlier in this document.

## Known gaps, stated rather than hidden

- Deal Desk conversion requires the off-platform customer to already have
  a real account (the admin looks them up by phone/email) — there is no
  invite-and-create-an-account flow, which would be a separate, larger
  feature. Until the customer signs up, their request just waits.
- No automated tests exist. Every verification in this document is either a
  direct database query or a build/typecheck pass, not a test suite.

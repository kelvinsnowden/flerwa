# Security Readiness Register

Findings from dedicated security-focused passes, tracked separately from
`MARKETPLACE_REMEDIATION_REGISTER.md`'s broader remediation backlog. Each
finding below was reproduced live via role-simulated, rolled-back SQL
against the production database (`famdxoardiibonghxepl`) — nothing was
ever created, persisted, or left behind by any verification step; every
test transaction ended in `rollback`.

> **MARKETPLACE-SECURITY-003 update (same day):** re-audited all
> financially-sensitive tables' RLS/grants (not just `service_transactions`),
> revised the remediation for SEC-P0-001 to a stronger, simpler primary
> fix (revoking the `INSERT` grant entirely, rather than relying solely
> on a trigger to shape what a direct insert may contain), live-tested
> `rpc_accept_quote` end-to-end (closing SEC-P1-001's disclosed test
> gap), added the `is_test_fixture` durable safeguard, and found one new
> finding (SEC-P0-004, `service_requests` state forgery). The current,
> single authoritative proposal is
> `security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`
> — it supersedes and fully includes the `-002` proposal.
>
> **Applied (2026-09-15), per explicit user authorization:** the -003
> proposal was applied to production as
> `supabase/migrations/20260915135253_marketplace_security_003_financial_hardening.sql`
> (identical content). SEC-P0-001/002/003/004 and SEC-P1-001 are all now
> **fixed in production**, not just designed — see each finding's
> updated Status line below. Post-apply, a live rolled-back-transaction
> re-attempt of the original exploit was rejected with `"permission
> denied for table service_transactions"`, and `get_advisors` (security)
> showed no new findings from this migration. The one item NOT applied
> is the separate `is_test_fixture` data mutation for the standing QA
> fixture provider (still commented out in both files) — that requires
> its own, separate authorization since it mutates an existing row.

---

## SEC-P0-001 — Direct `service_transactions` INSERT bypasses `rpc_book_service` entirely

- **Attack path:** an authenticated customer (any self-registered account
  — no special privilege needed) issues a direct `POST
  /rest/v1/service_transactions` (or any Supabase client `.from(...).insert(...)`
  call) instead of going through `rpc_book_service`.
- **Precondition:** the caller only needs a valid `authenticated` session.
  RLS policy `"txn customer create"` (`for insert with check (customer_id
  = auth.uid())`) checks nothing about `provider_id`, `state`, or
  financial amounts. The financial-write guard trigger
  (`guard_transaction_financial_write`) existed only as `BEFORE UPDATE`
  — it never fired on `INSERT` at all.
- **Impact:** a customer could create a `service_transactions` row with:
  any `provider_id` (published or not, verified or not, suspended or
  not, cleared for the category or not, or even a provider with no
  relationship to this customer at all), any `state` including terminal
  money-moving states (`funded`, `released`, `settled`, `refunded`), and
  any `service_amount_minor`/`platform_fee_minor`/`materials_amount_minor`.
  This does **not** by itself move real money — no `payments` or
  `ledger_entries` rows are created by a raw insert, since those only
  come from the RPCs — but it fabricates a transaction record that
  *looks* real, is visible to the named provider via
  `"txn participants read"` RLS (`provider_id`'s owning user can read
  it), appears in the customer's own booking history, and completely
  bypasses fee calculation, category-clearance checks, and the entire
  booking-state machine.
- **Severity:** **Critical.** Requires only a standard, self-serve
  customer account — the lowest possible bar. Financial-integrity and
  record-forgery risk on the platform's core "spine" table (the
  codebase's own description of `service_transactions`).
- **Exact affected object:** `service_transactions` table, RLS policy
  `"txn customer create"`, trigger `guard_transaction_financial_write`
  (only covered `BEFORE UPDATE`).
- **Current behavior (before fix):** insert succeeds unconditionally for
  any `customer_id = auth.uid()` row, regardless of `provider_id`,
  `state`, or amounts.
- **Correct behavior:** a direct client insert should be impossible, not
  merely constrained in shape. Every real booking path (four identified:
  `rpc_book_service`, `rpc_accept_quote`, `_create_recurring_occurrence`,
  `rpc_convert_deal_desk_request`) creates its row as the function
  owner (SECURITY DEFINER), completely unaffected by revoking the
  calling role's own table grant.
- **Remediation (prepared, NOT applied) — revised this pass, now
  two-layered:**
  1. **Primary:** `revoke insert on service_transactions from anon,
     authenticated;`. Confirmed live (via repo-wide grep) that no
     application code anywhere ever calls
     `.from("service_transactions").insert(...)` — every legitimate
     creation path is one of the four RPCs above. This closes the
     entire bug class at the grant layer, before RLS or any trigger is
     even evaluated — the cheapest, earliest, and most certain
     rejection point.
  2. **Defense-in-depth:** extend `trg_guard_transaction_financial_write`
     to also fire `BEFORE INSERT`, rejecting any insert with
     `state <> 'draft'` or any nonzero financial amount unless the
     existing session-local `app.bypass_txn_guard` flag is set (added
     to all four legitimate functions). Kept even with the revoke in
     place, in case the grant is ever mistakenly restored by a future
     migration or dashboard change.
  See `security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`
  (supersedes the `-002` file, which only had layer 2).
- **Tests:** live-verified via role-simulated, rolled-back SQL, in both
  configurations. With only the grant revoked (trigger untouched): the
  exact exploit insert (`state='settled'`, `service_amount_minor=99999900`,
  provider = the unverified QA fixture) was rejected with `"permission
  denied for table service_transactions"` — confirming the primary fix
  alone is sufficient. With both layers applied together: identical
  rejection via the trigger's own message when tested in isolation
  earlier in this pass. See Verification section below for full detail.
- **Residual risk:** none identified for this specific vector once
  applied. `UPDATE`/`DELETE` grants on `authenticated` were deliberately
  **not** revoked (see the proposal file's own comment) — no app code
  uses them either, but this pass could not fully rule out an
  intentional admin-console escape hatch outside the app UI, so that's
  flagged as a separate, smaller follow-up rather than bundled in here.
- **Production impact:** **not yet exploited as far as this audit could
  determine** — no `service_transactions` row in the live database has
  an implausible amount or a provider mismatch (checked: 6 total rows,
  all consistent with legitimate test activity from earlier sessions).
  This is a statement of "no evidence found," not a guarantee — the gap
  existed with no logging of attempted direct inserts, so a prior
  exploit attempt that failed for unrelated reasons (e.g. a bad FK)
  would leave no trace either way.
- **Status:** **APPLIED to production on 2026-09-15**
  (`supabase/migrations/20260915135253_marketplace_security_003_financial_hardening.sql`),
  per explicit user authorization. Post-apply live verification: the
  exact exploit insert was re-attempted (rolled back) against the live
  database and rejected with `"permission denied for table
  service_transactions"`, confirming the primary REVOKE-based fix is
  active in production. `get_advisors` (security) run post-apply shows
  no new findings introduced by this migration.

---

## SEC-P0-002 — `rpc_book_service` does not verify provider eligibility beyond category clearance

- **Attack path:** any authenticated customer calls
  `rpc_book_service(p_service_id, p_provider_id, ...)` directly (via
  Supabase RPC, bypassing the UI's own filtered provider list) with a
  `p_provider_id` that is cleared for the category but otherwise
  ineligible (unverified, unpublished, not accepting work, or
  suspended).
- **Precondition:** `authenticated` role only (confirmed: `anon` cannot
  call this RPC — `has_function_privilege('anon', ...)` returns
  `false`). The target provider must have at least one
  `provider_categories` row with `is_cleared = true` for the
  requested service's category — everything else about that provider's
  state is irrelevant to the old check.
- **Impact:** a real booking (`state='requested'`, correct fee
  calculation, correct scope items, milestones if qualifying) is
  created against a provider who is not actually eligible to work —
  most seriously, one who was never verified at all, or one who has
  since been suspended for a safety/fraud reason.
- **Severity:** **High.** This is the exact trust boundary the
  entire verification/publication/suspension system exists to enforce;
  a bypass here undermines all of it for the on-demand booking flow.
- **Exact affected function:** `rpc_book_service(uuid,uuid,uuid,timestamptz,text,text,text)`.
- **Current behavior (before fix):** checks only
  `provider_categories.is_cleared` for the requested category.
- **Correct behavior:** the supplied provider must be `is_published`,
  `verification_status = 'verified'`, `is_accepting_work`, not
  `is_suspended`, AND cleared for the category — all re-verified against
  the authoritative `providers` row inside the RPC itself, with a row
  lock (`for update`) to close the TOCTOU window where a provider could
  be suspended between the check and the insert.
- **Remediation (prepared, NOT applied):** see proposal file — adds the
  full eligibility predicate with a generic, non-sensitive rejection
  message ("This professional is not available for booking.") rather
  than leaking which specific condition failed.
- **Tests:** live-verified. Before fix: booking a `verification_status='submitted'`
  provider (the real, standing QA fixture, correctly category-matched)
  succeeded. After fix (in-transaction): same call blocked with the
  generic message; after legitimately re-verifying that same provider
  via the sanctioned `rpc_set_verification_status` admin RPC (also
  in-transaction), the identical booking call succeeded — proving the
  fix doesn't break the legitimate path.
- **Residual risk:** the row lock (`for update` on `providers`) closes
  the TOCTOU window for a *single* booking call, but was not verified
  under genuine concurrent load (two simultaneous sessions) — only
  reasoned about from Postgres's documented row-locking semantics. A
  true concurrency test would need two real concurrent connections,
  which this single-session verification methodology cannot exercise.
- **Production impact:** no evidence of exploitation found — 0
  providers are currently `is_published AND verification_status='verified'`
  live, and only 6 `service_transactions` rows exist total, all
  consistent with prior legitimate test activity.
- **Status:** **APPLIED to production on 2026-09-15**
  (`supabase/migrations/20260915135253_marketplace_security_003_financial_hardening.sql`),
  per explicit user authorization.

---

## SEC-P0-003 — `rpc_submit_quote` has an even weaker eligibility check than `rpc_book_service`

- **Attack path:** any provider account (even one with no clearance,
  verification, or publication at all) calls `rpc_submit_quote` on any
  open `service_request` in a category they've merely added to their
  profile.
- **Precondition:** caller must own a `providers` row
  (`user_id = auth.uid()`) — this rules out impersonating another
  provider, but nothing else is required.
- **Impact:** an unverified, unpublished, suspended, or not-accepting
  provider can submit a quote a customer might accept, creating a real
  booking (via the now-also-fixed `rpc_accept_quote`) with that
  ineligible provider.
- **Severity:** **High** — same class as SEC-P0-002, reached through a
  different entry point (quote flow instead of direct booking), and
  arguably easier to exploit since it didn't even require
  `is_cleared = true`, just row existence.
- **Exact affected function:** `rpc_submit_quote(uuid,bigint,text)`.
- **Current behavior (before fix):** checks only that a
  `provider_categories` row exists for the category — not `is_cleared`,
  not publication, not verification, not suspension, not accepting-work
  status.
- **Correct behavior:** same full eligibility predicate as
  `rpc_book_service`, checked against the calling provider's own row
  (locked `for update`).
- **Remediation:** see
  `security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`
  / `supabase/migrations/20260915135253_marketplace_security_003_financial_hardening.sql`.
- **Tests:** live-verified. Before fix: the unverified QA fixture
  provider successfully submitted a quote on a (test, rolled-back) open
  request. After fix (in-transaction, and again confirmed post-apply):
  blocked with "Your profile is not yet eligible to quote on this
  category."; after admin verification, an identical call succeeded.
- **Residual risk:** none new beyond SEC-P0-002's TOCTOU caveat.
- **Production impact:** `quotes` has exactly 1 live row; no evidence of
  exploitation found.
- **Status:** **APPLIED to production on 2026-09-15**, per explicit
  user authorization.

---

## SEC-P1-001 — `rpc_accept_quote` does not re-check provider eligibility at acceptance time (stale-quote TOCTOU)

- **Attack path:** not a malicious-actor attack path — a **timing** gap.
  A provider submits a quote while eligible; the provider is then
  suspended (or unpublished, or loses category clearance) for a
  legitimate trust-and-safety reason; the customer, unaware, accepts the
  now-stale quote before it expires.
- **Impact:** a real booking is created for a provider the platform has
  since determined should not be doing work.
- **Severity:** Medium-High — genuinely reachable via ordinary use (no
  attacker required), though it requires an admin action (suspension)
  to land in the narrow window between quote and acceptance.
- **Exact affected function:** `rpc_accept_quote(uuid)`.
- **Current behavior (before fix):** only re-validates `service_requests.state`
  and `quotes.state` — never re-checks the provider.
- **Correct behavior:** re-run the same eligibility predicate against
  the quoting provider (locked `for update`) before creating the
  transaction; if the provider is no longer eligible, reject with a
  message directing the customer to choose a different quote.
- **Remediation (prepared, NOT applied):** included in
  `security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`,
  since it's the identical eligibility predicate reused, now also
  extended to check `not coalesce(v_provider.is_test_fixture, false)`.
- **Tests (updated this pass — the disclosed gap is now closed):**
  live-tested end-to-end in a rolled-back transaction: created a
  `service_request`, submitted a `quote` from the QA fixture while
  legitimately verified (via `rpc_set_verification_status`, admin-
  simulated), then suspended the same provider (`is_suspended = true`,
  admin-simulated) before calling `rpc_accept_quote` as the customer.
  The fixed function correctly rejected the acceptance (provider no
  longer eligible at acceptance time) where the current, unpatched
  function would allow it. Also confirmed the ordinary/legitimate path
  (eligible provider, quote accepted, `service_transactions` row
  created with the correct `state='requested'` and
  `service_requests.state` flipped to `'awarded'` via the new sanctioned
  `app.bypass_txn_guard` bypass path) succeeds unchanged.
- **Residual risk:** none identified for the TOCTOU window itself now
  that it's live-verified; row-lock (`for update`) acquisition was
  confirmed to succeed without error in single-connection testing, but
  see the concurrency-testing limitation noted in "Known gaps" below.
- **Production impact:** none — all testing done inside rolled-back
  transactions; `quotes` table too small for any historical signal
  either way.
- **Status:** **APPLIED to production on 2026-09-15**
  (`supabase/migrations/20260915135253_marketplace_security_003_financial_hardening.sql`),
  per explicit user authorization.

---

## SEC-P0-004 — `service_requests.state` directly forgeable to `'awarded'` (found during MARKETPLACE-SECURITY-003)

- **Attack path:** an authenticated customer directly `UPDATE`s their own
  `service_requests` row (permitted by the existing "requests customer
  read/write own" RLS policy, which has no column-level restriction) and
  sets `state = 'awarded'` without ever going through `rpc_accept_quote`.
- **Precondition:** attacker is the owning customer of the request (or
  any authenticated user, if a future policy bug widens the write scope
  — same class of risk as SEC-P0-001).
- **Impact:** a request can be marked `'awarded'` with no accepted quote,
  no transaction, and no provider commitment — corrupting the state
  machine that the admin dashboard, notifications, and provider-facing
  views all assume is authoritative. Live-verified this pass: an
  `UPDATE service_requests SET state = 'awarded'` (with no
  `transaction_id` change) succeeded unguarded in a role-simulated,
  rolled-back transaction — confirming the finding is real, not
  theoretical.
- **Severity:** Critical — same class as SEC-P0-001 (arbitrary
  client-controlled state forgery on a record the rest of the system
  treats as authoritative), though with less direct financial blast
  radius since `service_requests` itself holds no money.
- **Exact affected object:** `service_requests` table, "requests
  customer read/write own" RLS UPDATE policy
  (`supabase/migrations/20260908134652_rls_policies.sql`); no CHECK
  constraint on `state` existed prior to this pass (only a documenting
  SQL comment) and no trigger guarded the column.
- **Current behavior (before fix):** any value satisfying no constraint
  at all is accepted for `state`, including `'awarded'`, from a plain
  client `UPDATE`.
- **Correct behavior:** `state` must be restricted to the documented set
  of values via a `CHECK` constraint, AND the transition into
  `'awarded'` (plus any change to `transaction_id`) must only be
  reachable through `rpc_accept_quote`'s sanctioned bypass path.
- **Remediation (prepared, NOT applied):**
  `alter table service_requests add constraint
  service_requests_state_check check (state in ('open','quoted',
  'awarded','expired','cancelled'));` plus a new
  `trg_guard_service_request_write` (`BEFORE UPDATE`) that rejects
  `new.state = 'awarded'` or any `transaction_id` change unless the
  session-local `app.bypass_txn_guard` flag is set — reusing the exact
  same bypass-flag mechanism as SEC-P0-001 rather than inventing a
  second one. `rpc_accept_quote` sets the flag immediately before its
  own `UPDATE service_requests SET state = 'awarded', transaction_id =
  ...`. See
  `security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`
  (FIX 3).
- **Tests:** live-verified via role-simulated, rolled-back SQL in both
  configurations. Before the fix: the forging `UPDATE` succeeded
  unguarded (confirming the vulnerability). With the trigger and CHECK
  constraint applied in-transaction: the identical `UPDATE` was rejected
  with the trigger's own error message; a `CHECK` violation was also
  independently confirmed for an out-of-set `state` value (e.g.
  `'bogus_state'`).
- **Residual risk:** none identified for this vector once applied. Grant
  revocation was deliberately **not** used here (unlike SEC-P0-001) —
  the customer legitimately needs `UPDATE` on their own request for
  other fields (e.g. cancelling, editing description), so the guard
  trigger is the correct primary mechanism for this table, not a
  blanket grant revoke.
- **Production impact:** none — found and fixed entirely inside rolled-
  back transactions; no live `service_requests` row was left in a
  forged state.
- **Status:** **APPLIED to production on 2026-09-15**
  (`supabase/migrations/20260915135253_marketplace_security_003_financial_hardening.sql`),
  per explicit user authorization. The `is_test_fixture` schema
  addition (FIX 7) is live; the separate data mutation flagging "QA
  Plumbing Pro" as a fixture remains NOT applied, pending its own
  authorization.

---

## Known gaps NOT fixed in this pass (explicitly, not silently)

- **`_create_recurring_occurrence`** and **`rpc_convert_deal_desk_request`**
  both need the same `app.bypass_txn_guard` flag added (mechanically —
  otherwise the SEC-P0-001 fix breaks them outright, since they also
  insert into `service_transactions`). This IS included in the proposal
  file. Whether they should *also* get a fresh provider-eligibility
  re-check (the way `rpc_accept_quote` now does) is a **product/design
  question, not fixed here**: recurring occurrences are generated for an
  already-established, already-approved series (should a provider
  suspension silently stop future occurrences, or should that be a
  distinct, visible cancellation event?); Deal Desk conversions are
  admin-initiated and admin-vetted by design. Flagging both for a
  follow-up design decision rather than guessing.
- **`is_test_fixture` column is now live (applied 2026-09-15), but no
  provider is yet flagged with it.** FIX 7 added a `NOT NULL DEFAULT
  false` boolean column, a `CHECK` constraint making it impossible for a
  test fixture to ever be `is_published = true` (even by admin
  mistake), and extended the existing `trg_guard_provider_trust_fields`
  trigger to guard it the same way it already guards
  `verification_status`/`is_published`/`is_suspended`. Live-verified
  both pre-apply (rolled-back transaction) and post-apply against
  production: an attempted `UPDATE providers SET is_test_fixture =
  true, is_published = true` in a single statement is rejected by the
  `CHECK` constraint. The actual data mutation flagging "QA Plumbing
  Pro" as a fixture is intentionally left as a **separate, explicitly-
  called-out, not-yet-authorized** statement (still commented out in
  both the proposal file and the applied migration file), since it
  changes existing data, not just schema/behavior — distinct from and
  requiring separate sign-off beyond the schema/behavior
  changes above.
- **Server-side EXIF/metadata validation, live-video capture, and the
  native-app path** for evidence-capture enforcement (TSF-001) remain
  open — unrelated to this task's scope, noted only for completeness
  against the standing register.
- **No genuine multi-connection concurrency test** was performed for
  any `for update` row-lock TOCTOU fix (SEC-P0-002/003's booking/quote
  locks, or SEC-P1-001's acceptance-time re-check) — each verification
  in this pass ran as a single, non-interleavable transaction via the
  available SQL-execution tool, which cannot open two concurrent
  connections and pause one mid-transaction to interleave with another.
  What WAS verified: (a) the `for update` lock acquisition itself
  succeeds without error against a real row in every test, (b)
  Postgres's documented row-lock semantics guarantee a second
  transaction's `for update` (or an `UPDATE`) on the same `providers`
  row blocks until the first transaction commits or rolls back, which
  is the exact property the TOCTOU fix depends on, and (c) code review
  confirms the lock is acquired before the eligibility check runs, not
  after. This is reasoned correctness from documented Postgres behavior
  plus single-connection execution proof, not empirical proof under
  real concurrent load — disclosed as a real limitation, not glossed
  over.

# Financial Integrity Model

Formal statement of the invariants that must hold across every
financially-sensitive table in this schema, written as part of
MARKETPLACE-SECURITY-003 (Phase 8). This is not a new design — it names
and formalizes invariants the codebase already assumes implicitly
(scattered across trigger comments, RPC bodies, and the reconciliation
cron), using this pass's concrete implementation
(`security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`)
as the worked example of how each invariant is actually enforced, or
proposed to be enforced. None of the mechanisms below are applied to
production as of this writing — see `SECURITY_READINESS_REGISTER.md`
for status.

## 1. Invariant: a financial transaction can only be created through a sanctioned path

**Statement:** every row in `service_transactions` with a non-`draft`
state or non-zero financial amounts must have been created by one of
the four sanctioned functions — `rpc_book_service`, `rpc_accept_quote`,
`_create_recurring_occurrence`, `rpc_convert_deal_desk_request` — never
by a direct client `INSERT`.

**Why it matters:** these four functions are the only places that run
the eligibility predicate (invariant 3) and compute amounts from
trusted, server-side pricing data. A direct insert bypasses both.

**Enforcement (proposed, two-layered):**
- **Primary:** `revoke insert on service_transactions from anon,
  authenticated`. Confirmed via repo-wide grep that no application code
  anywhere performs a direct client insert — every legitimate path is
  one of the four functions above, each `SECURITY DEFINER` and thus
  unaffected by revoking the calling role's own grant. This closes the
  bug class at the earliest possible point, before RLS or any trigger
  runs.
- **Defense-in-depth:** `trg_guard_transaction_financial_write`
  (extended to also fire `BEFORE INSERT` this pass) rejects any insert
  with `state <> 'draft'` or any nonzero amount column, unless the
  session-local `app.bypass_txn_guard` flag is set. Each of the four
  sanctioned functions sets this flag (`perform
  set_config('app.bypass_txn_guard', 'on', true)`, `LOCAL` — scoped to
  the current transaction only, cannot leak to another statement or
  session) immediately before its own insert.

**Verification performed:** live-tested in rolled-back transactions —
the exploit insert (`state='settled'`, large `service_amount_minor`,
unverified provider) was rejected both with only the grant revoked
(`permission denied`) and with only the trigger applied (guard error
message). See `SECURITY_READINESS_REGISTER.md` SEC-P0-001.

## 2. Invariant: financial state transitions are monotonic and one-way through sanctioned functions only

**Statement:** a `service_transactions.state` transition, a
`quotes.state` transition, and a `service_requests.state` transition
into `'awarded'` must each happen through exactly one sanctioned
function per transition, never through a direct client `UPDATE`.

**Enforcement:**
- `service_transactions`: existing `trg_guard_transaction_financial_write`
  (originally `UPDATE`-only, pre-dating this pass) already blocked
  direct state/amount changes outside the bypass flag — unaffected by
  this pass beyond extending it to also cover `INSERT` (invariant 1).
- `quotes.state`: had no `CHECK` constraint prior to this pass (only a
  documenting SQL comment). `quotes_state_check` (`state in ('pending',
  'accepted','declined','expired')`) constrains the value space; the
  *transition itself* (pending → accepted) is enforced by
  `rpc_accept_quote`'s own logic, which re-validates
  `quotes.state = 'pending'` before proceeding.
- `service_requests.state`: had no `CHECK` constraint and no trigger
  prior to this pass — **SEC-P0-004**, found this pass. A customer
  could directly `UPDATE service_requests SET state = 'awarded'` with
  no accepted quote and no transaction, live-verified as succeeding
  unguarded. Fixed by adding `service_requests_state_check` (value
  space) plus a new `trg_guard_service_request_write` (`BEFORE UPDATE`)
  that rejects `state = 'awarded'` or any `transaction_id` change
  unless `app.bypass_txn_guard` is set — reusing the exact same
  bypass-flag mechanism as invariant 1 rather than inventing a second
  one. `rpc_accept_quote` sets the flag before its own
  `service_requests` update.

**Verification performed:** live-tested in rolled-back transactions,
both the vulnerability (pre-fix forging succeeds) and the fix (post-fix
forging rejected, legitimate `rpc_accept_quote` path still succeeds).
See `SECURITY_READINESS_REGISTER.md` SEC-P0-004 and SEC-P1-001.

## 3. Invariant: only an eligible provider can be attached to a financial transaction or quote

**Statement:** a `service_transactions` or `quotes` row may only
reference a provider that is, at the moment of creation (or, for
`rpc_accept_quote`, at the moment of acceptance): `is_published = true`,
`verification_status = 'verified'`, `is_accepting_work = true`,
`is_suspended = false`, `is_test_fixture = false` (once that column
exists), and cleared for the relevant category
(`provider_categories.is_cleared`). This check must be re-derived
server-side against a locked row — never trusted from client input or
from what the UI happened to filter and display.

**Why re-derive from a locked row, not just re-check:** a provider's
eligibility can change between when a customer views a listing and when
they submit a booking or accept a quote (an admin suspension, a
verification expiry). Checking a stale value read earlier in the same
request is not sufficient — the check must read the current row, locked,
at the moment of the state-changing write.

**Enforcement:** `select ... from providers where id = ... for update`
inside `rpc_book_service`, `rpc_submit_quote`, and `rpc_accept_quote`,
immediately followed by the full predicate above evaluated against the
locked row. The `for update` lock means a concurrent admin
suspend/unpublish `UPDATE` on the same `providers` row must wait for the
booking/quote/acceptance transaction to finish (or the booking
transaction waits for the admin action, whichever started first) —
closing the TOCTOU window rather than merely narrowing it.

**Verification performed:** live-tested in rolled-back transactions for
all three functions, including a full `rpc_accept_quote` reproduction of
the exact TOCTOU scenario (verify → quote → suspend → attempt accept →
rejected). **Not** independently verified under genuine multi-connection
concurrency — see "Concurrency testing" below.

**Residual, explicitly not fixed this pass:** `quotes` can still be
inserted directly via RLS (ownership-scoped, not eligibility-scoped),
bypassing `rpc_submit_quote`'s eligibility check entirely. This cannot
by itself move money — a quote alone creates no transaction — and
`rpc_accept_quote` now re-checks eligibility at acceptance regardless of
how the quote was created, so the residual risk is bounded. See
`SECURITY_AUTHORIZATION_MATRIX.md`'s "Residual gap" section.

## 4. Invariant: a test/QA fixture provider can never be bookable

**Statement:** a provider explicitly marked as a test fixture must be
structurally incapable of being published, regardless of any other flag
combination or any future code path.

**Enforcement (proposed, not applied):** new `providers.is_test_fixture
boolean not null default false` column, backed by a `CHECK` constraint
(`not (is_test_fixture and is_published)`) — a database-level guarantee
that survives even a bug in application code or a mistaken admin click,
not just an application-level filter. Also added to
`trg_guard_provider_trust_fields`'s existing guarded-field list
(admin-only or bypass-flag change), consistent with how
`verification_status`/`is_published`/`is_suspended` are already
protected.

**Verification performed:** live-tested in a rolled-back transaction —
attempting to set both `is_test_fixture = true` and `is_published =
true` in one statement was rejected by the `CHECK` constraint.

**Not yet done, separately authorized:** the actual data mutation
flagging "QA Plumbing Pro" (`aa332618-bf31-4af2-b699-f8bba7b47bdb`) as a
fixture is a commented-out statement in the proposal file, deliberately
separated from the schema/behavior change above since it mutates
existing data.

## 5. Invariant: financial amount columns are never negative and never independently attacker-set

**Statement:** `service_amount_minor`, `materials_amount_minor`, and
`platform_fee_minor` must always be `>= 0` (pre-existing `CHECK`
constraints on all three, confirmed unchanged by this pass) and must
only ever be set by a sanctioned creation function computing them from
trusted, server-side pricing data — never from client-supplied values
accepted verbatim.

**Enforcement:** the `>= 0` `CHECK` constraints pre-date this pass and
were confirmed still in place. The "never attacker-set" half is the
same mechanism as invariant 1 (INSERT is blocked entirely for direct
clients; the four sanctioned functions compute amounts themselves rather
than accepting a client-supplied total).

**Not separately exploitable beyond invariant 1** — there is no update
path that lets a customer or provider directly modify these columns
post-creation; the only write vector was the same direct-insert bypass,
already covered.

## 6. Invariant: the ledger stays balanced (pre-existing, unaffected by this pass)

**Statement:** for every settled transaction, the sum of `ledger_entries`
across account types nets to zero (or to the expected non-zero residual
for funds genuinely held in escrow pending release).

**Enforcement:** pre-existing `rpc_admin_check_ledger_balance` and a
reconciliation cron job (from earlier session work, unrelated to this
pass) already check this independently of anything in this proposal.
Not re-verified in this pass — listed here only for completeness of the
overall integrity picture, since `payments`/`ledger_entries` were
confirmed (Phase 6 of this pass) to already be correctly protected by
RLS default-deny with no client write policy at all.

## Concurrency testing — what could and could not be verified

**What was not possible:** genuine multi-connection concurrency testing
(opening two separate database connections, pausing one mid-transaction
while the other runs, and observing the interleaving) was not possible
with the available tooling. Every verification in this pass ran as a
single `execute_sql` call — one connection, one transaction, executed
and rolled back atomically. There is no mechanism available in this
session to hold a transaction open while a second, independent
connection attempts a conflicting write.

**What was verified instead:**
- The `for update` lock acquisition itself succeeds without error
  against a real, live `providers` row in every test that used it — the
  lock statement is syntactically and semantically valid against the
  real schema, not just reviewed in the abstract.
- Postgres's documented row-lock semantics (a `SELECT ... FOR UPDATE`
  blocks a concurrent `UPDATE` or another `SELECT ... FOR UPDATE` on the
  same row until the holding transaction commits or rolls back) are a
  documented, well-established property of the database engine this
  fix relies on, not a novel or unverified assumption.
- Code review confirms the lock is acquired *before* the eligibility
  predicate is evaluated in all three functions (`rpc_book_service`,
  `rpc_submit_quote`, `rpc_accept_quote`), which is the specific
  ordering the TOCTOU fix depends on — a lock acquired after the check
  would not close the race.

**What this does not prove:** that the fix behaves correctly under real
concurrent load (connection pool exhaustion, lock wait timeouts,
deadlock scenarios involving other concurrent locks elsewhere in the
same request). This is a genuine, disclosed limitation, not glossed
over — recommended as a follow-up once a staging environment with
multi-connection test tooling exists (tracked elsewhere in the register
as `REL-002`/`LOADTEST-001`).

## Summary table

| # | Invariant | Status |
|---|---|---|
| 1 | Transactions only created via sanctioned functions | Fix designed + live-tested, NOT applied |
| 2 | State transitions only via sanctioned functions | Fix designed + live-tested, NOT applied |
| 3 | Only eligible providers attached to transactions/quotes | Fix designed + live-tested, NOT applied |
| 4 | Test fixtures structurally unbookable | Fix designed + live-tested, NOT applied |
| 5 | Financial amounts non-negative, never attacker-set | Pre-existing `CHECK`s confirmed intact; covered by #1 |
| 6 | Ledger stays balanced | Pre-existing mechanism, unaffected, not re-verified this pass |

No production migration has been applied for any of the above. See
`security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`
for the complete, single authoritative proposal (supersedes the `-002`
file) and `SECURITY_READINESS_REGISTER.md` for per-finding status.

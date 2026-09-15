# Security Authorization Matrix

Who/what can invoke each provider-work-creating and provider-eligibility-
relevant surface, and what actually gates it today vs. what should gate
it after `SECURITY_READINESS_REGISTER.md`'s SEC-P0-001/002/003/004/P1-001
fixes are authorized and applied. "Grant" columns are live-verified via
`has_function_privilege()`; "Real check" columns describe what the
function body itself enforces (not what RLS or the UI merely happens to
pass it).

> **MARKETPLACE-SECURITY-003 update (same day):** added the full
> client-write matrix below (Phase 6) covering every financially-
> sensitive table named in that task, explicitly marking which ones do
> not exist rather than guessing; added the `service_requests` guard
> row (SEC-P0-004) to the provider-work-creating table; updated the
> `providers` trust-field section to include the proposed
> `is_test_fixture` column. All of this reflects
> `security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`.
>
> **Applied (2026-09-15), per explicit user authorization:** as
> `supabase/migrations/20260915135253_marketplace_security_003_financial_hardening.sql`.
> Every "After proposed fix" column below is now the live, current
> behavior in production, not a future state — confirmed via live
> rolled-back-transaction re-tests post-apply. The one exception is the
> `is_test_fixture` *data* mutation for the standing QA fixture provider
> (not part of this table's schema/behavior scope), which remains
> unapplied pending separate authorization.

## Provider-work-creating paths

| Path | Caller | anon grant | authenticated grant | Provider eligibility check today | After proposed fix |
|---|---|---|---|---|---|
| Direct `INSERT` into `service_transactions` | any signed-in customer | n/a (RLS, not a grant) | Permitted by RLS (`customer_id=auth.uid()` only) | **None at all** — provider_id/state/amounts fully attacker-controlled | Table-level guard rejects any non-`draft`, non-zero-amount insert unless the sanctioned bypass flag is set |
| `rpc_book_service` | customer | ❌ false | ✅ true | `provider_categories.is_cleared` only | + published, verified, accepting, not suspended, row-locked |
| `rpc_submit_quote` | provider (self) | ❌ false | ✅ true | `provider_categories` row exists (not even `is_cleared`) | + is_cleared, published, verified, accepting, not suspended, row-locked |
| `rpc_accept_quote` | customer (request owner) | ❌ false | ✅ true | None on the provider at acceptance time (only quote/request state) | + full eligibility predicate re-checked, row-locked |
| `_create_recurring_occurrence` | scheduled job (`rpc_generate_due_recurring_occurrences`, `authenticated`/`anon` revoked entirely — confirmed `revoke all ... from public, anon, authenticated` in its own migration) | ❌ false | ❌ false | None — series was approved once at creation | Unchanged this pass (needs bypass flag only, or the new INSERT guard breaks it); re-check-on-generate is an open product question, not fixed here |
| `rpc_convert_deal_desk_request` | admin only (`is_admin()` check) | ❌ false | ✅ true (gated internally by `is_admin()`) | None — admin-vetted by design | Unchanged this pass; needs bypass flag only |
| Direct `INSERT` into `quotes` | provider (self) | n/a (RLS) | Permitted by RLS, but requires `provider_id` ownership (`exists (... p.user_id = auth.uid())`) — cannot impersonate another provider | None on eligibility (published/verified/accepting/suspended); `state` had no CHECK constraint at all | `quotes_state_check` constraint added (state must be one of 4 documented values); eligibility still only enforced at the RPC layer, not by RLS — **residual gap**, see below |
| Direct `UPDATE` of `service_requests.state` / `transaction_id` | customer (request owner) | n/a (RLS) | Permitted by RLS ("requests customer read/write own"), no column restriction | **None at all** — `state` forgeable to `'awarded'` with no accepted quote or transaction (SEC-P0-004, found this pass) | `service_requests_state_check` CHECK constraint + `trg_guard_service_request_write` rejects `state='awarded'` or any `transaction_id` change unless the sanctioned bypass flag is set |

## Phase 6 — full client-write matrix (MARKETPLACE-SECURITY-003)

Every table this task named, checked against the live schema. Tables
that do not exist are marked explicitly rather than assumed or invented.

| Named table | Exists? | Real table / mechanism | Client write surface today | Gap found this pass |
|---|---|---|---|---|
| `service_transactions` | ✅ | — | Direct `INSERT` permitted by RLS (`customer_id=auth.uid()`), no shape restriction pre-fix | **SEC-P0-001 (Critical)** — see above; primary fix is `revoke insert ... from anon, authenticated` |
| `quotes` | ✅ | — | Direct `INSERT` permitted by RLS, ownership-scoped only | **Residual gap** (eligibility not enforced by RLS, see below) + `state` had no CHECK (fixed) |
| `service_requests` | ✅ | — | Direct `UPDATE` permitted by RLS, no column restriction | **SEC-P0-004 (Critical)** — see above |
| `payments` | ✅ | — | SELECT-only RLS policy exists; **no INSERT/UPDATE/DELETE policy at all** — Postgres RLS default-deny means every client write is blocked regardless of the broad table-level grant. Confirmed live via `pg_policies`. | None — already correctly protected; all real writes happen via `SECURITY DEFINER` functions (e.g. `rpc_confirm_manual_payment`'s dual-control flow) that bypass RLS as the function owner |
| `ledger_entries` | ✅ (this is what the task's "ledger" refers to) | — | Same as `payments`: SELECT-only RLS policy, no write policy, default-deny blocks all client writes | None — already correctly protected |
| `payment_events` | ✅ | — | SELECT-only RLS policy, no write policy | None — already correctly protected |
| `payment_provider_events` | ✅ | — | SELECT-only RLS policy, no write policy | None — already correctly protected |
| `admin_actions` | ✅ (serves the role the task's "audit_logs" would) | — | SELECT-only RLS policy, no write policy | None — already correctly protected |
| `escrow` | ❌ **Does not exist as a table.** | Escrow is modeled as a `ledger_entries.account_type` value (`funds_held`), not a separate table. | n/a | n/a — covered by `ledger_entries`' protection above |
| `payouts` | ❌ **Does not exist as a separate table.** | A payout is represented as `provider_payable` `ledger_entries` rows plus a notification; there is no running-balance or dedicated payout table in this schema. | n/a | n/a — covered by `ledger_entries`' protection above |
| `refunds` | ❌ **Does not exist as a separate table.** | A refund is represented as a `ledger_entries.account_type` value and/or the `service_transactions.state = 'refunded'` value. | n/a | n/a — covered by `ledger_entries` and `service_transactions` protection above |
| `commissions` | ❌ **Does not exist as a separate table.** | Represented as the `service_transactions.platform_fee_minor` plain `bigint not null default 0 check (>= 0)` column, not a table of its own. | Inherits `service_transactions`'s protection (no direct client INSERT once SEC-P0-001's fix is applied; no UPDATE grant used by any app code, and RLS restricts customer UPDATE to their own rows via the guard trigger's field list — `platform_fee_minor` itself is not separately guarded from an authorized customer/admin path, since no such path currently allows a customer to update it post-creation) | Not separately exploitable beyond SEC-P0-001 — the only write path is the same INSERT bypass, already covered |
| `provider_balances` | ❌ **Does not exist.** | No running per-provider balance table; balances are computed on read from `ledger_entries`, not stored/written. | n/a | n/a |
| `audit_logs` | ❌ **Does not exist by that name.** | `admin_actions` serves this role for admin-initiated changes; there is no separate, generic audit-log table capturing all financial writes. | SELECT-only RLS, no write policy | None — already correctly protected (for what it does cover); **not** a full audit trail of every financial table write (a known, pre-existing gap, not introduced or fixed by this pass) |

**Summary:** of the twelve tables/concepts the task named, three are real
tables with a genuine client-write gap this pass addresses
(`service_transactions`, `quotes`, `service_requests`), five are real
tables already correctly protected by RLS default-deny with no policy
permitting client writes (`payments`, `ledger_entries`,
`payment_events`, `payment_provider_events`, `admin_actions`), and six
named concepts do not exist as separate tables at all (`escrow`,
`payouts`, `refunds`, `commissions`, `provider_balances`,
`audit_logs`) — each is modeled as a column or account-type value on a
table that already has the correct protection above.

## Read/administrative paths (unaffected by this task, listed for completeness)

| Path | Caller | Check |
|---|---|---|
| `rpc_admin_set_provider_suspended` | admin, dual-control (GOV-P4) | `can_act_on_approval` → `is_trust_safety_admin()`, requires a second, different admin to decide |
| `rpc_set_verification_status` | admin | `is_admin()` |
| `rpc_admin_set_provider_published` | admin | `is_admin()` |
| `rpc_set_category_clearance` | admin | `is_admin()` |

## Residual gap: `quotes` INSERT via RLS does not enforce eligibility, only ownership

RLS's `"quotes provider own read/write"` policy lets a provider insert a
quote row directly (bypassing `rpc_submit_quote` entirely) as long as
`provider_id` matches their own — it does not check `is_cleared`,
`is_published`, `verification_status`, `is_accepting_work`, or
`is_suspended`. `trg_enforce_quote_cap` (the 5-quotes-per-request cap)
still fires regardless of path, since triggers apply to every insert. The
proposed fix in this pass hardens `rpc_submit_quote` itself but does
**not** close this direct-RLS-insert path — doing so would require either
moving the eligibility check into a `WITH CHECK` subquery on the RLS
policy (adds real query cost to every quote insert, including the
already-checked RPC path) or accepting that `rpc_submit_quote` is the
sanctioned path and a direct insert bypassing it is a known,
lower-severity residual (it cannot move money by itself — the
transaction is only created later, by `rpc_accept_quote`, which now
re-checks eligibility). **Flagged for a decision, not fixed silently.**

## `providers` trust-field protection (found during this pass, already correct)

`providers.verification_status`, `is_published`, and `is_suspended` are
protected by an existing trigger (`trg_guard_provider_trust_fields`,
found live during this pass while attempting a direct `UPDATE` for a
test) that blocks direct writes outside the sanctioned admin RPCs
(`rpc_set_verification_status`, `rpc_admin_set_provider_published`,
`rpc_admin_set_provider_suspended`). This closes the equivalent
direct-table-write vector for provider trust fields that SEC-P0-001
found open on `service_transactions` — confirmed live: `update providers
set verification_status='verified' where id=...` raised `"Verification
status, publish state, and suspension can only be changed by an admin
via the relevant rpc_*."` when attempted as a non-admin during this
pass's own testing. No fix needed here — noted as a positive finding.

**Extended this pass, APPLIED 2026-09-15:** the same trigger's
guarded-field list now also covers `providers.is_test_fixture` (FIX 7
of the -003 migration), using the identical admin-only-or-bypass-flag
mechanism — no new dedicated RPC needed, since the trigger already
permits a direct admin `UPDATE`. A `CHECK` constraint (`not
(is_test_fixture and is_published)`) backs this up at the schema level
so a test fixture can never be published even by an admin mistake or a
future bug in the trigger itself — confirmed live post-apply: an
`UPDATE providers SET is_test_fixture = true, is_published = true`
attempt against production was rejected with `"new row for relation
\"providers\" violates check constraint
\"providers_test_fixture_not_published\""` (rolled back). No provider
row has actually been flagged `is_test_fixture = true` yet — that data
mutation remains separately unauthorized.

## Provider ranking must consume this layer, never bypass it

Per `PROVIDER_MATCHING_AND_RANKING_AUDIT.md`'s Phase 5 design: any future
ranking/recommendation feature must call the **same eligibility
predicate** this fix installs in `rpc_book_service`/`rpc_submit_quote`
(ideally factored into a shared `_is_provider_eligible(provider_id,
category_id)` helper once this fix is authorized and applied, rather
than re-implementing the boolean expression a third time) — a ranking
function must never independently decide that an otherwise-ineligible
provider (unverified, unpublished, suspended, uncleared) can be surfaced
or booked. Ranking operates strictly *within* the eligible set this
layer produces; it has no authority to expand it.

# Testing (SEC-001)

Three tiers, per `MARKETPLACE_REMEDIATION_REGISTER.md` SEC-001's own plan.

```
npm test          # runs all tiers vitest can find
npx tsc --noEmit  # typecheck
npm run build     # production build
```

CI (`.github/workflows/ci.yml`, added in an earlier pass) runs all three
on every push/PR.

## Tier 1 — DB / RLS / authorization tests (`tests/db/*.test.ts`)

The highest-value tier for this codebase: almost all financial and
authorization logic lives in Postgres `SECURITY DEFINER` functions, not
in the Next.js layer, so this is the only tier that actually exercises
it. Every test opens a real transaction against the live schema, runs
under the exact role-simulation pattern used throughout this project's
manual verification (`set local role authenticated; set local
request.jwt.claims = '{"sub": "...", ...}'`), asserts, and rolls back —
`tests/db/client.ts`'s `withRolledBackTransaction` guarantees nothing
here ever persists, so it's safe to point this at the real project
(there's no local/branch Postgres set up for this project yet — see
`REL-002` / `LOADTEST-001`).

**Requires `SUPABASE_DB_URL`** — a direct Postgres connection string
(Supabase dashboard → Project Settings → Database → Connection string;
**not** the anon/publishable key or the service-role key, neither of
which grants a raw SQL connection). Without it, every test in this tier
calls `describe.skipIf` and is reported as skipped, not failed — `npm
test` still exits 0. **This env var was not available in the sandbox
these tests were originally written and verified-by-inspection in**: no
tool available to that session exposed the database password (Supabase's
own MCP tools deliberately don't — `get_project_url`/`get_publishable_keys`
return the REST API URL and anon/publishable keys only), and the sandbox's
network egress goes through an HTTPS-only proxy that a raw Postgres
connection likely wouldn't route through even with the password. Neither
limitation is expected to apply to a real CI runner or a developer's own
machine.

**To turn this tier on:**
1. Get the connection string from the Supabase dashboard.
2. Locally: `SUPABASE_DB_URL='postgresql://...' npm test`.
3. In CI: add it as a repository secret named `SUPABASE_DB_URL`
   (Settings → Secrets and variables → Actions) — the workflow already
   references `${{ secrets.SUPABASE_DB_URL }}`, nothing else to change.

**How the SQL in these tests was actually validated**, given the above:
every assertion was run manually, live, via the Supabase MCP's
`execute_sql` tool, using the identical SQL (role simulation, fixture
IDs, expected outcomes) before being transcribed into these test files.
That's real verification of the *logic* — it is not the same as this
exact `.test.ts` file having been executed by `vitest`, which is why
this isn't reported as "done," only as real, working, CI-ready
infrastructure with its first two suites in place.

**Known simplification:** these tests depend on specific fixture UUIDs
(`tests/db/client.ts`'s `FIXTURES`) already seeded in the live project
rather than creating fully synthetic data per test. If those rows are
ever deleted, these tests will fail with a clear "not found"-style error,
not silently pass. A more mature version would create and tear down its
own fixtures — tracked here, not silently assumed solved.

**What's covered so far:** `rpc_confirm_manual_payment`'s dual-control
propose/decide/self-block/distinct-admin-execution flow (PAY-004), that
the `_execute_*` functions behind every dual-control action remain
un-callable directly by `anon`/`authenticated` (SEC-013 — this is the
single test most likely to catch a regression of that exact bug class),
all four of `rpc_cancel_booking`'s cancellation-fee tiers (TXN-005),
including the milestone-aware case, and provider-eligibility
authorization (`tests/db/provider-eligibility.test.ts`,
MARKETPLACE-SECURITY-002/003) — 12 tests describing the FIXED,
not-yet-applied behavior for `rpc_book_service`/`rpc_submit_quote`/
`rpc_accept_quote`/direct `service_transactions` and `quotes` inserts,
`service_requests.state` forgery (SEC-P0-004), the proposed
`is_test_fixture` schema guarantee, a full `rpc_accept_quote`
positive/TOCTOU pair, and `rpc_book_service`'s idempotency-key
behavior; see `SECURITY_READINESS_REGISTER.md` and
`FINANCIAL_INTEGRITY_MODEL.md` for why they currently fail against the
live, unpatched database and what needs authorizing before they'll
pass. **Not yet covered:** the rest of the
RPCs SEC-001's own definition of done names — TXN-010's three repair
tools, `rpc_resolve_dispute`, `rpc_open_dispute`/the SLA sweep (TXN-004),
recurring-series (TXN-011), milestones (TXN-012) beyond what the
cancellation tests incidentally exercise, and a genuine negative-RLS
suite (a customer directly `UPDATE`ing another customer's row, etc.).
Adding one of these is a self-contained, incremental unit of work — the
pattern in `tests/db/dual-control.test.ts` and
`tests/db/cancellation-fees.test.ts` is the template.

## Tier 2 — server action / route handler unit tests (`*.test.ts` next to the module)

Mock `@/lib/supabase/server`'s `createClient` and assert the exact RPC
name and parameters a server action sends, plus that a database error is
surfaced to the caller rather than thrown or swallowed. Lower ceiling
than tier 1 for this codebase specifically (these are thin RPC-calling
wrappers; the real logic is in Postgres), but genuinely useful for
catching a renamed RPC, a dropped parameter, or broken error handling —
and it's the one tier that runs everywhere, no credentials needed.

Covered: `cancelBooking`/`openDispute`/`approveBooking`
(`src/app/account/bookings/[id]/actions.ts`), the three TXN-010 repair
actions (`src/app/admin/bookings/[id]/repair-actions.ts`), and
`confirmPayment` (`src/app/admin/payments/actions.ts`). Same pattern
extends to any other server action.

`vitest.config.ts` resolves the `@/*` path alias (Next's `tsconfig.json`
alias isn't read by Vitest automatically) and `vitest.setup.ts` stubs
the `server-only` package, which otherwise throws unconditionally
outside Next's own bundler — both were missing before this pass, which
is why no test file had imported a server action module until now.

## Tier 3 — end-to-end

Depends on `REL-002` (a staging environment) — not started. `docs/`-cited
browser QA this project has done to date (Kernel-driven click-throughs)
has been manual, ad hoc, and not captured as an automated suite.

## What SEC-001 being "in progress" still means

Full closure requires every RPC listed under "financial/authorization
logic" in `SECURITY.md` to have a passing tier-1 test for both the
authorized and unauthorized path, and CI enforcing it — a genuinely
multi-week effort given the number of RPCs in this schema, exactly as
the register's own complexity estimate says. What this pass adds: the
test runner is wired up correctly (alias resolution, `server-only`
mocking — both real, previously-blocking bugs, not just "nothing existed
yet"), a working tier-1 harness with two real suites covering this
session's highest-risk financial logic, a tier-2 suite covering this
session's newest server actions, and CI running all of it on every PR.

# Marketplace Release and Rollback Plan

Companion to the register's `REL-*` items, and incorporates the founding
brief's §24 testing-matrix and §22 release-engineering requirements.

## 1. Current release process, as it actually exists today

**Confirmed (session history, this project):** every change in this
project's entire history — schema migrations, RLS policies, RPCs, frontend
code — has gone directly to the single production Supabase project and the
Vercel production deployment. Safety has come from: (a) role-simulated SQL
transactions (`begin; ...; rollback;`) as a pre-commit check against the
live database, (b) manual `npx tsc --noEmit`/`npm run build` before every
commit, (c) careful, incremental, reviewed migrations. This has worked
without a known production incident so far, but it is **not a substitute
for a real staging environment** (REL-002) and should not be treated as
equivalent to one going forward, especially as real users and real money
become involved.

## 2. Migration safety — what's already good practice here, restated

- Every migration is additive-first where possible (new columns/tables
  before touching existing ones) — a pattern visible throughout this
  project's migration history.
- Migrations that change function signatures have caused a real, self-caught
  problem this session (`rpc_book_service`'s overload/grant issue) —
  **the concrete lesson**: any `CREATE OR REPLACE FUNCTION` that changes the
  argument list creates a *new* overload in Postgres rather than replacing
  in place, silently leaving the old version callable and the new version
  with default (often too-permissive) grants. **This must be an explicit
  checklist item in every future migration review**, not just a lesson
  learned once.
- Append-only tables are used deliberately for anything financial/auditable
  — this pattern should be the default for any new table storing
  irreversible facts (payments, disputes, admin actions), not something to
  re-derive from scratch each time.

## 3. Release checklist (new, to be adopted)

Before any migration or deploy touching production:

1. [ ] Migration applied and tested against staging first (once REL-002
   exists — until then, against a disposable local/branch DB where
   possible, never directly against production without the safeguards in
   §4 below).
2. [ ] If the migration changes a function's argument list, explicitly
   verify via `pg_proc`/`pg_get_function_identity_arguments` that exactly
   one overload exists afterward, with the intended grants — this check is
   now a standing requirement, not optional, given the incident in §2.
3. [ ] `npx tsc --noEmit` clean.
4. [ ] `npm run build` clean.
5. [ ] Role-simulated SQL verification for any RLS/authorization-relevant
   change (the established, proven pattern from this project's history).
6. [ ] Advisor re-run (`mcp__Supabase__get_advisors`) shows no new findings
   introduced by the change.
7. [ ] Diff reviewed in full before commit.
8. [ ] Commit message accurately describes what changed and what was
   verified (this project's own commit-message convention already does
   this well — continue it).
9. [ ] Smoke tests run post-deploy (REL-003 — doesn't exist yet as an
   automated suite; until it does, this is a manual checklist of the 3–5
   most critical pages/flows).

## 4. Rollback strategy

**Current state: forward-fix only, implicitly.** No migration in this
project's history has ever included a paired "down" migration. This is a
reasonable default for an early-stage project with a small, careful team,
but should be made an **explicit** choice, not an accidental one:

- **Schema rollback:** for additive changes (new column/table/function),
  rollback is rarely needed — simply don't use the new capability. For
  changes that alter existing behavior (like the RLS consolidation work),
  a genuine rollback requires writing the reverse migration by hand at
  rollback time, since none is pre-written. **Recommendation:** for any
  migration classified as "high risk" in its own commit message (per this
  project's established practice of flagging risk explicitly), write the
  down-migration alongside it, even if not immediately applied.
- **Frontend rollback:** Vercel's own instant-rollback-to-previous-deployment
  capability (a platform feature — **Not confirmed** whether this project's
  Vercel plan includes it, Blocked — external access) is the fastest path
  and should be the first response to a frontend-only incident.
- **Old/new frontend coexistence during deploy:** Next.js/Vercel's standard
  deployment model already handles this (each deployment is immutable;
  in-flight requests complete against the version they started with) —
  this is a platform guarantee, not something this codebase needs to build,
  but it should be explicitly verified once real concurrent users exist
  (ties to LOADTEST-002).

## 5. Backward compatibility

**Rule going forward:** a schema change that a currently-deployed frontend
depends on must never be a single atomic swap — follow an expand/contract
pattern (add the new shape, deploy frontend code that can read either shape,
migrate data, remove the old shape only once nothing reads it). This project
has not yet needed this pattern in practice (still small, still early), but
it should be adopted explicitly before real user-facing schema changes
become frequent.

## 6. Environment variables and secret rotation

Covered in `MARKETPLACE_SECURITY_AND_PRIVACY_REMEDIATION_PLAN.md` §4/SEC-006
— cross-referenced here because a secret rotation is itself a release event
and should follow the same checklist discipline (verify the new secret
works in staging before rotating production).

## 7. Feature flags

**Missing** (REL-004). Not urgent at current scale/team size, but
recommended before any risky, partially-built feature (e.g. a real payment
aggregator connection, PAY-001) goes live — being able to disable a new
payment path instantly without a code deploy is meaningfully safer than
relying on rollback alone for anything touching real money.

## 8. Production-change approval process

**Missing, formally** — today, in practice, the same person who writes a
change also applies and verifies it. This is acceptable at current team
size but should be explicitly named as a known, accepted risk (single point
of review) rather than left implicit, and revisited the moment a second
engineer joins (a second-person review of migrations touching RLS or
financial logic should become mandatory at that point, not optional).

## 9. Recommended sequencing

1. Adopt the release checklist (§3) immediately — zero cost, applies to the
   very next change made to this codebase.
2. REL-002 (staging) — shared dependency with DR/Load-testing plans,
   highest-leverage single infrastructure investment in this entire
   program.
3. REL-003 (automated smoke tests) — once SEC-001's test infrastructure
   exists, extend it with a small, fast post-deploy smoke suite.
4. REL-004 (feature flags) — sequence before PAY-001 (real aggregator
   connection), not before.

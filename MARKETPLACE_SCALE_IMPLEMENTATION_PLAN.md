# Marketplace Scale Implementation Plan

Companion to `MARKETPLACE_SCALE_READINESS_AUDIT.md` (read in full before writing
this). This is the Phase 0 baseline for turning that audit's findings into
actual, verified changes. Every "confirmed" item below was re-checked against
the current repository and live database in this session, not taken on faith
from the prior audit.

## Baseline checks run

- `package.json` / `package-lock.json`: confirmed present (`npm`, not
  yarn/pnpm). Scripts: `dev`, `build`, `start` only — **no `test`, `lint`, or
  `audit`-adjacent script exists.** `npm audit` was not run as part of this
  plan because there's no CI convention establishing it's expected, and
  running it against `package-lock.json` is safe/read-only if wanted later —
  noted as available but not run this pass to keep this document to what was
  actually done.
- No automated test suite exists (no `jest`/`vitest`/`playwright` devDependency)
  — confirmed again, matches every prior session's finding.
- `npx tsc --noEmit` and `npm run build`: not re-run in Phase 0 itself (no code
  changed yet) — will run after every implementation phase below, per Phase 17
  of the instructions.

## Current architecture (confirmed this session, not re-derived)

Next.js 16.3.4 App Router / React 19.2.8, 100% dynamic SSR (no ISR, no
`unstable_cache`), Vercel hosting (no `vercel.json`), Supabase Postgres + Auth
+ Storage + Realtime, RLS default-deny, Server Actions as the primary write
path, two real webhook Route Handlers, no queue/cron/background-job runner,
no rate limiting, no monitoring. Full detail: `MARKETPLACE_SCALE_READINESS_AUDIT.md` §2.

## Findings re-verified this session (still accurate)

- `pg_cron` not installed; `rpc_run_auto_approve_sweep` has no invoker anywhere.
  **Re-confirmed and inspected in full** (see Phase 1 below) — the function's
  actual body is simpler and safer than assumed: it selects
  `service_transactions` where `state = 'evidence_submitted' and
  auto_approve_at <= now()` and calls `_release_transaction(id, true)` per
  row. `_release_transaction` itself takes the row `for update` and re-checks
  `state = 'evidence_submitted'` before acting — **meaning the sweep is
  already safe against overlapping/duplicate invocation by construction**, a
  fact the original audit didn't have the function body in front of it to
  state precisely.
- 7 unindexed FKs — re-confirmed via fresh `pg_indexes`/advisor query this
  session: `conversations.service_id`, `conversations.transaction_id`,
  `identity_verification_checks.provider_key`,
  `payment_provider_events.provider_key`, `payment_providers.connected_by`,
  `service_requests.transaction_id`, `verification_providers.connected_by`.
- `messages` RLS: re-read the actual 6 policies via `pg_policies` this
  session (not re-derived from the advisor count alone). The table serves
  two distinct message "kinds" in one physical table — transaction-scoped
  and conversation-scoped — each with its own SELECT/INSERT/UPDATE policy
  pair (`is_txn_participant(transaction_id)` vs.
  `is_conversation_participant(conversation_id)`). This is **not accidental
  duplication** — it's deliberate polymorphism. The 15
  `multiple_permissive_policies` findings on this table are Postgres having
  to OR two policies' quals together per action per row, even though a given
  row only ever matches one of the two (a row has `transaction_id` XOR
  `conversation_id`, never both). This is safely consolidable (merging each
  SELECT/INSERT/UPDATE pair into one policy with an explicit OR) because an
  OR of two permissive policies is mathematically identical to one policy
  whose qual is the OR of both — not a judgment call, a mechanical
  equivalence. See Phase 3.2 below.
- Unbounded message queries — re-confirmed via fresh read of both thread
  pages and the inbox page this session.
- No unique constraint on `payment_provider_events(provider_key,
  external_reference)` — re-confirmed via fresh index listing.

## Findings that no longer apply

None — every finding checked this session still holds. The audit was written
earlier the same day this plan is being written, against the same live
database and repository state.

## New findings discovered this session (not in the original audit)

1. **The sweep function is already overlap-safe** (above) — this changes
   Phase 1's actual risk profile: the *scheduler wiring* is the real gap, not
   the function's own concurrency safety. Still worth adding a cheap
   advisory-lock guard at the HTTP-endpoint layer so two overlapping cron
   invocations don't both do redundant work, but it's a performance nicety
   here, not a correctness requirement.
2. **`messages`'s 15 multiple-permissive-policy findings have a precise,
   safe fix** (above), not just a "review case by case" note as the audit
   said — the plan is now concrete.

## Proposed implementation phases for this session

Given the instructions' own 18-phase scope is more than a single session can
responsibly execute with real verification at each step (staging
environment creation, full observability-vendor integration, and an actual
executed 5,000-VU load test all require external access or cost commitments
this session cannot make unilaterally), this plan selects the subset that is
**safely completable, verifiable, and high-value without new paid
infrastructure or unconfirmed credentials**, and explicitly defers the rest
with documented blockers rather than fabricating completion.

### Selected for real implementation this session

| # | Phase | Scope | Why in scope |
|---|---|---|---|
| 1 | Auto-approve scheduler | Vercel Cron + protected Route Handler calling the RPC via service-role client | Zero new external dependencies (Vercel Cron is config, not a new vendor); directly closes the audit's #1 Critical finding |
| 2 | FK indexes | 7 migrations (or one migration, 7 statements) | Mechanical, safe, low-risk |
| 3 | Messages RLS consolidation | Rewrite the 6 `messages` policies into 3, wrap `auth.uid()`/function calls per Supabase's initplan guidance | Precisely understood or this session wouldn't attempt it; verified before/after with role-simulated tests |
| 4 | Bound message queries | Add `.limit()` + keyset pagination to both thread pages and the inbox | Directly closes a documented High finding, contained blast radius |
| 5 | Payment-provider-event idempotency | Unique constraint on `(provider_key, external_reference)` | Cheap, safe, closes a documented gap before it matters |
| 6 | Request-mode booking idempotency | Client-supplied idempotency key + unique constraint, honored in `rpc_book_service` | Directly named in the audit and in this task's own Phase 4 |
| 7 | Narrow caching | `unstable_cache` on the categories/services catalog reads only (public, slow-changing, no auth-sensitive data) | Matches Phase 6's own instruction to cache only the safest, highest-value candidates first |
| 8 | Rate limiting | Postgres-backed (not Redis — none is provisioned, and introducing a new paid dependency without asking isn't this session's call to make) sliding-window limiter, applied to booking, quoting, messaging, task-posting, signup-adjacent actions | Compatible with the actual hosting/DB setup per the instructions' own requirement; no new vendor |
| 9 | Health check endpoint | `/api/health` — liveness + readiness (DB reachability, required env vars present) | Cheap, safe, real operational value, explicitly requested in Phase 11 |
| 10 | Security regression pass | Re-verify RLS/authz for everything touched above | Required by Phase 15 before calling any of the above done |
| 11 | Documentation | Update the audit doc's implementation-status section; this plan doc | Phase 16 |

### Explicitly deferred, with reasons (not attempted this session)

| Phase | Why deferred |
|---|---|
| 2 (infra limits) | Dashboard-only (Supabase/Vercel billing & infra settings) — no tool access this session, same reproduced gap as every prior session. A precise manual-check list is already in the audit's §9/§13 and isn't repeated here. |
| 3.2 beyond `messages` | The `messages` consolidation is undertaken because this session read and fully understands its exact semantics. Doing the same for `providers`, `profiles`, `provider_verifications`, `notifications`, `service_transactions`, `quotes` (the other tables in the 33/105 advisor counts) requires the same level of individual policy-by-policy understanding this plan doesn't have budget to do safely for six more tables in one pass — attempting it without that care risks exactly the "accidentally broaden access" failure mode the instructions explicitly warn against. Left as a well-scoped P2 follow-up, not silently dropped. |
| 8 (background jobs beyond the scheduler) | No queue infrastructure exists and none is being added for hypothetical future jobs, per the instructions' own "do not introduce a complex queue merely for theoretical future use." The one real, current async-work need (the sweep) is Phase 1. |
| 10 (full observability/error tracking) | Requires a real external vendor (Sentry or equivalent) and API credentials this session does not have and should not assume. What *can* be done without a vendor — structured console logging conventions and the health endpoint — is in scope (#9 above); wiring a real APM is documented as a blocked P1 item requiring the user to create an account and supply a DSN. |
| 12/13/14 (staging environment + load testing) | Requires either a new Supabase project or a branch, which has real cost/quota implications this session should not incur unilaterally. Per the instructions' own Phase 12 rule: "If staging does not exist, document that as a P0/P1 blocker... do not perform uncontrolled production load testing." This plan documents the exact setup required (§ in the updated audit doc) and does not fabricate a load test. |
| 4 (idempotency) beyond booking + webhook events | Quote submission, task creation, and message sending already have real DB-level duplicate protection (`quotes_request_id_provider_id_key` unique constraint; messages have no natural "duplicate" concept since each is a distinct utterance) or are low-risk-if-duplicated (a duplicate task post is a UX annoyance, not a money/state-integrity risk). Scoped narrowly to where a duplicate has real consequences: bookings and payment webhooks. |
| 9 (messaging reconnect UX, ordering-by-created_at) | Real but lower-severity findings (§7 of the audit); pagination (the higher-severity item) is in scope, these polish items are not, to keep this session's blast radius contained and reviewable. |

## Dependencies between phases

Rate limiting (8) and the booking idempotency key (6) both touch
`rpc_book_service`'s call surface — implemented together, in that order
(idempotency in the RPC/migration layer first, then the rate-limit check in
the Server Action that calls it), so they don't conflict. The `messages` RLS
consolidation (3) and message pagination (4) both touch message read paths —
RLS first (pure backend, testable independently), then pagination (frontend +
query shape), so pagination is verified against the *final* RLS shape, not an
intermediate one.

## Files likely to change

- New: `supabase/migrations/*_scale_hardening_*.sql` (one or more, per §3.1/3.2/4/5.1 above)
- New: `vercel.json`
- New: `src/app/api/cron/auto-approve-sweep/route.ts`
- New: `src/lib/rate-limit.ts`
- New: `src/app/api/health/route.ts`
- New: `src/lib/cache/catalog.ts` (or similar) for the categories/services cache
- Modified: `src/app/messages/[transactionId]/page.tsx`, `src/app/messages/c/[conversationId]/page.tsx`, `src/app/messages/page.tsx`, `src/app/messages/message-thread.tsx` (pagination)
- Modified: `src/app/services/[slug]/actions.ts` (`bookService` — idempotency key + rate limit)
- Modified: wherever the categories/services catalog is currently fetched, to route through the new cache helper
- Modified: `.env.example` (new vars, if any are introduced — e.g. `CRON_SECRET`)
- Modified: `MARKETPLACE_SCALE_READINESS_AUDIT.md` (implementation-status section)

## Risks

- **RLS policy consolidation is the single highest-risk change in this plan.**
  A mistake here is a real security regression (over-broad access), not just
  a performance miss. Mitigation: role-simulated before/after tests proving
  identical access for anonymous/customer/provider/admin cases, on the exact
  policies being changed, before considering it done.
- **Rate limiting has a fail-open-vs-fail-closed decision to make explicitly**
  (instructions require documenting this) — a Postgres-backed limiter means
  the "backend" is the same database everything else depends on, so if the
  DB is down, every request is already failing anyway; this simplifies the
  decision (no separate failure mode to reason about) but is worth stating
  plainly rather than leaving implicit.
- **The idempotency-key change to `rpc_book_service` changes its signature** —
  every call site must be updated in the same change, and this needs care
  not to break the existing booking form.
- **Vercel Cron's actual availability is plan-dependent** (Hobby plans allow
  cron but historically with tighter frequency restrictions than Pro) — the
  code will be written correctly regardless, but whether the cron actually
  fires on schedule after deploy cannot be verified from this session (no
  Vercel dashboard access) and is documented as such.

## Required external access this plan cannot obtain itself

Supabase project billing/infra dashboard; Vercel project dashboard (to
confirm the cron job registered and is firing, and to set the `CRON_SECRET`
environment variable this plan's code will require — the code will read it
from `process.env`, but someone with dashboard access must set the actual
value); a real error-monitoring vendor account if one is wanted later.

## Items that cannot be verified yet

Whether Vercel Cron actually invokes the new endpoint on schedule once
deployed (requires production deploy + time + dashboard confirmation, none
of which this session can observe). Whether the rate limiter's chosen
windows/limits are right for real traffic (no real traffic exists yet to
tune against — initial values will be conservative and documented as
provisional).

## Proposed acceptance criteria

- `npx tsc --noEmit` and `npm run build` clean after every change.
- Every new migration applied to the live database and its effect verified
  by direct query (index exists, constraint exists and rejects a duplicate
  in a rolled-back test transaction, RLS policy count/shape matches intent).
- The `messages` RLS consolidation verified via role-simulated SQL proving:
  an anonymous/other user cannot read a thread they're not in; a
  transaction participant can still read/send/mark-read on transaction
  threads; a conversation participant can still read/send/mark-read on
  conversation threads; an admin can still read any thread.
- The booking idempotency key verified: two calls with the same key return
  the same transaction, not two; two calls with different keys create two
  legitimate separate bookings.
- The rate limiter verified: exceeding the configured limit is rejected with
  a clear retry-after signal; staying under it is unaffected; a burst from
  two different identities is not cross-throttled.
- The health endpoint returns 200 when the DB is reachable and env vars are
  present, and a non-200 with a clear (non-secret-leaking) reason otherwise.
- No production data modified by any test — all DB-level tests run inside
  an explicit uncommitted transaction (`begin; ... ; rollback;` or simply
  never issuing `commit`), the same pattern used throughout this project's
  history.
- Nothing pushed to the remote until explicitly instructed, per the task's
  own rule; commits made locally, grouped logically, reviewed via `git diff`
  before each one.

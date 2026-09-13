# Marketplace Load Testing Plan

Companion to the register's `LOADTEST-*` and `PERF-*` items, and a
supersede-and-extend of `MARKETPLACE_SCALE_READINESS_AUDIT.md` §10, which
was explicitly labeled "proposed, not executed" and remains so. **No load
test at any scale has been run against this application, at any point in
this project's history, as of this document.** Restated because it is the
single fact this document exists to eventually make untrue, safely.

## 1. Non-negotiable safety constraint

**Never test against the production Supabase project.** This is not a
preference — the founding brief for this task, and every prior task in this
project's history, explicitly forbids it. This plan's first deliverable
(§2) is therefore a prerequisite for every other section, not an optional
nice-to-have.

## 2. Staging environment — required before any load test

Shared dependency with `MARKETPLACE_DISASTER_RECOVERY_PLAN.md`'s restore
test (§4 of that document) and `MARKETPLACE_RELEASE_AND_ROLLBACK_PLAN.md`.
**Do not build a separate staging environment for load testing alone** —
the restore-test throwaway project, if the founder approves keeping it
running (register decision #9), becomes this environment too.

Requirements specific to load testing:
- Seeded with **synthetic** data only: fabricated providers, services,
  categories mirroring production's shape but explicitly labeled (the
  project's own existing convention — `qa-*` fixture naming, already used
  throughout this codebase's history for test data — should be reused
  here).
- A synthetic/sandbox payment-provider mode — **never** trigger a real STK
  push during a load test, per the founding brief's explicit prohibition.
  If IntaSend is the chosen aggregator (register decision #5), its sandbox
  environment (already referenced in `.env.example`'s `INTASEND_ENV`
  variable — Confirmed, code) is the correct target.
- Isolated from production's Vercel deployment — a separate preview/staging
  deployment pointed at the staging Supabase project, not a feature-flag
  inside the production deployment.

## 3. Tooling

**Recommendation:** k6 (scriptable in JavaScript, free/open-source, good
fit for modeling the varied user behaviors below) or Artillery as an
alternative. Neither is currently installed or configured in this
repository (**Confirmed, code** — no `k6`/`artillery` config files found).
This is new tooling to add, not something to discover as already present.

## 4. Modeled user behaviors

Per the founding brief's exact list, each mapped to the real route/action
it would exercise:

| Behavior | Route/action |
|---|---|
| Browsing services | `GET /` (home page, now with catalog caching from the prior session — a load test is exactly what would validate that caching actually reduces DB load as intended, currently **unverified under load**, only reviewed for correctness) |
| Searching providers | `GET /` with `q` param |
| Viewing profiles | `GET /provider/[slug]` |
| Creating customer requests | `postTask` |
| Receiving/submitting quotes | `submitQuote` |
| Accepting quotes | `acceptQuote` |
| Creating fixed-price bookings | `bookService` (idempotency-key path — a load test should specifically include a **duplicate-key concurrent submission** case, not just fresh bookings, to validate LOADTEST-003) |
| Initiating payments in sandbox mode | `initiatePayment` against IntaSend sandbox |
| Receiving webhook events | Synthetic webhook POSTs to `/api/webhooks/payments`, including deliberately duplicated/out-of-order ones |
| Sending messages | `sendMessage` |
| Reading inboxes | `GET /messages` (now paginated from the prior session — load-testing this validates the pagination actually bounds query cost as intended) |
| Uploading evidence | `recordEvidence` |
| Reviewing providers | `submitReview` |
| Admin queue usage | `/admin/*` pages, at a much lower simulated concurrency (few real admins) |

## 5. Staged levels and what each level is actually for

| Level | Purpose |
|---|---|
| 100 VUs | Smoke-level — confirm the harness and staging environment work correctly before trusting any higher-level result |
| 500 VUs | First real signal on whether the prior session's optimizations (indexes, RLS fixes, pagination, caching) behave as intended under concurrency, not just in isolated correctness tests |
| 1,000 VUs | Confirm no new bottleneck emerges between 500 and 1,000 — first level where DB connection-pool exhaustion becomes a real risk to watch for (PERF-001's unconfirmed plan limits make this the level where that unknown starts to matter) |
| 2,500 VUs | Stress the specific known-incomplete areas — the ~25 tables not yet RLS-optimized (SEC-007), unverified lock discipline on 5 RPCs (TXN-003) |
| 5,000 VUs | The originally-requested target; only meaningful once every lower level has passed cleanly — running this first, without the lower levels, would produce a result that's hard to diagnose |

## 6. Additional required scenarios

- **Spikes** — sudden jump from idle to peak VU count, not a ramp, to
  simulate a marketing push or viral moment.
- **Sustained load** — peak VU count held for an extended period (30–60
  min), to surface slow leaks (connection pool, memory) that a short burst
  wouldn't reveal.
- **High booking contention** — many virtual users attempting to book the
  *same* scheduled slot simultaneously, specifically exercising the
  `provider_booked_slots` exclusion constraint under real concurrent load
  (this is exactly the class of test the prior session's own audit
  explicitly could **not** perform, due to the single-connection-per-call
  limitation of the SQL tool used then — genuine multi-connection load
  testing is the correct way to finally close that gap).
- **High payment-event volume** — many synthetic webhook deliveries in a
  short window, testing `rpc_ingest_payment_event`'s dedupe logic under
  real concurrent load (matches LOADTEST-003).
- **Payment provider timeouts** — configure the sandbox aggregator (or a
  mock) to simulate slow/failed responses.
- **Realtime degradation** — deliberately disconnect/throttle the Realtime
  channel during a messaging-heavy scenario, confirm the documented
  degraded-but-functional fallback actually holds under load, not just in
  code review.
- **Queue backlog / retry storms** — once any queue infrastructure exists
  (currently: only the 2 cron routes) — deferred until there's something
  real to stress.

## 7. Pass/fail criteria

Concrete numbers below are **proposed defaults for founder/engineering
sign-off**, not yet ratified — flagged as such rather than presented as
settled:

| Metric | Proposed threshold |
|---|---|
| p95 latency, read routes | < 800ms |
| p95 latency, write RPCs | < 1500ms |
| Error rate | < 0.5% (excluding deliberately-injected failure scenarios) |
| DB CPU | < 80% sustained |
| DB connections | < 80% of confirmed pool limit (blocked until PERF-001 resolved) |
| Duplicate financial outcomes | **Zero, always** — this is not a percentage threshold, it is a hard pass/fail gate |
| Data integrity (ledger balance) | Zero imbalance, verified via the PAY-006 reconciliation job running against the load-test database post-run |
| Recovery behavior | System returns to baseline latency/error rate within 5 minutes of load ending |

## 8. If a staging environment does not exist — the work required to create one safely

Fully specified in `MARKETPLACE_DISASTER_RECOVERY_PLAN.md` §4 (the restore
test doubles as staging creation) — not duplicated here. This load-testing
plan's own first action item is simply: **confirm that work is done before
scheduling any load-test run.**

## 9. Recommended sequencing

1. Staging environment exists (shared DR/Release dependency).
2. k6 (or equivalent) installed, scripts written for the behaviors in §4.
3. 100 VU smoke run — validates the harness itself.
4. 500 → 1,000 → 2,500 → 5,000, each gated on the previous level passing
   §7's criteria; do not skip ahead.
5. The special scenarios in §6 run interleaved with the staged levels
   above, not as an afterthought — e.g., run the booking-contention
   scenario *at* the 1,000 VU level, not only once at the end.
6. Produce a written load-test report (pass/fail per §7, raw data attached)
   before any claim of "N-user ready" is made anywhere else in this
   program's documents.

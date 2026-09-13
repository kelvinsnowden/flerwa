# Marketplace Analytics and Unit Economics Plan

Companion to the register's `ANALYTICS-*` and `LIQ-*` items, and grounded
in `docs/13` (metrics/KPIs, already-decided North Star and formulas) and
`docs/10` (unit economics model). This document does not re-derive those —
it defines how to actually **compute** the numbers those documents already
specified, since nothing computes them today.

## 1. Current state

**No analytics pipeline exists at all.** No event table, no dashboard, no
instrumented funnel step, anywhere in the codebase (**Confirmed, code** —
grepped for `analytics`/`track`/`posthog`/`mixpanel`/`amplitude`/`segment`,
none found). The one correct, working metric calculation that exists is
`/admin`'s GMV stat, which correctly excludes materials pass-through
(**Confirmed, code**, re-verified this pass) — a genuinely good, if narrow,
example to extend from rather than replace.

## 2. Design principle: don't overload production, don't leak PII

Per the founding brief's explicit instruction. Recommended architecture:

```
Server actions / route handlers
        │  (fire-and-forget, never blocking the user-facing action —
        │   same principle already proven safe for in-app notifications,
        │   NOTIF-003)
        ▼
analytics_events (new table)
  id, occurred_at, user_id nullable, event_name, properties jsonb
        │
        │  read-only, batched, off-peak
        ▼
   Materialized views / scheduled aggregation jobs
        │
        ▼
   Admin-only dashboard pages (reuse the existing /admin RBAC pattern)
```

- **Never block a user action on an analytics write** — same principle
  already established and verified for notifications.
- **No third-party SDK shipping raw event data off-platform** without a
  data-processor agreement (ties to `LEGAL-007`/§16 of the security plan) —
  recommend the self-hosted `analytics_events` table approach above as the
  default, revisiting a third-party tool only after a DPA is in place if the
  volume/tooling need justifies it.
- **RLS on `analytics_events`:** default-deny, admin-only read, matching
  the `scheduler_runs`/`rate_limit_buckets` pattern already established this
  project's history for "internal, service-role-written" tables.
- **PII discipline:** `properties jsonb` must never carry a raw phone
  number, email, or ID number — reference the user by ID and join to
  `profiles` only in the admin dashboard query, never store the PII
  redundantly in the event payload itself.

## 3. Customer and provider funnels — event list

Directly from the founding brief §19, mapped to the actual routes/actions
that would emit each event (**Confirmed, code** for the route names; the
event-emission code itself doesn't exist yet):

**Customer funnel:** landing (`/`) → discovery (category click) → service
detail (`/services/[slug]`) → request created (`postTask`) → quote received
(implicit, on `rpc_submit_quote`) → quote viewed → quote accepted
(`rpc_accept_quote`) → checkout started (`bookService` form render) →
payment initiated (`initiatePayment`, `src/app/account/bookings/[id]/actions.ts`)
→ payment confirmed (`_fund_transaction`) → booking confirmed → service
started (`rpc_provider_check_in`) → service completed (`rpc_approve_and_release`)
→ review submitted (`submitReview`) → repeat booking (a second `rpc_book_service`
call by the same customer_id).

**Provider funnel:** application started (`/provider/apply` step 1) →
submitted (`rpc_submit_for_verification`) → identity verification
started/completed (once Kora is connected — not yet) → approved
(`rpc_set_verification_status`) → profile completed → service published
(`is_published = true`) → first quote (`rpc_submit_quote`) → first booking
→ first completed job → repeat booking → churn (defined as: was earning,
now 0 jobs in 30/60/90 days — a derived metric, not a single event).

**Implementation task:** add one `recordAnalyticsEvent()` fire-and-forget
call at each of the ~24 points above, in the existing server actions —
small, additive, low-risk changes to well-understood code, but a real
amount of surface area (touches ~15 files).

## 4. Marketplace health — the six-number dashboard `docs/13` specifies

Reproducing the exact dashboard `docs/13` designs, with what's needed to
compute each number:

```
Completed jobs (mo)     ← count(service_transactions where state='settled'
                            and settled_at in month)  — computable TODAY,
                            no new instrumentation needed, just a query
Average job value       ← same query, avg(service_amount_minor)  — same
Repeat rate (90d)        ← needs a query grouping by customer_id — same,
                            computable today
Contribution per job     ← needs cost-to-serve data (ANALYTICS-004,
                            requires support-cost tracking that doesn't
                            exist yet)
Median time to payout    ← settled_at - approved_at, computable today
Disputes / Incidents      ← count from `disputes`, computable today;
                            "Incidents" (safety) has no source table yet
                            (TSF-012 dependency)
```

**Important finding:** 4 of these 6 numbers are computable **today**, with
zero new schema, directly from existing tables — this dashboard does not
need to wait for the full analytics pipeline in §2/§3. Recommend building
the 4 computable numbers first, as a standalone `/admin` addition, entirely
decoupled from the larger event-tracking project.

## 5. Technical-health dashboard

Per the founding brief's list (p50/p95/p99 latency, error rate, DB
saturation, connection-pool utilization, Realtime connections, Edge Function
duration, queue depth, job failures, webhook failures, notification
delivery, storage usage, cache hit rate, reconciliation exceptions):

- **Likely already available without building anything**, via Vercel's own
  dashboard (function duration, error rate, edge network stats) and
  Supabase's own dashboard (DB CPU/connections, storage usage) — **Blocked
  — external access** to confirm exactly what's visible on the current
  plans, but this should be checked *before* building any custom
  technical-health tooling, since duplicating a vendor's own free dashboard
  would be wasted effort.
- **Genuinely custom and not available from a vendor:** job failures
  (`scheduler_runs` already tracks this for the one existing job — extend
  the pattern), webhook failures (`payment_provider_events.processing_error`
  already captures this — a dashboard just needs to query it), reconciliation
  exceptions (depends on PAY-003/PAY-006 existing first).

## 6. Unit economics — computing what `docs/10` already modeled

`docs/10`'s model (breakeven ~KSh 120–150M GMV/month, cost-to-serve must
fall ~3× between early and mature scale, AOV as the dominant lever) is a
**planning model with assumed inputs**, not yet backed by real measured
data (the model's own document says so: "Cost inputs are estimates requiring
real quotes" — `[ASSUMPTION]` tagged throughout). Engineering's job: make
the *actual* inputs measurable as real transactions occur, replacing
assumption with evidence over time.

| Model input | How to actually measure it once transactions exist |
|---|---|
| AOV | `avg(service_amount_minor)` from settled transactions — computable today |
| GMV | Same query, sum — computable today, already correctly implemented in `/admin` |
| Payment processing cost | Depends on PAY-001 (real aggregator) — cannot be measured pre-launch of real payments |
| Cost to serve per job | Needs support-ticket/time tracking — no such system exists (ANALYTICS-004, genuinely new instrumentation, likely paired with whatever support-ticketing tool is chosen operationally, not necessarily built in this codebase at all) |
| Contribution per job | `revenue − payment_cost − cost_to_serve`, derived once the above two exist |
| Repeat rate (90d) | Computable today from `service_transactions` grouped by customer — no new instrumentation needed |

## 7. Thresholds that should trigger intervention

Per the founding brief §20, these are **business decisions with
recommended defaults from the existing strategy docs**, not engineering
determinations:

- **Launch a category:** `docs/14`'s density rule — ≥5 verified providers
  per active service, <24h availability, before opening (LIQ-004).
- **Pause a category:** inverse of the above, plus `docs/13`'s guardrails —
  if average job value or repeat rate degrades materially while completed-
  job count rises, that's the warning `docs/13` names explicitly ("optimizing
  the count alone drives toward small, cheap jobs").
- **Raise/lower fees:** tied to the still-undecided PAY-007 fee-model
  question.
- **Require deposits / change incentives / increase verification
  requirements:** no engineering recommendation is offered here — these are
  founder-level calls informed by the data this plan makes measurable, not
  determined by the data itself.

## 8. Recommended sequencing

1. The 4 computable-today numbers in §4's dashboard — zero new schema,
   ship first.
2. `analytics_events` table + RLS (§2) — infrastructure, no events wired
   yet.
3. Wire the ~24 funnel events (§3) incrementally, customer funnel first
   (higher volume, faster signal) then provider funnel.
4. Cost-to-serve instrumentation (§6) — sequenced last, since it likely
   depends on an operational decision (which support tool) outside this
   codebase's scope.

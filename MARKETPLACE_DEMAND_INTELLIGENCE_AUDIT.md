# Demand Intelligence Audit (MARKETPLACE-001, Phases 1–3)

**Audited:** 2026-09-15. **Scope:** whether flerwa records/exposes customer
demand signals (search, browse, booking-funnel, unmet demand) anywhere in
the app, database, or admin console.

**Method:** direct inspection only — grep across `src/` and
`supabase/migrations/` for every term the task specified, live read-only
queries against the production Supabase project (`famdxoardiibonghxepl`,
read-only: no writes, no migrations applied), and a manual read of every
route/RPC that touches search or booking. No data was fabricated. No
migration was applied. Nothing was committed or pushed.

## Headline answer

**No demand-analytics or search-event infrastructure exists anywhere in
this codebase — not partially, not disconnected, not prototyped. It has
never been built.** There is no analytics table, no third-party analytics
script, no event-logging call anywhere in a search or browse path, and no
admin page that shows search volume, no-result rate, or funnel
conversion. The only "analytics" in the app are transaction-lifecycle
audit logs (`transaction_events`, `payment_events`, `admin_actions`),
which record what happened to a booking that was already created — not
what a customer searched for, browsed, or failed to find.

## What was inspected

- **Routes/components:** `src/app/page.tsx` (home + search), `src/app/services/[slug]/page.tsx`,
  `src/app/provider/[slug]/page.tsx`, `src/app/tasks/new/*`, `src/app/tasks/[id]/*`,
  `src/app/provider/requests/*`, `src/app/providers/actions.ts`, `src/components/ui/search-bar.tsx`.
- **Every admin page** (`src/app/admin/**/page.tsx`, 22 routes) — read in full or
  by targeted grep for aggregate/stat queries.
- **All 92 migration files** under `supabase/migrations/`, grepped for
  `analytics|impression|no_results|search_event|demand_|trending|popular|recommendation|match_score|ranking`
  (case-insensitive) — 2 incidental matches, neither a real feature (see below).
- **Live schema:** `select * from pg_class` cross-checked against every
  public table name (56 tables, enumerated in full in an earlier pass of
  this session) — none named or shaped like an event/analytics table.
- **Live functions:** `select proname from pg_proc ... where proname ilike '%rank%' or '%match%' or '%recommend%' or '%score%' or '%demand%' or '%analytics%' or '%search%'` — **zero rows returned.**
- **Third-party analytics:** grepped the whole repo for
  `posthog|segment|mixpanel|amplitude|@vercel/analytics|gtag|google-analytics|plausible` — **zero matches.** No analytics script is loaded anywhere, including `src/app/layout.tsx`.

## Capability matrix

| Capability | Status | Data source | Admin route/component | Tables/queries | Accuracy limitations | Missing work | Priority | Privacy notes |
|---|---|---|---|---|---|---|---|---|
| Search queries recorded | **Missing** | None | None | None | N/A | Event table + write path | P0 | — |
| Search terms captured | **Missing** — `q` is a URL param (`src/app/page.tsx:48,84`) consumed once per request, never persisted | None | None | None | — | Same | P0 | Free-text search terms are the single highest-value/highest-risk field to log — see Phase 8 notes below |
| Category searches | **Missing** — `category` param filters the query but nothing records that the filter was used | None | None | None | — | Same | P0 | — |
| Location-based searches | **Missing** — no location filter exists in search at all today (home search has no location param; only a static "Nairobi" pill, `src/app/page.tsx:104-106`, non-functional) | N/A | N/A | N/A | — | Needs a location filter *and* event logging | P1 | — |
| Searches with no results | **Missing** — `EmptyStateBlock` (`src/app/page.tsx:284-318`) renders a "no results" UI but nothing writes a row anywhere when it renders | None | None | None | — | Event + aggregation | P0 | — |
| Searches with poor/irrelevant results | **Missing** — no relevance scoring exists to even define "poor" (see ranking audit) | — | — | — | — | Depends on ranking existing first | P2 | — |
| Search-result clicks | **Missing** | None | None | None | — | Event | P1 | — |
| Provider-profile views | **Missing** — `/provider/[slug]` is a plain server-rendered page; no view is recorded | None | None | None | — | Event | P1 | — |
| Service-detail views | **Missing** — same pattern, `/services/[slug]` | None | None | None | — | Event | P1 | — |
| Booking attempts | **Partial, indirect only** — every `rpc_book_service` call that succeeds creates a durable `service_transactions` row in state `requested` and a `service_created` row in `transaction_events`; a **failed/rejected** attempt (validation error, RPC exception) leaves no trace anywhere | `service_transactions`, `transaction_events` | None reads this for funnel purposes | `service_transactions`, `transaction_events` | Only captures successful attempts; abandonment (customer opens the form and leaves) is invisible | Explicit `booking_started`/`booking_abandoned` events | P0 | — |
| Booking conversions | **Partial, indirect only** — can be derived retroactively from `service_transactions.state` transitions, but no admin view computes conversion rate today | `service_transactions` | None | `service_transactions` | No admin query exists; would need to be built even though the raw data technically supports it | Admin funnel view (Phase 2) | P0 | — |
| Abandoned searches | **Missing** | — | — | — | — | Event + session correlation | P1 | — |
| Abandoned bookings | **Missing** — a `requested`-state transaction that's never funded looks identical to one the customer is still deciding on; there's no way to distinguish "abandoned" from "in progress" | `service_transactions` (weak proxy only) | None | — | Cannot currently distinguish abandonment from normal latency | Explicit event or a time-based heuristic job | P2 | — |
| Quote requests | **Fully implemented, but not exposed as demand analytics** — `service_requests`/`quotes` tables are real, live, and used by the seller-discovery flow (`src/app/tasks/new`, `src/app/provider/requests`) | `service_requests`, `quotes` | None aggregate it | `service_requests`, `quotes` | This IS a real, structured demand signal already being collected — it's just never surfaced as "demand intelligence" anywhere in admin | Admin dashboard reading this existing data | **P0 — cheapest real win, data already exists** | — |
| Requests for unavailable services | **Missing** — a customer searching for a service that doesn't exist in the catalogue just sees "No services published yet"; nothing is recorded | None | None | None | — | Needs a no-results event distinguishing "exists but 0 matches" from "category has 0 services" | P1 | — |
| Customer-created service requests | **Fully implemented** (see quote requests above) — `postTask` (`src/app/tasks/new/actions.ts`) | `service_requests` | None | `service_requests` | — | Surface in admin | P0 | — |
| Repeated searches by same customer | **Missing** — no session/customer correlation on searches at all | — | — | — | — | Needs authenticated-user or session correlation on the (currently nonexistent) search event | P2 | — |
| Search-to-booking conversion | **Missing** — no correlation ID connects a search to the booking that followed it | — | — | — | — | Correlation ID design (Phase 3, below) | P0 | — |
| Time/date demand | **Partial, derivable, not built** — `service_transactions.requested_at`/`scheduled_for` exist and could be aggregated by hour/day, but no query does this today | `service_transactions` | None | — | Booking-only, not search-only, demand | Aggregation job/view | P1 | — |
| Geographic demand | **Partial, derivable, not built** — `service_transactions.location_id` → `locations` (ward/town granularity) exists; never aggregated | `service_transactions`, `locations` | None | — | Booking-only demand, not search demand (no location on search at all today) | Aggregation + search-location capture | P1 | — |
| Demand by category | **Partial, derivable, not built** — `service_transactions.category_id` exists; never aggregated | `service_transactions` | None | — | Booking-only | Aggregation | P1 | — |
| Demand by price range | **Missing** — no bucketing exists anywhere | — | — | — | — | Needs event/aggregation design | P2 | — |
| Demand by customer segment | **Missing** — no customer segmentation concept exists in the schema at all | — | — | — | — | Out of scope until a segmentation model is defined | P3 | — |
| Demand by device/platform | **Missing** — no client fingerprinting or user-agent capture anywhere (this is correct/expected for privacy — see Phase 8) | — | — | — | — | Only add if there's a concrete need; low priority, privacy-sensitive | P3 | Deliberately not collecting this today is the safer default |

## Admin Console — demand intelligence (Phase 2)

The admin nav (`src/app/admin/layout.tsx`) has 18 sections: Overview,
Verifications, Providers, Customers, Payments, Ledger, System, Reviews,
Transactions, Disputes, Support, Deal Desk, Integrations, Categories,
Audit Log, Approvals, Roles, Moderation. **None of them is a demand,
search, or funnel dashboard.**

`src/app/admin/page.tsx` (Overview) is the closest thing to a "metrics"
page: 4 stat tiles (pending verifications, payments to confirm, open
disputes, completed jobs), a GMV figure, and two cron-health links
(auto-approve sweep, ledger reconciliation). All of it is **operational
health**, not demand intelligence — nothing about what customers search
for, where demand is strongest, or which searches fail.

- **Most-searched services / fastest-growing terms / search volume over time:** Missing — no search events exist to aggregate.
- **Demand by day/hour/location/price/customer type:** Missing (see matrix above — the raw booking-side columns exist but nothing aggregates them; the search side doesn't exist at all).
- **Unmet demand not being fulfilled:** Missing, but partially answerable today from `service_requests` in state `open` past `expires_at` with zero quotes — this query is not built, but the data would support a first version immediately.
- **Search-funnel analytics (search → impression → click → view → booking → conversion → no-result rate → time-to-booking):** Entirely missing. Not one of these stages is instrumented.
- **Unmet-demand analytics (no-result terms, under-supplied categories/locations, custom-request patterns, price points with search but no booking):** Missing, except that "categories with too few providers" is *partially* answerable today by joining `provider_categories` against `categories`/`service_requests` — no such query exists yet.
- **Supply-vs-demand by category/location:** Missing entirely as a report. The underlying tables to build it (`providers`, `provider_categories`, `service_transactions`, `reliability_scores`) all exist and are real, live data — this is squarely a "build the query/view," not a "collect new data" problem, for the booking side. The *search*-demand side genuinely has zero raw data to work from until search events are collected.

## Critical context: there is currently no live supply to measure against

Live read (production project, 2026-09-15): **`providers` where
`is_published = true` and `verification_status = 'verified'` returns
`0` rows.** Zero. Every provider-listing query in the app
(`src/app/services/[slug]/page.tsx`) filters on exactly this condition,
so **every service page on the live site currently shows zero
professionals to book**, independent of anything to do with demand
intelligence. `reviews` has 0 rows; `reliability_scores` has exactly 1
row (from a single test completion on 2026-09-10, score 75.00 on a
sample size of 1); `service_requests` has 2 rows; `quotes` has 1 row;
`service_transactions` has 6 rows. This is a real, live, extremely early
platform with no meaningful transaction volume yet — any "demand"
report built today would be reporting on statistical noise, not signal.
This audit does **not** fabricate volume to make the report look more
complete; it designs the collection mechanism and states plainly that
there is nothing to show yet.

## Event names actually observed vs. requested by the task

None of the task's proposed event names
(`search_performed`, `search_no_results`, `search_results_viewed`,
`provider_impression`, `provider_profile_viewed`, `service_viewed`,
`booking_started`, `booking_created`, `booking_completed`,
`booking_cancelled`, `quote_requested`, `quote_received`,
`quote_accepted`, `request_created`, `request_unfulfilled`,
`provider_unavailable`, `search_abandoned`) exist in this codebase in any
form. The nearest analogues that DO exist are `transaction_events` rows
with `event_type` values like `service_created`, `provider_checked_in`,
`completion_submitted`, etc. — these are booking-lifecycle audit events,
generated only after a transaction row already exists, not demand
signals.

---

## Phase 7 implementation (same day, after this audit)

> **Applied to production (2026-09-15), per explicit user
> authorization:** the schema below
> (`migration_proposals/PROPOSED_marketplace_001_demand_events.sql`,
> identical content also at
> `supabase/migrations/20260915143409_marketplace_001_demand_events.sql`)
> is now live. `demand_events`/`demand_rollup_daily` exist,
> `rpc_log_demand_event` is callable, and every instrumentation call
> site listed below is now actually recording real events (no longer a
> silent no-op) as real customers and providers use the app. Live-
> verified post-apply: a call to `rpc_log_demand_event` against
> production (rolled back, nothing persisted) succeeded and returned a
> real event id; `get_advisors` showed no unexpected new findings. The
> `demand_rollup_daily` aggregation job has since been built — see the
> update immediately below.

> **`demand_rollup_daily` aggregation job — APPLIED to production on
> 2026-09-15, per explicit user authorization**, as
> `supabase/migrations/20260915151912_marketplace_001_demand_rollup_job.sql`
> (identical content also kept at
> `migration_proposals/PROPOSED_marketplace_001_demand_rollup_job.sql`):
> adds `rpc_run_demand_rollup`/`rpc_run_demand_rollup_locked` (same
> locked-wrapper pattern as `rpc_run_auto_approve_sweep_locked`) plus a
> new `src/app/api/cron/demand-rollup/route.ts` cron route (registered
> in `vercel.json`, daily at 06:00 UTC), following the exact shape of
> the `ledger-reconciliation` route. **Found and fixed while building
> this:** `demand_rollup_daily`'s live primary key
> (`day, category_id, location_id`) makes `category_id`/`location_id`
> implicitly `NOT NULL` — but real events frequently have a NULL
> category (e.g. `provider_profile_viewed`) and/or NULL location (no
> location capture on search yet), so the table as originally applied
> could never store those groupings. The proposal migrates it to a
> surrogate primary key plus `unique nulls not distinct (day,
> category_id, location_id)` (Postgres 17). Live-verified in a rolled-
> back transaction against production: seeded events including
> NULL/NULL groupings, ran the rollup, confirmed correct per-group
> counts, confirmed re-running is idempotent (no duplicate rows, same
> totals), confirmed the NULL/NULL insert that used to be impossible
> now succeeds. 4 new tests in `tests/db/demand-rollup.test.ts`.
> Post-apply live verification against production (rolled back, nothing
> persisted beyond the schema change itself): the NULL/NULL insert
> succeeds, both `rpc_run_demand_rollup` and
> `rpc_run_demand_rollup_locked` run successfully, and `get_advisors`
> shows no unexpected new findings — the two functions correctly do
> NOT appear in the anon/authenticated-executable lists. The cron
> hasn't fired yet (next run: 06:00 UTC), so `demand_rollup_daily` has
> 0 real rows as of this writing — that's expected, not a bug.

Turned the Phase 3 design below into real, tested, ready-to-apply code
— nothing here is fabricated data, and nothing is applied/committed
without this report's authorization:

- **`migration_proposals/PROPOSED_marketplace_001_demand_events.sql`**
  — the full `demand_events`/`demand_rollup_daily` schema below, refined
  from the original sketch: instead of a raw "anyone can insert" RLS
  policy, the table has **no insert policy at all** (default-deny,
  matching `payments`/`ledger_entries`) — the only write path is a new
  `rpc_log_demand_event`, which rate-limits every call via the existing
  `rpc_check_rate_limit` primitive before inserting. Live-verified in a
  rolled-back transaction against production: event insert + dedup (two
  calls with the same `dedup_key` return the same row, no duplicate),
  direct client INSERT rejected by RLS, non-admin SELECT sees 0 rows,
  admin SELECT sees the real rows, anon (signed-out) can also log.
- **`src/lib/demand-events.ts`** — the application-layer logger
  (`logDemandEvent`, fire-and-forget, never throws) and session-id
  helper. Wired into real page loads and actions: `search_performed`/
  `search_no_results` (home page), `service_viewed` (service detail),
  `provider_profile_viewed` (storefront), `booking_created` (booking
  action), `quote_requested` (quote submission), `request_created`
  (task posting). Until the migration above is applied, every call
  fails with "function does not exist" and is silently swallowed by
  design — this is inert, not broken, and does not affect any existing
  page.
- **`src/app/admin/demand/page.tsx`** — a new admin "Demand"
  dashboard, built entirely from EXISTING real data (no migration
  needed for this part): per-category open task requests, unmet demand
  (expired with 0 quotes), quote acceptance rate, bookings, and repeat-
  customer rate, plus a flagged list of categories with real demand and
  zero eligible providers. Honestly labels the search-side metrics
  (top terms, search volume, no-result rate) as not yet available and
  explains exactly what's needed.
- **`tests/db/demand-events.test.ts`** — 7 tests describing the FIXED
  (not-yet-applied) behavior, following this codebase's established
  pattern (`tests/db/provider-eligibility.test.ts`): will fail against
  the live, unpatched database until the migration is authorized and
  applied.

See `PROVIDER_MATCHING_AND_RANKING_AUDIT.md` for the companion Phase 7
ranking implementation, and the final report for the full list of
changes, tests, and what remains authorization-gated.

---

## Phase 3 — Proposed event model (design only — NOT applied, NOT committed)

No migration was applied. The SQL below is a **proposal**, written to be
reviewed, not run. It has not been saved under `supabase/migrations/`
(so nothing in normal tooling would pick it up and apply it), has not
been committed, and has not been pushed.

### Design decisions and why

- **A single `demand_events` append-only table**, not a table per event
  type. This codebase already has one successful precedent for this
  shape (`transaction_events`, `event_type text` + `jsonb payload`) —
  reusing the pattern keeps the query surface consistent and avoids a
  proliferation of near-identical tables for 17 event types.
- **No raw free-text search query stored in a queryable/indexed column
  by default.** Free-text search terms can contain anything a user
  types, including things they wouldn't want logged verbatim forever
  (attempts to search for a person's name, a phone number pasted by
  mistake, something offensive). The proposal stores the term but keeps
  retention short (see below) and never indexes or exposes it to
  anything but an admin-only, audited query — this is a **judgment
  call to flag explicitly for your review**, not something to treat as
  settled by this document alone.
- **Session identifier, not device fingerprint.** A random,
  client-generated UUID stored in a cookie/localStorage, sent with each
  event — correlates a browsing session without needing a persistent
  device ID, IP address, or user-agent string. Authenticated events also
  carry `user_id`; anonymous ones carry only the session ID.
- **Location at `locations.id` granularity** (ward/town), reusing the
  existing table — never raw coordinates. This matches the existing
  privacy posture of the rest of the schema (customer location has
  never been lat/lng anywhere in this codebase).
- **Append-only, no updates.** Matches `transaction_events`' existing
  discipline. A correction is a new row, not an edit.
- **Aggregation via a scheduled job into rollup tables, not live
  queries over the raw event table for every admin page load** — see
  "Scale" below.

### Proposed table

```sql
-- PROPOSED — NOT APPLIED. For review only.
create type demand_event_type as enum (
  'search_performed',
  'search_no_results',
  'search_results_viewed',
  'provider_impression',
  'provider_profile_viewed',
  'service_viewed',
  'booking_started',
  'booking_created',
  'booking_completed',
  'booking_cancelled',
  'quote_requested',
  'quote_received',
  'quote_accepted',
  'request_created',
  'request_unfulfilled',
  'provider_unavailable',
  'search_abandoned'
);

create table demand_events (
  id                 uuid primary key default gen_random_uuid(),
  event_type         demand_event_type not null,
  occurred_at        timestamptz not null default now(),
  -- Anonymous correlation, always present. Authenticated user_id only
  -- when the event genuinely needs it (booking/quote events) — a
  -- browsing session should not force-correlate to an identity.
  session_id         uuid not null,
  user_id            uuid references profiles(id),
  -- What was searched/viewed/booked, all nullable — a given event type
  -- only populates the fields relevant to it.
  search_term        text,
  category_id        uuid references categories(id),
  service_id         uuid references services(id),
  provider_id        uuid references providers(id),
  location_id        uuid references locations(id),
  -- Coarse budget buckets, not raw amounts — avoids leaking a precise
  -- customer budget signal while still supporting "demand by price
  -- range" reporting. Values like 'under_1000', '1000_5000', etc.,
  -- defined by the application layer, not enforced here.
  price_range_bucket text,
  result_count       integer,
  -- Correlates a whole funnel (search -> impression -> click -> view ->
  -- booking) without needing to guess from timestamps.
  correlation_id     uuid not null default gen_random_uuid(),
  source_surface     text not null, -- e.g. 'home_search', 'service_detail', 'provider_storefront'
  -- Idempotency / dedup: a client-generated key so a retried request
  -- (double-submit, React strict-mode double-invoke, a flaky network
  -- retry) never double-counts.
  dedup_key          text,
  metadata           jsonb not null default '{}'::jsonb
);

-- One real query pattern per admin report; index accordingly rather
-- than indexing every column.
create unique index demand_events_dedup_idx on demand_events (dedup_key) where dedup_key is not null;
create index demand_events_type_time_idx on demand_events (event_type, occurred_at desc);
create index demand_events_category_time_idx on demand_events (category_id, occurred_at desc) where category_id is not null;
create index demand_events_location_time_idx on demand_events (location_id, occurred_at desc) where location_id is not null;
create index demand_events_correlation_idx on demand_events (correlation_id);
create index demand_events_session_idx on demand_events (session_id, occurred_at);

alter table demand_events enable row level security;
-- Insert-only, by anyone (including anon) — this IS meant to capture
-- anonymous browsing. A rate limit (rpc_check_rate_limit, already
-- built and proven in this codebase) must gate the insert path — see
-- Phase 8.
create policy "anyone can log a demand event" on demand_events
  for insert with check (true);
-- Read is admin-only. A customer/provider should never be able to read
-- raw demand_events, including their own — aggregates only, via admin
-- views.
create policy "admin can read demand events" on demand_events
  for select using (is_admin());

-- Retention: raw events are the highest-risk, highest-volume data in
-- this proposal. 90 days is a starting point for your review, not a
-- final answer — a scheduled job (same cron pattern as
-- auto-approve-sweep/ledger-reconciliation) would delete rows older
-- than the retention window. Aggregates survive in rollup tables
-- (below) indefinitely, since they no longer carry raw search terms
-- or per-user correlation.
comment on table demand_events is
  'Raw, append-only demand/funnel events. PROPOSED, not yet applied. Retention: intended ~90 days raw, enforced by a scheduled deletion job not yet built. Read: admin-only via RLS. Write: anyone (rate-limited).';
```

### Proposed rollup/aggregation strategy

Querying `demand_events` directly on every admin page load does not
scale once real volume exists — the task's own instruction ("Do not
create expensive unbounded queries over transactional tables for every
admin page") applies here just as much as to the transactional tables.
Proposed shape (not built): a scheduled job (same `scheduler_runs` +
advisory-lock pattern already proven three times in this codebase —
auto-approve sweep, ledger reconciliation, dispute escalation) that
runs hourly/daily and writes into small, fast-to-query rollup tables:

```sql
-- PROPOSED — NOT APPLIED. Sketch only, not a complete design.
create table demand_rollup_daily (
  day             date not null,
  category_id     uuid references categories(id),
  location_id     uuid references locations(id),
  search_count    integer not null default 0,
  no_result_count integer not null default 0,
  booking_count   integer not null default 0,
  primary key (day, category_id, location_id)
);
```

An admin dashboard reads `demand_rollup_daily` (small, indexed, cheap),
never `demand_events` directly except for a rare, admin-only drill-down
query.

### What this proposal deliberately does NOT decide

- The exact retention window (90 days is a placeholder for your review).
- Whether free-text search terms should be stored at all, or only a
  normalized/tokenized version — this is a real privacy trade-off and
  should be a founder decision, not something baked in silently.
- Whether an analytics warehouse (vs. Postgres rollup tables) is needed
  — at current and near-term volume (single-digit transactions today),
  Postgres rollups are more than sufficient; revisit if volume grows by
  orders of magnitude.

---

*Companion document: `PROVIDER_MATCHING_AND_RANKING_AUDIT.md` covers
Phases 4–6 (whether provider recommendation/ranking exists, and the
proposed ranking model).*

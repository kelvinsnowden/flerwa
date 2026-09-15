# Provider Matching & Ranking Audit (MARKETPLACE-001, Phases 4–6)

**Audited:** 2026-09-15. **Method:** direct inspection of every
booking/search/quote code path plus live read-only queries against the
production Supabase project. No data fabricated, no migration applied,
nothing committed or pushed.

> **Update (MARKETPLACE-SECURITY-002, same day):** the eligibility gaps
> this document found in `rpc_book_service`/`rpc_submit_quote` (see
> "Where provider selection happens today," items 2 and 3 below) were
> investigated as a dedicated security task and a fix was designed and
> live-verified (in rolled-back transactions only — **not applied to
> production**, pending authorization). Full detail:
> `SECURITY_READINESS_REGISTER.md` (SEC-P0-001/002/003, SEC-P1-001) and
> `SECURITY_AUTHORIZATION_MATRIX.md`. **This is the load-bearing
> conclusion for any future ranking work: do not build provider ranking
> or recommendations on top of the eligibility checks described below
> until the fix in those two documents is authorized and applied** — the
> ranking layer must consume a secure eligibility layer, and today's
> `rpc_book_service`/`rpc_submit_quote` eligibility checks are exactly
> the ones proven bypassable. A ranking function must never independently
> decide that an otherwise-ineligible (unverified, unpublished, suspended,
> uncleared, or QA/test) provider can be surfaced or booked — it operates
> strictly within the eligible set the (fixed) authorization layer
> produces, never expanding it.
>
> **Further update (MARKETPLACE-SECURITY-003, same day):** the
> eligibility fix above has been superseded by a stronger, broader one —
> `security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql`
> (supersedes and fully includes the `-002` proposal). It adds a durable
> `providers.is_test_fixture` column so a QA/test provider can never
> become bookable even by mistake (closing the last open item in this
> document's "QA/test" parenthetical above), closes a second,
> independently-found forgery path (`service_requests.state` directly
> writable to `'awarded'`), and live-tests the full `rpc_accept_quote`
> acceptance-time re-check this document's Phase 5 design assumed but
> had not yet verified. The same conclusion holds, now against the
> stronger fix: **do not build ranking on top of this layer until that
> proposal is authorized and applied.** See
> `SECURITY_READINESS_REGISTER.md` and `FINANCIAL_INTEGRITY_MODEL.md`
> for full detail.
>
> **Phase 7 implementation (same day, after the -003 fix was applied to
> production):** with the eligibility layer now live, the blocking
> condition above is resolved, and the Phase 5 ranking design below has
> been built and shipped as real, working application code (not
> committed/pushed yet, pending this report's authorization — see
> Section "Changes implemented"):
> - `src/lib/provider-ranking.ts` — `checkProviderEligibility` (mirrors
>   the RPC-level predicate for display/admin purposes) and
>   `rankEligibleProviders` (deterministic score-desc ordering,
>   `computed_at`-then-id tiebreaking, a rotating 1-in-5 exploration
>   slot for low-history providers seeded by category+day). 16 unit
>   tests in `src/lib/provider-ranking.test.ts`, all passing.
> - `src/app/services/[slug]/page.tsx` now orders the provider list by
>   this ranking instead of unspecified database order, and the query
>   itself now also excludes `is_suspended`/`is_test_fixture` (using the
>   -003 columns) in addition to the filters already there.
> - `src/app/admin/matching/` — a new admin section showing, per
>   service, the exact eligible+ranked list a customer would see right
>   now (with score breakdown) plus every excluded provider and the
>   specific reason(s) they're excluded — Phase 6's oversight
>   requirement, built on real, live data.
> This is now genuinely **Level 5 (rule-based matching with explainable
> ranking)**, not Level 2 — see the headline answer above, which
> describes the PRE-Phase-7 state and is left unedited for historical
> accuracy; the current state is summarized here and in the final
> report.

## Headline answer

**Level reached: (2) simple category filtering. Not (5) rule-based
matching, not (6) weighted ranking.** There is no scoring, no ranking, no
ordering by any quality/relevance/distance signal anywhere in this
codebase — application layer or database. Where a provider list is
shown to a customer, it is filtered by hard eligibility conditions and
then returned in **whatever order Postgres/PostgREST happens to return
it in** (no `.order()` clause at all). Where a provider list is used
server-side for booking (`rpc_book_service`), eligibility is checked
even more loosely than in the UI. Category filtering is real and
correctly implemented; it must not be described as "matching" or
"recommendation" — the task is explicit about this distinction, and this
audit holds to it.

## Where provider selection happens today (every instance found)

### 1. `src/app/services/[slug]/page.tsx:57-65` — storefront service detail page

```
supabase.from("providers")
  .select("*, reliability_scores(*), provider_categories!inner(category_id, is_cleared), profiles:user_id(avatar_url)")
  .eq("is_published", true)
  .eq("verification_status", "verified")
  .eq("is_accepting_work", true)
  .eq("provider_categories.category_id", service.category_id)
  .eq("provider_categories.is_cleared", true)
```

- **No `.order()` clause.** The result is sliced to the first 4
  (`providers.slice(0, 4)`, line 147) in whatever order the database
  returns — this is not a documented, stable, or intentional order; it
  is an artifact of query planning.
- **Eligibility filters present:** published, verified, accepting work,
  category-cleared. **Eligibility filters absent:** location/service-area
  match, availability for the requested date/time, capacity/workload,
  any safety/fraud hold beyond verification status, recurring-booking
  compatibility.
- `reliability_scores` is joined and fetched (avg_rating, jobs_completed
  are shown on the card) but **never used to order or filter** — it's
  display-only.

### 2. `rpc_book_service` (live function, `supabase/migrations/20260908134754_transaction_functions.sql`, most recently touched by `20260914150000_differentiated_fee_schedule.sql`)

The actual server-side eligibility check for booking a **specific**
provider is a single condition:

```sql
if p_provider_id is not null then
  if v_service.category_id is not null and not exists (
    select 1 from provider_categories pc
    where pc.provider_id = p_provider_id and pc.category_id = v_category_id and pc.is_cleared
  ) then
    raise exception 'Provider is not cleared for this category.';
  end if;
end if;
```

**This is a real gap, not a hypothetical one:** this RPC does **not**
check `is_published`, `verification_status`, `is_accepting_work`,
suspension status, or availability. The UI only ever shows/passes an
eligible `p_provider_id`, but the RPC itself — the actual security
boundary per this codebase's own stated discipline ("every function
re-validates the caller's identity and role itself — it never trusts
that RLS or the UI alone was sufficient") — does not independently
enforce those conditions. A crafted direct call with a category-cleared
but unpublished/unverified/not-accepting/suspended provider's ID would
currently succeed. This is squarely inside what Phase 5's mandatory
rules require ("must NOT select QA, unverified, suspended, unpublished,
or otherwise ineligible providers") and is flagged here as a **finding
requiring a decision**, not fixed in this pass (implementation is
gated on report review per the operating rules for this task).

### 3. `rpc_submit_quote` (live function)

Eligibility for a provider to quote on a customer's task request:

```sql
if not exists (
  select 1 from provider_categories pc
  where pc.provider_id = v_provider.id and pc.category_id = v_request.category_id
) then
  raise exception 'Add this category to your profile before quoting on it.';
end if;
```

**Weaker than the storefront path** — this doesn't even require
`is_cleared = true` on the category, only that the row exists. No
published/verified/accepting/suspension check at all. Any provider with
any category on their profile, cleared or not, published or not,
verified or not, can quote on any open task request in that category
today.

### 4. Task-request discovery (`src/app/provider/requests/page.tsx`)

Purely a **broadcast model** — every provider whose profile has a
matching `category_id` sees every open `service_request` in that
category, ordered by `created_at desc` (newest first — a real,
intentional sort, but chronological, not relevance-based). There is no
targeted routing, no "notify the top N eligible providers," no
per-request matching at all. `postTask` (`src/app/tasks/new/actions.ts`)
creates the request and does nothing else — no notification is sent to
any specific provider.

### 5. Deal Desk conversion (`rpc_convert_deal_desk_request`)

Provider is supplied directly by the admin converting the request (an
existing off-platform relationship being brought on-platform) — no
matching logic is expected or present here; this is correctly a manual
admin action, not a gap.

## What real signal data exists but is unused for ranking

| Table / column | What it captures | Where it's computed | Where it's read for ranking |
|---|---|---|---|
| `reliability_scores.score` | A genuine Bayesian-shrinkage estimator: `((completion_rate * jobs_completed) + (prior * k)) / (jobs_completed + k)` — computed in `rpc_approve_and_release` on every job completion (`supabase/migrations/20260908134754_transaction_functions.sql:293-317`) | On completion of each transaction | **Nowhere.** Never selected for an `ORDER BY` anywhere in the app or an RPC. |
| `reliability_scores.avg_rating`, `jobs_completed` | Real per-provider stats | Same | Displayed as text on `ProviderCard`/provider profile; never used to sort |
| `provider_categories.is_cleared` | Admin-set category eligibility | Admin action | Used as a hard filter (correctly) — not a ranking signal, and shouldn't need to be one |
| `provider_service_areas` | Provider's declared service area(s) | Provider-entered | **Nowhere.** Not read in any booking or listing query. Live row count: 1 (across the whole database). |
| `provider_availability_rules`, `provider_booked_slots`, `provider_blocked_slots` | Real, working availability/scheduling infrastructure — used correctly for the *scheduled* fulfilment mode's slot picker (`rpc_get_available_slots`) | Provider-entered / booking-driven | Used only when a customer is picking a slot for a scheduled service; **never used as an eligibility or ranking filter when the provider list itself is being generated** on the service detail page |
| `rpc_get_provider_response_minutes` | A real, working response-time metric (investigated and built in an earlier session) | Computed live from `messages`/`conversations` | Displayed on the storefront profile page as text; never used to rank |

This is the clearest evidence for the report's required distinction:
several of the *inputs* a real ranking model would need already exist,
are correctly computed, and are trustworthy — but **nothing reads them
for ranking**. This is "present but not connected," not "missing," for
those specific signals. The *matching mechanism itself* (eligibility
filter set + scoring + explainability) is missing in its entirety.

## Live data reality check

Production query (read-only, 2026-09-15): `providers` where
`is_published = true and verification_status = 'verified'` → **0 rows.**
`reviews` → 0 rows. `reliability_scores` → 1 row (score 75.00, sample
size 1, from a single test completion). `provider_service_areas` → 1
row. There is currently no live, published, verified provider on the
platform at all, and only one provider has ever completed a job. Any
ranking model built today would have effectively no real historical
data to rank against — this is a genuine, current **cold-start
condition for the entire marketplace**, not a per-provider edge case.
This shapes the recommendation below: build the eligibility filter and
an explainable rule-based ranker now (it works correctly on day one with
zero history), and do not attempt anything data-hungry (ML, learned
weights) until real volume exists.

---

## Phase 5 — Proposed first-generation ranking model (design only)

### Eligibility filter (hard gate — a provider outside this list is never shown, never rankable, and the reason should be recorded for admin visibility)

1. Not a QA/test fixture — this repo already has a real, standing
   example: provider `aa332618-bf31-4af2-b699-f8bba7b47bdb` ("QA
   Plumbing Pro") has been kept explicitly unpublished during this
   session's testing precisely so it can never reach a real customer.
   The proposed filter needs a durable way to express "test fixture,
   never eligible" beyond just relying on `is_published=false` (which a
   future test run could accidentally flip) — e.g. a dedicated
   `providers.is_test_fixture boolean not null default false` flag,
   hard-excluded in the eligibility query regardless of any other
   field. **Not built. Proposed here for your review.**
2. `is_published = true`
3. `verification_status = 'verified'`
4. `is_accepting_work = true`
5. Not suspended (`providers.is_suspended = false` — this column and its
   dual-control suspend/reinstate RPC already exist and work, per this
   session's earlier TSF-014 finding)
6. `provider_categories.category_id = <requested category> and is_cleared = true`
7. Location/service-area match — `provider_service_areas` contains the
   requested `location_id`, **or** the provider's `base_location_id`
   matches for providers who haven't declared explicit service areas
   (fallback needed — the table is almost never populated today)
8. Available for the requested date/time — for scheduled services, via
   the existing `rpc_get_available_slots` machinery; for on-demand
   services, no equivalent check exists today and would need to be
   defined (e.g. capacity/concurrent-job limit)
9. No open dispute or active fraud/safety hold on the provider (derivable from `disputes`/`reports` state, not currently queried together anywhere)

### Ranking signals (only among providers that already passed every eligibility filter)

Given the current near-zero data volume, a **fully deterministic,
explainable weighted sum** is proposed — no ML:

| Signal | Source (already exists) | Cold-start behavior |
|---|---|---|
| Reliability score | `reliability_scores.score` (Bayesian shrinkage, already computed) | Shrinks toward a neutral prior at `sample_size = 0` — this is *already* how the formula behaves, which is exactly right for cold start |
| Response time | `rpc_get_provider_response_minutes` (already computed) | Null for a provider with no message history — treat as neutral/median, not zero and not a penalty |
| Cancellation rate | `reliability_scores.cancellation_rate` (column exists, **not currently populated by any write path** — found during this audit; the insert in `rpc_approve_and_release` does not set it, and no other function writes it either) | Needs to actually be computed before it can be a signal — currently a dead column, always NULL |
| On-time rate | `reliability_scores.on_time_rate` — same finding: column exists in the schema, never written by any function | Same — dead column, always NULL |
| Category-exact vs. adjacent match | `provider_categories` | N/A — binary |
| Location proximity | `provider_service_areas` vs requested `location_id` (ward-level, not distance) | Exact-ward match scores highest; declared-town-only scores lower; no declared area at all falls back to the provider's base location |
| Recent activity / exploration slot | New signal, not yet built — see fairness note below | — |

**Explicit fairness mechanism (required by the task, and by this
platform's own stated founding principle of not disadvantaging new
providers):** reserve a small, fixed share of ranked positions (e.g. 1
in 5) for an "exploration" slot filled by qualified-but-low-history
providers, chosen at random among those who pass every eligibility
filter but have `sample_size` below a threshold. This directly
implements a controlled-exploration mechanism without needing a
multi-armed-bandit system — a simple, explainable rule, consistent with
"do not use machine learning unless there is sufficient clean historical
data," which this platform does not have.

**Explicitly excluded ranking inputs**, matching the task's own
prohibitions: no paid placement, no raw single-review rating without a
minimum-review floor, no ranking purely by platform fee/revenue, no
seniority-alone ordering.

### Tie-breaking, missing-data, and explainability

- Tie-break: `reliability_scores.computed_at` ascending (provider with
  the longer track record wins a tie) as the final deterministic
  tiebreaker, then `provider_id` for full determinism (a ranking must
  be reproducible for the same inputs, per the task's explicit
  determinism requirement).
- Missing data (no `reliability_scores` row at all — a brand-new
  provider): treated identically to `sample_size = 0` in the Bayesian
  formula, i.e. neutral, not penalized to the bottom.
- Explainability: every ranked result should be attachable to a
  human-readable reason (e.g. "Verified, cleared for Plumbing, ward
  match, reliability score 82/100 from 14 jobs") — this is a UI/data
  requirement for Phase 6, not yet built.

---

## Phase 6 — Admin oversight UI (design only, not built)

None of this exists today. Proposed shape, following this codebase's
existing GOV-P4 dual-control pattern (already built and proven this
session for suspend/refund/category-pause) for the "override" half:

- A per-gig inspector (new admin route, e.g. `/admin/matching/[transaction_id]`
  or embedded in the existing `/admin/bookings/[id]` page, which already
  has the single-pane transaction view this session resolved OPS-001
  with): requested service/location/date/budget, the full eligible-list
  with each excluded provider and why, the ranked list with a
  score breakdown per provider.
- Manual override: requires admin permission (the existing
  `admin_roles`/`has_admin_role` mechanism), a required reason, and an
  audit row (`admin_actions`, already the standing pattern) — and must
  not be able to select a provider that failed a hard eligibility
  filter (QA fixture, unpublished, unverified, suspended). This mirrors
  the existing GOV-P4 dual-control build precisely and should reuse it,
  not invent a parallel mechanism.
- Category-level supply views, no-provider-available cases, and
  ranking-anomaly/gaming detection are all genuinely new admin
  reporting, not present in any form today.

---

*Companion document: `MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md` covers
Phases 1–3 (demand/search analytics).*

# Marketplace Extension Audit

Written before the professional-storefront / pre-service-messaging /
availability pass, per that task's own "understand first, extend second"
requirement. Everything below was verified against the actual migrations
and source in this repo, not assumed from the other docs.

## 1. What already exists and works

- **One transaction spine** (`service_transactions`), driven by
  `SECURITY DEFINER` RPCs, RLS default-deny. Booking (`rpc_book_service`),
  Post-a-Task quote acceptance (`rpc_accept_quote`), and Deal Desk
  conversion all create rows in the *same* table with the same fee calc
  and state machine (`ARCHITECTURE.md`, `DATABASE.md`).
- **Catalogue**: `categories` → `services` → `service_scope_items` /
  `service_checklist_items`. Real, admin-curated rows only.
- **Seller side**: `providers`, `provider_categories` (competence + admin
  clearance, per category, never blended), `provider_services` (price
  override), `provider_service_areas`, `reliability_scores` (one row,
  portable, recomputed by `recompute_reliability()`, never hand-edited).
- **Post-a-Task**: `service_requests` + `quotes` (5-quote cap enforced by
  trigger), fully wired UI on both sides (`/tasks/new`,
  `/provider/requests`), converts into a real transaction via
  `rpc_accept_quote`.
- **Messaging**: real, transaction-scoped, realtime (`messages` table,
  `transaction_id not null`, RLS via `is_txn_participant()`, Realtime
  enabled). Inbox (`/messages`) and thread (`/messages/[transactionId]`)
  both real, no stub.
- **Reviews**: tied to `reviewer_id`/`reviewee_id`/`transaction_id`, RLS
  requires the transaction be `settled/reviewed/closed` and the reviewer
  be a real participant — cannot be forged.
- **Provider storefront** (`/provider/[slug]`): real data — avatar, name,
  headline, location, verification badge, stat tiles (jobs/rating/
  on-time), bio, services with real prices, and (added earlier this
  session) a real Reviews section. This exists and works; it is not a
  stub — but see §3 for what it's still missing per this task's brief.
- **Seller dashboard** (`/provider`): real pending/earned amounts,
  reliability, active/completed jobs, own services, links to Task
  requests / Add a service / Messages / Deal Desk.

## 2. What exists in the database but is not exposed in the UI

- Nothing significant found. `service_requests`/`quotes` were the one
  historical example of this (flagged in `SELLER_FLOW.md` §7) and are
  now fully wired. No other dead tables identified.

## 3. What exists in the UI but is incomplete

- **Provider storefront** has no portfolio section (no schema for it
  either — see §5) and no distinct "response time/response rate" stat
  (not computed anywhere — `reliability_scores` has no such column; see
  §5 on whether to add one now or state it honestly as unavailable).
- **Messaging** only exists *after* a transaction is created. There is no
  way to message a provider before booking — confirmed by
  `messages.transaction_id not null` and every messaging route keyed by
  `transactionId`. This is the literal gap the brief's §3 describes.
- **Service detail page** (`/services/[slug]`) already shows a provider
  picker (`ProviderCard` list) with Select-to-book, but no per-provider
  "Message" or "View profile" affordance inline (View profile *is*
  reachable — the whole card links to `/provider/[slug]` — but Message
  is not).

## 4. What needs to be extended (not replaced)

- **Messaging schema**: `messages.transaction_id` needs to become
  optional, with a new, narrower concept added alongside it for
  pre-service threads. Full design in the implementation section below —
  short version: a new `conversations` table, `messages` gets a nullable
  `conversation_id` FK alongside its existing `transaction_id` FK
  (exactly one of the two set, enforced by a check constraint), and two
  *additional* RLS policies (Postgres OR-combines multiple permissive
  policies on the same table/command, so the existing transaction-scoped
  policies are untouched). Zero migration of existing message rows
  needed — this is purely additive.
- **Provider storefront**: extend the existing page with a Message entry
  point and, once the conversations table exists, a real "started a
  conversation" affordance — not a rebuild.
- **Seller dashboard**: extend with a Conversations link (reusing the
  generalized messages UI) and, where a service is `scheduling_mode =
  'scheduled'`, an Availability section.

## 5. What genuinely needs new database/schema functionality

Confirmed by grepping every migration for `availability|calendar|slot|
schedule|conversation` — **none of this exists yet**, so this is new,
not a duplicate of something already built:

- **`conversations` table** (see §4) — customer_id, provider_id,
  optional service_id, optional requested_date/requested_time (mutable
  context fields, not per-message), optional transaction_id (set once
  the conversation leads to a real booking, for cross-linking only — the
  transaction still gets its own existing message thread; this is not
  merging the two threads into one, which would be a much larger and
  riskier change for this pass).
- **A scheduling-mode field on `services`**: neither `fulfilment_mode`
  (which encodes *where* a service happens — on-site, representation,
  remote — not *when/how it's scheduled*) nor any other existing column
  expresses "does this service use a real calendar." Adding
  `services.scheduling_mode text check (in 'none','request','scheduled')
  default 'request'` is the smallest addition that lets the catalogue
  (not hard-coded per-service-name branches in application code) decide
  the experience, per the brief's own §6 instruction.
- **A minimal availability model**, since none exists:
  - `provider_availability_rules` — recurring weekly hours
    (day_of_week, start_time, end_time) per provider.
  - `provider_blocked_slots` — one-off blocked date/time ranges a
    provider sets manually.
  - `provider_booked_slots` — the actual confirmed commitments, one row
    per scheduled transaction, with a Postgres **exclusion constraint**
    (`btree_gist`, `provider_id` + `tstzrange` overlap) as the real
    double-booking guard — not just an application-level check-then-
    insert, which race-condition-fails under concurrent requests. This
    is what makes "two customers cannot both obtain a confirmed
    conflicting slot" actually true at the database level, per the
    brief's explicit requirement.
- **response_time/response_rate on `reliability_scores`**: genuinely no
  data exists to compute this honestly yet (would need first-response
  timestamps tracked somewhere, which nothing currently records). Not
  adding a fake or hard-coded value — the storefront will omit this stat
  entirely until it can be computed from real data, consistent with
  "no reviews yet" / "new professional" being the honest answer rather
  than inventing a number.
- **Portfolio**: no schema exists. The `avatars` Storage bucket pattern
  (public bucket, owner-scoped RLS via path prefix) is the direct
  precedent to reuse for a new `provider-portfolio` bucket + a thin
  `provider_portfolio_items` table (provider_id, storage_path, caption,
  sort_order). Given the size of everything else in this pass, this is
  scoped as a **follow-up**, not built in this pass — flagged here
  rather than silently dropped.

## Implementation plan (this pass)

Given the size of the full brief, prioritized in the order the brief
itself emphasizes ("this is an important architectural extension" for
messaging; Chef named explicitly as the strongest calendar candidate):

1. **Pre-service conversations** — schema, RLS, RPC, generalized
   messaging UI, storefront "Message" entry point. (Full build.)
2. **Availability model + conflict-safe scheduled booking** — schema
   with exclusion constraint, provider-side "block time" UI, customer-
   side slot picker wired to a real request flow for Chef specifically
   (the named strongest-calendar pilot). (Full build for Chef; the
   schema is generic and reusable for the other services later.)
3. **Terminology pass** — "Job" → "Service" in customer-facing copy,
   "My Services" naming. (Scoped grep-and-fix.)
4. **Storefront/dashboard polish** — Message button, availability
   section gated by `scheduling_mode`, conversations link. (Extends
   what already exists; not a rebuild.)

**Deferred, stated rather than hidden**: portfolio schema/UI, response-
time/response-rate metrics (no real data source yet), full calendar UX
for Content Creator/House Hunter/Verification (the reusable schema
supports it; per-service UI polish for all four remaining pilots beyond
Chef is follow-up work given this pass's scope).

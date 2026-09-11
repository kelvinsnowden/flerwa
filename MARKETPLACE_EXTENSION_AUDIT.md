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

## Progress log

- **Pre-service conversations** (step 1): built and applied
  (`20260911102345_conversations.sql`). `conversations` table, nullable
  `messages.conversation_id` alongside the existing `transaction_id`,
  `rpc_start_conversation`, generalized messaging UI
  (`/messages/c/[conversationId]`, unified inbox), Message button on the
  storefront and service-detail provider cards. Verified via
  role-simulated SQL: idempotent thread reuse, cross-customer RLS
  isolation, anon cannot execute the RPC, non-participants rejected on
  insert.
- **Availability model + Chef scheduling** (step 2, schema half done):
  built and applied (`20260911111652_availability.sql`).
  `services.scheduling_mode` ('none'/'request'/'scheduled', default
  'request') + `slot_duration_minutes`; `providers.booking_buffer_minutes`
  / `min_notice_hours` / `max_advance_days`; `provider_availability_rules`
  (weekly hours), `provider_blocked_slots` (one-off time off),
  `provider_booked_slots` (confirmed commitments, `exclude using gist
  (provider_id with =, slot_range with &&)` as the actual double-booking
  guard). `rpc_book_service` extended in place to enforce min notice, max
  advance, working-hours, and blocked-slot checks for
  `scheduling_mode = 'scheduled'` services only — every other service
  goes through the exact same path as before this migration.
  `personal-chef` set to `scheduling_mode = 'scheduled'`, 120-minute
  slots — the brief's own named strongest-calendar pilot.

  Verified with a role-simulated concurrent-booking test (synthetic
  fixtures inside a rolled-back transaction, nothing persisted): customer
  A booking 14:00–16:00 succeeds; customer B attempting an overlapping
  14:30 slot is rejected with a friendly error
  ("That time was just booked by someone else…"); customer B booking the
  non-overlapping 17:00 slot succeeds. Confirms the brief's explicit
  requirement — two customers attempting the same time cannot both obtain
  a confirmed booking — holds at the database level, not just in
  application code.

  **Now built**: `rpc_get_available_slots` (read-only, mirrors the same
  rules/blocked/booked checks as `rpc_book_service`) backs a real slot
  picker on the booking form — for `scheduling_mode = 'scheduled'`
  services the free `datetime-local` field is replaced by a date picker
  and a grid of actually-open times; submission is disabled until a real
  slot is chosen. A provider-facing Availability page
  (`/provider/availability`) lets a professional set weekly working hours
  and block time off, using the same plain RLS self-write pattern as
  `provider_service_areas` — no RPC needed for that part.

- **Terminology pass** (step 3): grepped every customer-facing file under
  `src/app` for "Job"/"Jobs" and replaced with "Service"/"booking" —
  storefront stat tiles, ProviderCard, the booking flow's provider picker
  and "what happens next" copy, the booking detail page's evidence and
  dispute copy, the shared notifications empty-state, the trust-signal
  row, and the site meta description. A second pass on the *catalogue*
  itself (service summaries/descriptions and checklist item labels, which
  are customer-visible on the storefront and the evidence-review screen)
  found and fixed three more "provider" mentions the code-only grep
  couldn't see (`know-before-you-pay`, `viewed-for-you`,
  `document-collection` service text; two checklist item labels).
  Provider-facing surfaces (`/provider` dashboard, `/provider/jobs/[id]`,
  Deal Desk, admin) intentionally keep "job" as their own operational
  vocabulary — out of the brief's customer-facing scope — and internal
  route/DB/code names are unchanged, no unnecessary renaming.

## Final verification

- `npx tsc --noEmit` and `npm run build` both clean after every step
  above (re-run one final time at the end of the pass).
- Live-checked the production deployment (auto-deployed from each push):
  the redesigned Personal Chef service detail page correctly shows the
  new "This service runs on a real calendar — choose a professional
  above to see their open times" copy and a disabled "Choose a time to
  continue" button (no cleared/verified chef provider exists yet in
  production, so no slot picker renders — this is the correct, honest
  empty state, not a bug); `/messages` and `/provider/availability` both
  correctly redirect an unauthenticated visitor to
  `/login?next=<path>` with a 200 response, no server error.
- The double-booking conflict guarantee was verified against the live
  database with role-simulated SQL (synthetic fixtures inside a
  rolled-back transaction, nothing persisted): two customers attempting
  an overlapping slot cannot both get a confirmed booking.
- Not independently re-verified end-to-end in a browser with a real
  signed-in customer and a real onboarded chef provider with configured
  availability — that would require creating real accounts in
  production. The server-side conflict guarantee (the actual safety
  property the brief requires) is proven at the database level
  regardless of what any particular UI session does.

## Storefront redesign (follow-up pass)

Requested against a specific mockup after the pass above shipped. Rebuilt
`/provider/[slug]` to match it, extending rather than replacing what
already existed:

- **Portfolio** (previously deferred in §5 above) — built for real:
  `provider_portfolio_items` table + a `provider-portfolio` storage
  bucket, reusing the `avatars` bucket's exact public-read/owner-write
  RLS pattern. Management UI at `/provider/portfolio`. The storefront
  hero gallery uses these real photos, with a plain placeholder (never a
  stock photo) when a provider hasn't uploaded any.
- **Real response-time stat** — `rpc_get_provider_response_minutes`
  computes "usually responds within X min" from actual
  conversations/messages timestamps (now that pre-service messaging
  exists). SECURITY DEFINER since conversation/message RLS is
  participant-only and a storefront visitor isn't one; only returns an
  aggregate number, never row content. Omitted (not zero, not a
  placeholder) until a provider has real conversation history.
- **Public availability calendar** — `rpc_get_month_availability` colours
  each day Available/Booked/Unavailable from the same
  rules/blocked/booked tables the Chef booking flow already uses. Shown
  only for providers with a `scheduling_mode='scheduled'` service.
- **Service areas** — real `provider_service_areas` data plus a
  deliberately generic decorative graphic (concentric rings, brand
  colours) rather than a real map, since no maps API is wired up and
  faking street-level precision would be its own kind of dishonesty.
- **Explicitly did not add** the mockup's "Culinary Arts Certified" /
  "Background Checked" badges — `docs/06-trust-architecture.md` states
  outright not to claim "background checked," and there's no
  certifications schema to back a specific credential claim honestly.
  The trust box says exactly what `verification_status` substantiates:
  "Identity verified by Flerwa."
- Quick-nav (Overview/Services/Portfolio/Reviews) scrolls one continuous
  page rather than hiding sections behind real tabs — matches the
  `#providers`/`#book` anchor pattern already on the service detail page,
  and keeps Availability/Service Areas (which aren't nav labels in the
  mockup either) in the natural flow instead of orphaned behind a tab.

Verified: `tsc --noEmit` and `npm run build` clean; live-checked on
production — `/provider/portfolio` redirects an unauthenticated visitor
to login, a nonexistent provider slug 404s cleanly, and the home page
loads with zero console errors after the push. Not click-tested against
a real portfolio/calendar/service-area on production, for the same
reason as the availability pass above: no real provider has been
onboarded with that data yet, and creating one would mean fabricating
production data.

## Generalized creator-style extensions (second follow-up pass)

Requested against a second mockup (a content creator's profile) with the
explicit instruction that it needed to look different from the generic
storefront. Rather than branching the storefront on provider type or
category, extended the same generic schema with optional,
provider-authored fields any provider can use — a chef or a house
hunter benefits from these exactly as much as a content creator, per the
original brief's "one generic architecture, not per-service systems"
rule:

- `services.icon` (admin-curated, same precedent as `categories.icon`)
  drives the quick-chip row per real SERVICE instead of per category,
  since one provider often sells several distinct services in one
  category.
- `provider_portfolio_items` gained `tag`/`reach_label`/`video_url`/
  `media_type`, all optional and provider-typed. `reach_label` is
  explicitly free text the provider enters themselves (e.g. "125K
  views") — there is no analytics integration, so this is never
  platform-computed or fabricated. `video_url` links out to an external
  post (TikTok/Instagram/YouTube); no video hosting was built. The
  storefront portfolio grid filters by whatever real tags a provider has
  actually used and shows a play affordance for video items.
- `providers.storefront_tagline`: an optional, self-authored short CTA
  line, editable from the same wizard step that already edits headline/
  bio/experience_summary — rendered as a banner that anchor-links to the
  existing Message button (no new messaging path).
- `provider_faqs`: a generic Q&A list any provider can author
  (`/provider/faq`), same self-write RLS pattern as
  `provider_availability_rules`. Only shown — and only added to the
  quick-nav — when a provider has actually added questions.
- "Open to remote projects" is a real badge derived from the provider
  having a `fulfilment_mode = 'remote_digital'` service, not new data.
- Deliberately skipped the mockup's fabricated engagement numbers
  (platform-computed view counts) and did not add new certification
  badges beyond what the base storefront pass already ruled out.

Verified: `tsc --noEmit` and `npm run build` clean; RLS/grants confirmed
via direct query (`provider_faqs` has the same public-read/self-write
policy pair as the other provider-owned tables). Live-checked on
production: `/provider/faq` and the `content-creator-session` service
page both load correctly with zero console errors. One false alarm
during this check — a reused Kernel browser session showed a stale 404
for `/provider/faq` after the push; a raw HTTP fetch (bypassing any
client-side state) and a fresh browser session both confirmed the route
was actually live and redirecting correctly the whole time, so this was
a browser-session artifact, not a deploy or code issue.

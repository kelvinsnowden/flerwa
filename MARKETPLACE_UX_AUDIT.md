# Marketplace UX Audit & Correction

Written in response to a product-direction correction: the implementation had
drifted toward a small "book a service" directory. Trusted Services is a
two-sided marketplace — people who need things done, and people who offer
services, with trust/transaction infrastructure between them. This document
records what was actually found, what changed, and what's deliberately
deferred.

See `FIGMA_AUDIT.md` for why Figma itself could not be inspected (no file
key available anywhere in the repo or conversation history) — this audit is
based on `/design-references/mobile/*.png` (2 screens: login, OTP) and a
direct read of the current implementation.

**Update:** the top of §11's follow-up list (seller onboarding wizard,
Post-a-Task's provider side, real services under the new categories) was
built in the very next pass — see `SELLER_FLOW.md` for how, and
`SECURITY.md` §9–11 for a real, pre-existing authorization gap
(`providers.verification_status` had no guard trigger) found and fixed
while building it. §11 below is left as originally written for the
historical record; treat `SELLER_FLOW.md`'s own "still deferred" section
as the current one.

## 1. What the architecture already got right

Before touching anything, the actual database/backend was checked against
the "two-sided, not mutually exclusive" requirement — and it already worked
this way, just not exposed as such in the UI:

- **"Is this user a seller" has never meant `profiles.role = 'provider'`.**
  Grepped the entire codebase: nothing, anywhere, ever sets `profiles.role`
  to `'provider'`. It defaults to `'customer'` at signup and stays there.
  The real signal — used correctly by `/provider/apply`'s own redirect logic
  — is **whether a row exists in the `providers` table for that
  `user_id`.** A user can have a `profiles` row (implicitly "customer") and
  a `providers` row simultaneously with zero conflict. "Both" already
  worked at the data layer.
- **This was, however, a live bug in the UI**: `BottomNav` and `SiteHeader`
  both computed the "Bookings" tab's destination via `role === "provider"`
  — which, per the above, was **always false**, so a real seller's bottom
  nav always pointed at `/account/bookings` instead of their seller
  dashboard at `/provider`. Fixed by computing `isSeller` from
  `providers` row existence in `src/app/layout.tsx` and threading it
  through both components instead of the dead `role` check.

## 2. Terminology (spec §2)

"Provider" was already not being surfaced as raw internal-table language
before this pass — an earlier pass in this same session had already
renamed it to "Pro" everywhere in the UI. That word choice is now corrected
to **Seller / Professional**, per the exact mapping given:

- "Become a provider" → **Sell your services**
- "Provider dashboard" → **Seller dashboard**
- "Provider profile" / "Choose a Pro" → **Professional profile** / **Choose
  a professional**
- Status/timeline copy ("Pro en route", "Cancelled by pro", etc.) →
  **Professional en route**, **Cancelled by the professional**
- Applied across 24 files (see that pass's own summary in the session log).

**Left unchanged, per the spec's own "internal term is fine" carve-out:**
route paths (`/provider/*`), the `providers`/`provider_id`/
`provider_categories`/`saved_providers` table and column names, TypeScript
identifiers (`Provider` type, `ProviderCard`, `applyAsProvider`,
`saveProvider`), the `UserRole` enum/type, and code comments.

**Not done**: renaming public profile pages to show a specific profession
as the headline (e.g. "James Mwangi — Verified Plumber") instead of the
provider's own free-text `headline` field. The `headline` field already
serves this purpose today (e.g. seeded as "Property Verification ·
Nairobi") and is provider-authored, so this mostly falls out naturally once
sellers in the new categories fill in a real headline — no code change
needed beyond what's already there.

## 3. Buyer / seller / both onboarding (spec §1)

New: `/onboarding` — shown exactly once, right after a user's first
`profiles` row exists with no `intent` set yet. Three cards: **Find someone
to help me / Offer my services / Both**, matching the spec's copy exactly.
Selecting one calls `setIntent()` (`src/app/onboarding/actions.ts`), which:

- Writes `profiles.intent` (`'buyer' | 'seller' | 'both'`) — new nullable
  column, migration `20260910180000_marketplace_intent_and_categories.sql`.
- **Is explicitly documented in the column comment as a preference, not a
  permission** — nothing reads it for access control. Whether someone can
  act as a seller is still 100% governed by the pre-existing `providers`
  row + `verification_status`, exactly as before this change. A user who
  picked "buyer" can go sell services later with zero schema friction, and
  vice versa.
- Redirects to `/provider/apply` if `seller`, `/` otherwise.

The redirect-to-onboarding check lives once, in `src/app/layout.tsx`
(alongside the role/isSeller fetch already happening there) rather than
patched into every auth completion path (phone OTP verify, email login,
signup) separately — simpler and can't be missed by a future new auth
entry point.

## 4. Category taxonomy (spec §3)

`docs/09-verticals.md` argues, with real citations, for staying narrow on
**launch operations** — that reasoning is sound and untouched. What was
wrong was conflating that with **catalogue breadth**, which the spec
correctly separates out (§17: *catalogue broad, availability truthful,
launch operations focused*).

Added three new real category rows (migration above), no fake services:

- **Home & Property** (`home-property`) — cleaning, repairs, installations,
  property upkeep
- **Personal** (`personal`) — tutoring, fitness, beauty, personal chefs,
  photography, etc.
- **Errands & Tasks** (`errands-tasks`) — pickups, deliveries, document
  collection, local representation

Existing **Verification & Representation** (`remote-verification`) already
covers the spec's "Property & Local Representation" group essentially
1:1. Existing **Business & Creator Services** (`business-content`) already
covers the spec's "Business & Creators" group.

**Deliberately not done**: seeding actual `services` rows (with prices,
turnaround times, checklists) under the three new categories, and not
building a subcategory table for the ~100 specific leaf items the spec
lists (Plumbing, Electrical, Tutoring, SEO, etc. individually). The spec is
explicit that catalogue breadth must not mean fake sellers/availability —
inserting speculative priced services with no real seller behind them would
cross exactly that line. Categories with no services render through the
**existing** empty-state path (`EmptyStateBlock` in `src/app/page.tsx`,
already built, unchanged) — "Nothing in {category} yet." This is real,
honest, and matches the spec's own instruction to use graceful empty states
rather than faked breadth. Adding real priced services per category is real
content/business work (pricing, checklist design, ops readiness) that needs
those decisions made, not a UI task — flagged as the top follow-up below.

## 5. Search (spec §4)

`src/app/page.tsx`'s services query now also searches `description`
(previously only `name`/`summary`) — one-line change, real data, no schema
change needed since `services.description` already existed.

**Deliberately not done**: relevance ranking beyond Postgres `ilike`,
location/availability/rating-weighted search, or a semantic-search layer.
The spec asks the architecture not preclude this later — `ilike` across
three text columns via `.or()` is trivially replaceable with a real
full-text or vector search later without changing the calling code's shape
(still "give me `services` matching `q`"), so nothing here blocks that.

## 6. Home screen (spec §5) & two transaction entry points (spec §6)

`src/app/page.tsx` restructured to: search → task-posted confirmation
banner (when relevant) → flagship service banner → **Popular categories**
(now 5, labelled) → **Services near you** (renamed from "Book a service",
real data, unchanged query shape) → **Can't find what you need? → Post a
task** → **Want to earn from your skills? → Sell your services** → trust
signals → Deal Desk callout.

**Post a Task** (spec §6) is new and real, not a stub: `/tasks/new` +
`src/app/tasks/new/actions.ts`. The `service_requests` table already
existed in the schema (from the original build) with working RLS
(`"requests customer read/write own"`) but had **zero UI ever wired to
it** — this was a schema-only, fully-dead feature until now. The new form
inserts a real row (category, location via the same typable `Combobox`
used elsewhere, description, optional budget) and redirects home with a
confirmation banner.

**Deliberately not done**: the provider-facing side of Post-a-Task — seeing
open requests, submitting a `quotes` row, the customer accepting a quote
and having it convert into a real `service_transactions` booking. The
`quotes` table and its RLS already exist (also from the original build,
also fully unwired), so the data layer is ready, but building the
provider-quote-submission UI, the customer's "review quotes" UI, and the
accept-to-booking conversion is a substantial feature on its own — flagged
as the top functional follow-up below, right after real category services.

## 7. Seller onboarding (spec §7) & profile (spec §8)

`/provider/apply` already collected the core fields (display name,
headline, base location, bio) and already gates publishing behind admin
verification (`is_published` defaults false, `verification_status`
defaults `'pending'`, both changed only by admin-only RPCs) — this part of
the architecture was already correct and untouched.

`src/app/account/page.tsx` already conditionally shows "Sell your
services" vs. "Seller dashboard" (with a live `VerificationBadge`) based on
real `providers` row + `verification_status` — this was already correct
before this pass (only wording changed, not logic).

**Deliberately not done**: the fuller 10-step seller wizard the spec
describes (categories/subcategories picker, per-service pricing UI,
explicit availability calendar, portfolio upload beyond the existing
avatar). The current single-page apply form plus admin manual review is
real and functional, just not that granular yet — flagged as a follow-up.

## 8. Kept, per explicit instruction

- **Bring your own customer / Deal Desk** — untouched, still linked from
  the account menu. Not specifically re-framed as a seller-experience CTA
  (spec's suggested placement) — that's a small follow-up, not done here
  for time.
- All financial/security infrastructure (`service_transactions` state
  machine, ledger, RLS, admin verification, disputes, notifications) —
  completely untouched by this pass. Only UI copy and the two additive,
  non-breaking schema additions above (`profiles.intent`, 3 category rows)
  changed.

## 9. Affected routes (new)

- `/onboarding` — buyer/seller/both, shown once
- `/tasks/new` — Post a Task

## 10. Database changes

Migration `20260910180000_marketplace_intent_and_categories.sql`:
`profiles.intent` (nullable, checked, non-gating), 3 new `categories` rows.
Applied directly via the Supabase MCP `apply_migration` tool against the
live project (`famdxoardiibonghxepl`) — not just written to the repo.

## 11. Follow-up, roughly in priority order

1. Real, priced `services` under the 3 new categories (needs actual pricing
   / checklist decisions — content work, not a coding task).
2. Provider-facing Post-a-Task: browse open requests, submit a quote.
   Customer-facing: review quotes, accept one, convert to a real booking.
3. Fuller seller onboarding (category/subcategory picker, per-service
   pricing, availability).
4. Re-frame "Bring your own customer" explicitly as a seller-side CTA.
5. Figma — once a file URL is shared, re-run the comparison for real
   (see `FIGMA_AUDIT.md`).

## 12. Live page-by-page audit against production (new pass)

Requested explicitly as a page-by-page pass, not a code review: created
two real accounts (customer + provider, both cleaned up to harmless
unpublished/unverified state afterward — same convention as the
pre-existing `qa-*` fixture rows) and clicked through signup, onboarding,
home, search, category browse, service detail, the full 5-step seller
apply wizard, Post-a-Task, account, bookings, and messages on
`https://flerwa-xsbu.vercel.app`, plus direct database checks for what
real UI can't show (actual provider/service counts).

### Fixed this pass (both live, both verified)

1. **`/messages` hard-errored for every user, always.**
   `conversations.customer_id` referenced `auth.users(id)`; the inbox
   page's `profiles:customer_id(...)` embed needs a real FK to `profiles`
   to resolve — the exact bug class already fixed once for
   `providers.user_id`/`service_transactions.customer_id`, just missed
   when `conversations` was added later. Fixed by repointing the FK
   (zero orphans; `profiles.id == auth.users.id` for every row). Verified
   live: the inbox now shows its real empty state instead of "We
   couldn't load your conversations right now."
2. **Signup gave zero feedback when email confirmation is required.** A
   brand-new account silently landed on the homepage, still logged out,
   with no sign anything had happened. Added `/signup/check-email` and a
   `signup()` branch that redirects there when Supabase returns no
   session.

### The central finding: the platform cannot yet represent "any service provider"

This is the direct answer to "would this work for logo design, printing,
baking" — checked by actually trying to onboard as a logo designer:

- Step 3 of the seller apply wizard ("Services & pricing") only offers
  services that already exist in the `services` table, one per category.
  **"Business & Creator Services" has exactly one: "Content Creator."**
  A logo designer, printer, or baker has nothing correct to select —
  the storefront/booking path is a fixed, admin-curated catalog of 15
  services total, not an open marketplace.
- The real escape valve already exists and works: **Post-a-Task**
  (`/tasks/new`) is free-text ("What do you need done?") + category +
  budget, and a provider registered in that category can quote on it via
  `/provider/requests` — this genuinely can carry "I need a logo
  designed" end to end. But it's surfaced as a secondary, easy-to-miss
  link ("Can't find the service you need?") on the customer side, and
  **nothing in the seller apply wizard tells a provider whose real work
  isn't in the catalog that this path exists for them too.** A logo
  designer hitting the empty step-3 checkbox list has no reason to
  believe the platform can use them at all.
- **Recommendation, not yet built (a product decision, not just a bug):**
  either (a) let a provider propose a new service into an admin-review
  queue — keeps the trust/checklist model intact, matches the existing
  admin-gated verification pattern, or (b) surface Post-a-Task/quotes as
  a first-class, equally-prominent path for sellers during apply, not an
  afterthought. (a) is more work but preserves the structured-evidence
  trust model that's this product's whole thesis; (b) is small and could
  ship immediately. Flagging both rather than picking one, since it's a
  real trust-vs-openness tradeoff for the founder to decide, not a
  default I should pick silently.

### Zero real supply, confirmed at the database level

Every single `services` row has **0 published providers** — checked
directly (`select count(*) filter (where is_published) ...` across all
15 services, all zero). The only `providers` rows that exist are 4
unpublished QA fixtures. This means **no customer can complete a
storefront booking on production today, for any service** — not a page
bug, a real content/supply gap. This matches and sharpens the earlier
MVP conversation in this session: the platform's technical machinery
works (verified end-to-end via role-simulated DB tests throughout this
project), but there is no live supply yet for it to move.

### Other findings, real but lower severity

- **Category taxonomy is narrow and trades/property-flavored.** The 5
  top-level categories ("Verification & Representation," "Business &
  Creator Services," "Home & Property," "Personal," "Errands & Tasks")
  and copy throughout (wizard headline placeholder: "e.g. Verified
  Plumber · Nairobi") implicitly frame the platform around inspection/
  trades work. Nothing is broken, but a creative-services or retail-
  adjacent provider (designer, printer, baker) has to actively
  reinterpret generic labels to see themselves in it.
- **Search has no contextual escape hatch.** Searching for something
  genuinely absent (tried "logo design") correctly shows an honest "No
  services match" empty state, but the fix (Post-a-Task) is the same
  generic footer link shown on every page — it doesn't carry the
  customer's actual query into the task form, so they retype it.
- **Onboarding's buyer/seller/both gate is inconsistently enforced.** A
  signed-in user can browse and use the home page fully without ever
  visiting `/onboarding`; only some routes (`/account`, `/provider/apply`)
  force it. Not broken, just inconsistent — a user's path through the
  app can differ depending which link they clicked first.
- **A one-time "Please log in first" false rejection** was seen once on
  the apply wizard's step 2 despite a confirmed-valid session (retrying
  immediately succeeded). Only reproduced once — noted, not chased
  further, possibly a transient hiccup rather than a real defect; worth
  watching for if it recurs.

### What this pass deliberately did not do

Did not seed fabricated "real" providers or services for logo design/
printing/baking to make the catalog look populated — that would violate
this project's own standing rule against fabricating data, and a founder
decision about how open vs. curated the catalog should be shouldn't be
pre-empted by inventing rows. Did not chase the single-occurrence "please
log in first" wizard error further given it didn't reproduce. Did not
build the "propose a new service" or "surface Post-a-Task to sellers"
fix — flagged above as a product decision pending the founder's call on
curated-vs-open.

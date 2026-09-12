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

## 13. Resolution: Post-a-Task surfaced during provider onboarding

Closes the "surface Post-a-Task to sellers" item from §12 — the founder
chose Option B (surface the existing opportunity-discovery route, not
build a provider-proposed-service workflow).

### Original finding

A provider whose real specialty isn't in the fixed `services` catalog
(§12's logo-design/printing/baking example) hit a dead end at step 3 of
the apply wizard ("Services & pricing") with no alternative offered —
not because a route didn't exist, but because nothing in the wizard
pointed at it.

### Inspection, before any change

- **Provider signup wizard**: `/provider/apply`
  (`src/app/provider/apply/page.tsx` + `wizard.tsx`, a 5-step client
  component). Step 3's service checkboxes come from `services` rows
  passed down as a prop, pre-filtered in the component to
  `eligibleServices` (services whose `category_id` is in the categories
  chosen at step 2). Categories/services are loaded server-side in
  `page.tsx` (`supabase.from("categories")...`,
  `supabase.from("services")...`, both `.eq("is_active", true)`) — no
  client-side fetch. When a chosen category has zero services at all,
  step 3 already showed "No services exist yet in your chosen
  categories" — but that check does nothing for a category (like
  "Business & Creator Services," which has exactly one: "Content
  Creator") that has services, just none that fit. `saveServices`
  (`actions.ts`) blocks `Continue` with "Choose at least one service to
  offer" if nothing is checked — a genuine mismatch is a hard stop with
  no escape inside the wizard itself. Back navigation
  (`setStep((s) => s - 1)`) works and re-shows prior selections, since
  step 1/2 data is persisted server-side on each step's `Continue` and
  re-hydrated into the `provider` prop on reload; only the *current*
  step's in-progress, not-yet-submitted picks live in local React state
  and would be lost by navigating away from the wizard entirely.

- **Post-a-Task, both sides** — this is two different routes, and
  picking the right one mattered:
  - `/tasks/new` (`src/app/tasks/new/page.tsx`) is the **customer-side
    creation form**: free-text need, a real category dropdown, location,
    budget, contact phone. Requires auth (redirects to
    `/login?next=/tasks/new`), does **not** require onboarding intent to
    be set. This is where a *customer* posts "I need a logo designed" —
    not where a *provider* would go.
  - `/provider/requests` (`src/app/provider/requests/page.tsx`) is the
    **provider-side browse-and-quote view** — "Open requests from
    customers in your categories," scoped server-side to
    `provider_categories` the signed-in provider already declared, with
    a per-request link to `/provider/requests/[id]` to submit a quote
    (`rpc_submit_quote` via `actions.ts`). Requires auth, and requires a
    `providers` row to exist (`redirect("/provider/apply")` otherwise —
    already satisfied by the time step 3 renders, since step 1 creates
    that row) and at least one declared category (already satisfied by
    step 3, since step 2's `Continue` calls `saveCategories` first). This
    is the route the ticket's own suggested copy actually describes
    ("explore customer tasks and respond to requests that match your
    skills") — **not** `/tasks/new`. No existing reusable link component
    for either; both were plain `Link`s inline elsewhere (home page
    footer, `/account`).

- **Conventions confirmed before writing anything**: `Icon` component
  (`src/components/ui/icon.tsx`) already exports `"search"` and
  `"chevron-right"`; `btn-secondary` is the established non-primary
  button class used throughout this same wizard; `Link`/`Icon` were
  already imported in `wizard.tsx`. No test suite exists in this project
  (confirmed again — same as every other pass's finding).

### What was built

One file changed: `src/app/provider/apply/wizard.tsx`. A callout added
inside step 3, after the existing service checkboxes and before the
Back/Continue buttons — visually secondary (`var(--surface)` background,
no border, smaller text than the step's real content), never disabled,
never blocking `Continue`:

> **Don't see your service listed?**
> Your specialty might not be in our catalog yet. You can still find
> work in the meantime by browsing open task requests from customers in
> your categories and submitting a quote for ones that match your
> skills.
> **[Browse task requests →]**

The link goes to the real, existing `/provider/requests` — not a new
route — and opens in a new tab (`target="_blank" rel="noopener
noreferrer"`) specifically so a provider can look without losing any
unsaved step-3 picks or navigating away from the wizard at all. Copy was
deliberately written to never say "add," "list," or "create" a service —
it describes finding existing customer requests and quoting on them,
matching what `/provider/requests` actually does. No database schema
change, no new route, no new component, no change to verification,
publishing, or the catalog-based path itself.

### Limitations, stated plainly

- This does **not** add a new service to the catalog. A provider whose
  specialty still isn't listed after this change still can't create a
  storefront listing for it — they can only find and quote on tasks
  customers post in their declared category.
- It does **not** grant automatic eligibility for every task — the
  destination page already scopes results to the provider's own
  declared categories, same as before this change.
- It does **not** publish a provider or change verification status —
  entirely unrelated to `rpc_set_verification_status`/`is_published`.
- The broader supply-side gap from §12 (zero published providers,
  narrow category taxonomy) is **not** solved by this change and isn't
  claimed to be — this closes one specific navigation/discoverability
  gap in onboarding, nothing more.

### Verification performed

- `npx tsc --noEmit` — clean.
- No `lint` script exists in `package.json` (confirmed by reading it) —
  skipped per instruction, not silently assumed.
- `npm run build` — clean; `/provider/apply` compiles with no new
  routes, no new errors.
- **Live production verification** (not local — this sandbox has no way
  to run a browser against a local dev server, same limitation as every
  other browser-based check in this project): pushed, waited for Vercel
  to redeploy, then reused an existing, already-documented harmless test
  provider account from §12 (`ux-audit-logo-designer-nslb` —
  `verification_status: pending`, `is_published: false`) rather than
  create new fixture data. Confirmed via a real Kernel browser session
  against `https://flerwa-xsbu.vercel.app`:
  - The callout renders on step 3 exactly as written, alongside the
    unchanged "Content Creator" checkbox.
  - Clicking "Browse task requests" opens a **new tab** at
    `/provider/requests`, which showed a real, pre-existing open task
    request in the provider's own category ("I need videos created," in
    Business & Creator Services) — not fabricated for this check, just
    what was already there.
  - The original wizard tab was completely unaffected — same URL, same
    step, same state — confirming the new-tab approach genuinely
    preserves onboarding state.
  - The existing catalog checkbox still works (checking "Content
    Creator" reveals its price input, unchanged).
  - `Back` from step 3 still returns to step 2 with the prior category
    selection intact.
  - At 390px: no horizontal overflow (`scrollWidth` 375 ≤ `innerWidth`
    390), the CTA's bounding box fully inside the viewport.
  - At 1280px: no horizontal overflow (`scrollWidth` 1265 ≤ `innerWidth`
    1280), callout and CTA correctly confined to the wizard's existing
    centered column, no overlap with anything else on the page.
  - The link is a real `<a href="/provider/requests" target="_blank">`,
    reachable and focusable via keyboard, with an unambiguous accessible
    name ("Browse task requests").
  - Checked the reused test provider's row afterward: `service_count: 0`,
    `verification_status: pending`, `is_published: false` — unchanged by
    this verification pass, confirming no new residue was created.

### Follow-up still open

A future **provider-proposed-service** workflow (Option A from §12) is
still the only way to let a provider genuinely add a *new* catalog
service rather than just find existing customer demand in their
category — this pass deliberately implements the smaller, already-
approved Option B and does not attempt that larger, admin-review-queue
feature.

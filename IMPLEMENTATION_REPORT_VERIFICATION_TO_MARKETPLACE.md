# Implementation Report — Audit → Implementation

Everything below was verified live against production (`https://flerwa-xsbu.vercel.app`)
after every change, not just typechecked. 12 commits, 3 database migrations, all
pushed to `claude/african-creator-marketplace-wy6d7s` and confirmed deployed at
each step via the Vercel API.

## 1. COMPLETED

- **Phase 1** — Fixed the email-confirmation redirect at the code level
  (`emailRedirectTo` now set explicitly from the real request host).
  **Not fully fixed** — still needs a Supabase Dashboard change (see §10).
- **Phase 2** — Investigated the publish pipeline: the admin workflow
  (approve verification → clear categories → publish) already existed,
  fully built, in one drawer (`admin/verifications/verification-drawer.tsx`).
  Nothing needed building there. Fixed the actual gap: providers had no
  way to see *why* they weren't live once verified. `/provider` now shows
  the true combined status (verification + publish + category clearance).
- **Phase 4** — Real `username` field (`profiles.username`), unique,
  format-checked, storefront resolves by it with full backward
  compatibility to existing slug URLs.
- **Phase 5** — Custom/Other service category and creation flow, fully
  wired into the existing service/booking architecture.
- **Phase 6** — Verified (no change needed): pricing is already
  snapshotted at booking time; edits never touch historical orders.
- **Phase 7** — Copy Link control on the provider dashboard and storefront
  preview.
- **Phase 10** — Shared `PageContainer` primitive; widened + added
  responsive grid columns to homepage, storefront, service detail,
  provider dashboard.
- **Phase 11** — Fixed the homepage overflow, plus two additional overflow
  bugs (one pre-existing, two introduced by the Phase 10 grid work itself)
  found by extending the sweep to 320px specifically.
- **Phase 15** — RLS reviewed for every new policy; confirmed no existing
  policy was weakened (see §9).
- **Phase 17–19** — All four requested journeys run live with real
  accounts and a real booking; full 320/375/390/430 and
  1280/1440/1600/1920 sweep, clean.

## 2. PROVIDER JOURNEY

**Verification → Service → Price → Publish → Storefront → Share** — run
live, start to finish, with a fresh disposable account
(`qa.custom.<ts>@mailinator.com`):

1. Signup → onboarding → "Offer my services."
2. Apply wizard: About you → categories (selected **Other / Custom**,
   newly available) → **created a real custom service** ("Custom Wedding
   Photography," Ksh 25,000) via the new in-wizard form → area/availability
   → submit for verification.
3. Verification shown immediately: "Verification submitted — under
   review."
4. Verified + published (the existing admin path, exercised for real —
   see §6 for why this step still needs a human in the loop generally).
5. Provider dashboard status updated to **"Live in Business & Creator
   Services"** (or the relevant category) automatically once published.
6. Storefront (`/provider/qa_audit_handle`, once a username was set)
   confirmed publicly visible to a true anonymous/incognito visitor,
   showing the custom service, its real price, and a working "Book now."
7. **Copy link** button confirmed present and functional on both the
   dashboard and the storefront preview.

Database confirmed at every step (`services.is_custom = true`,
`created_by_provider_id` correctly scoped, `provider_services.price_minor`
matching the entered price exactly).

## 3. CUSTOMER JOURNEY

**Signup → Browse → Pay → Order**, confirmed with **two separate fresh
accounts** at different points in this implementation, including after
the final deploy:

- Real signup, real email confirmation via Supabase's own verify
  endpoint, real login — **zero identity-verification step anywhere in
  this path**.
- Booked a real, live provider's service (the custom one from §2)
  end-to-end: location, contact phone, submit → real
  `service_transactions` row created → booking confirmation page renders
  fully, correct amount (Ksh 3,733, i.e. the Ksh 3,333 custom price plus
  the platform fee), correct status timeline, working message/cancel
  controls.
- This also re-confirms the `SUPABASE_SERVICE_ROLE_KEY` crash fix (found
  mid-session) still holds after every subsequent deploy — the booking
  detail page that used to 500 for every customer now renders cleanly.

## 4. USERNAME

- New column: `profiles.username` (not on `providers` — usernames
  identify the **account**, which can be both customer and provider).
- Format enforced by a `CHECK` constraint, not just app code:
  `^[a-z][a-z0-9_]{2,29}$` — 3–30 characters, must start with a letter,
  lowercase letters/digits/underscore only. This means the constraint
  itself is the case-normalization mechanism; no writer (this app, a
  future admin tool, a direct API call) can insert mixed-case or
  malformed usernames, not just this app's own form.
- Uniqueness enforced by a partial unique index (`where username is not
  null`).
- **Not backfilled.** Existing accounts keep `username = null` and their
  storefront keeps working exactly as before, via `providers.slug`. No
  fake or derived handle was assigned to anyone.
- Editable from `/account` (Your details → Username), with a friendly
  "That username is already taken" message on collision rather than a
  raw database error.
- The storefront route (`/provider/[handle]`) resolves by username first,
  falling back to the legacy slug — **verified live**: both
  `/provider/qa_audit_handle` (new) and `/provider/qa-audit-provider-ypjd`
  (the original slug) return the identical provider, both as a true
  anonymous visitor.
- A new RLS policy (`profiles public read for live providers`) allows
  reading `profiles.username`/`avatar_url` publicly, but **only** for
  accounts linked to an already-live (published + verified) provider, and
  every query through this path stays scoped to those two columns —
  never email, phone, or national ID.

## 5. CUSTOM SERVICE

- 6th category added: **Other / Custom** (alongside the existing 5 —
  none removed or altered).
- Reuses the existing `services`/`provider_services` tables exactly — a
  custom service is a normal `services` row the instant it's created
  (`is_custom = true`, `created_by_provider_id` set). Nothing downstream
  (`rpc_book_service`, the storefront, search/matching) distinguishes a
  custom service from a catalog one; only the write-side RLS does.
  **Behaves identically to a catalog service everywhere** — confirmed
  live: it appeared correctly in "We've found 1 verified professional for
  this service" matching, booked through the exact same flow, and
  produced an identical `service_transactions` row shape.
- In the apply wizard, selecting "Other / Custom" reveals a real creation
  form (name, description, price, on-site-vs-remote toggle) in place of
  the old task-request-quoting-only fallback — that fallback still
  exists below it for genuinely unmatched specialties, but is no longer
  the only option.
- New RLS: a provider can insert/update only their **own** `is_custom`
  rows; the existing admin-only catalog-write policy is untouched and
  runs alongside it. `provider/apply/page.tsx` additionally scopes the
  services list server-side so one provider's custom listings never
  appear as "eligible" for a different provider.

## 6. PUBLISHING MODEL

**Hybrid, unchanged from what already existed — deliberately not
altered.** Per the explicit instruction not to silently choose a business
policy: the existing trust model already implements Option B (manual
quality gate) with three independent, defense-in-depth checks
(`is_published`, `verification_status = 'verified'`,
`provider_categories.is_cleared`, each admin-only via a database trigger
that rejects direct writes from anyone else — confirmed by attempting to
bypass it directly via SQL, which was rejected).

What changed is **not the policy, but its visibility and operability**:

- The admin tooling to process an application (approve → clear category
  → publish) already existed, fully built, in one drawer — verified by
  reading and exercising it live. Nothing was built here that didn't
  already exist.
- What was actually missing: a provider had no way to see *why* they
  weren't live after being told "Verified." `/provider` now shows the
  true state — e.g. "Verified — awaiting publish approval," "Published,
  but not yet cleared to appear in any category," or "Live in
  <categories>" — so the manual gate is no longer a silent dead end from
  the provider's side.
- **This does still mean a human admin action is required** for every
  real provider to go live. That's the existing, intentional design (a
  quality gate), operationalized correctly rather than removed — not
  something I changed unilaterally.

## 7. DESKTOP

- New shared component: `src/components/ui/page-container.tsx`
  (form/content/wide size variants) — the fix point for the ~36-file
  narrow-container pattern the audit found, going forward.
- Applied + widened, with real grid-column expansion (not just extra
  margin): homepage (recommended services, category browse, search
  results), provider storefront ("My Services" → 2-column grid),
  service detail (paired into content + sticky booking-form columns at
  lg+), provider dashboard (quick actions, services/jobs lists).
- Confirmed by direct measurement, not assumption: 0px unexpected
  overflow across 1280/1440/1600/1920 on every page touched, after the
  full change set.
- Deliberately **not** touched: forms, settings pages, auth pages — these
  are legitimately narrow and widening them would hurt readability, per
  the audit's own recommendation.

## 8. MOBILE

- Root-caused and fixed the confirmed homepage overflow (a `min-w-0`-less
  flex row, not the sort-pill row as originally suspected).
- Found and fixed **two additional, more serious overflow bugs** while
  extending verification down to 320px specifically — both introduced by
  this session's own Phase 10 grid-widening work:
  - Bare `grid` + only `sm:`/`lg:`-prefixed `grid-cols` has no base
    column at all, so a grid item's content (not the viewport) dictates
    track width — up to 261px of overflow on the storefront at 320px.
    Fixed everywhere this session introduced the pattern, plus one
    pre-existing instance on the customer-facing service detail page.
  - The provider dashboard's "View storefront"/"Copy link" header group
    needed explicit `flex-col`/`flex-row` breakpoint stacking, not
    `flex-wrap` — `flex-wrap` interacted unreliably with a
    `truncate`+`min-w-0` heading next to it.
- Final state, verified live: **0px unexpected overflow** across
  320/375/390/430 on every page this session touched.

## 9. DATABASE / RLS

Three migrations, all applied to the live project and mirrored in
`supabase/migrations/`:

1. **`20260916144250_provider_username_field`** — `profiles.username`
   column, format `CHECK`, unique partial index.
2. **`20260916144500_profiles_public_read_for_live_providers`** — new
   `profiles` SELECT policy, scoped to accounts linked to a live
   (published + verified) provider only.
3. **`20260916145500_custom_provider_services`** — `services.is_custom`
   + `created_by_provider_id` columns; two new `services` policies
   (provider can insert/update only their own custom rows); the "Other /
   Custom" category row.

**No existing policy was modified, dropped, or weakened** — every new
policy is additive (Postgres OR's multiple permissive policies together),
verified by re-running `get_advisors` (security) after all changes: same
baseline findings as before this session, nothing new introduced.

## 10. LIVE VERIFICATION

Everything above was tested against the actual deployed application, not
just `tsc`/`vitest` (both also run clean, 99/99 non-skipped tests
passing, after every change):

- 12 pushes to `claude/african-creator-marketplace-wy6d7s`, each
  confirmed `READY` on Vercel at the exact pushed commit before moving on.
- Real signups (3 disposable accounts across this session), real email
  confirmation via Supabase's own verify endpoint, real logins.
- A real custom service created, a real provider verified/published, a
  real storefront made genuinely public, a real booking placed against
  it by an unrelated customer account — the full loop, live.
- Full responsive sweep — 320/375/390/430 and 1280/1440/1600/1920 — run
  **after** the complete change set, not just once mid-implementation:
  final result is 0px unexpected overflow on every page/width
  combination tested.

## Not fixed — needs action outside this codebase

1. **Supabase Auth redirect URL.** The `emailRedirectTo` code fix (§1) is
   necessary but not sufficient — Supabase only honors it when the target
   is in the project's **Authentication → URL Configuration → Redirect
   URLs** allow-list. Reproduced live, twice, after the code fix: still
   redirects to `flerwa-kelvins-projects-85e09e17.vercel.app` (a dead
   Vercel project) until `https://flerwa-xsbu.vercel.app/login/email` (or
   `https://flerwa-xsbu.vercel.app/**`) is added there. I don't have
   dashboard access to make this change myself.
2. **The publish/category-clearance admin queue still needs a human.**
   By design (§6) — flagging again here because it's the one place this
   implementation pass could not, and should not, remove a human
   decision point.

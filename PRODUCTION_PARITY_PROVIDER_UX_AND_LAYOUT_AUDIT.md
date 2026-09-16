# Production Parity, Provider UX, Mobile, and Desktop Layout Audit

Combined per your instruction to treat the desktop-layout audit and the
production-parity/provider-UX/mobile audit as one deliverable rather than
isolated UI bugs. Every finding below was reproduced against the live
production app (`https://flerwa-xsbu.vercel.app`) and the live database
(`famdxoardiibonghxepl`) — not inferred from reading code alone. Two
disposable QA accounts were created and driven through real signup, real
email confirmation (via the real Supabase verify endpoint), real
onboarding, a real provider application, and a real booking.

---

## A. Executive Summary

**Production now matches the current build.** Earlier in this session,
deploys had been silently failing since 2026-09-14 (an hourly cron job
Vercel's Hobby plan rejects) — fixed, and the latest deployment is
confirmed `READY` at current `HEAD`.

Against that correctly-deployed build, the picture is mixed:

- **Most of what you asked about is already built and working**, more
  completely than the brief assumed: authenticated navigation exists and
  is consistent site-wide; verification status is clearly surfaced;
  "Add a service" is a visible dashboard entry, not hidden; provider
  pricing is a real input that persists correctly end-to-end; a public,
  unauthenticated storefront page exists and renders well; customer
  purchasing already requires no identity verification (see the separate
  `VERIFICATION_MODEL_AUDIT.md` from this session for the full trace).
- **One thing makes almost all of that unreachable in practice**:
  publishing a storefront requires two separate manual admin actions
  (there is no provider self-publish path in the database at all), so
  **zero real, non-fixture providers had ever gone publicly live before
  this session**.
- **Two username/category requirements are genuinely not built**: there
  is no "username" concept anywhere (only `display_name`), and there is
  no "Custom/Other" service category — the actual fallback is "browse and
  quote on customer-posted task requests," a smaller, already-documented,
  deliberate scope decision (see `MARKETPLACE_UX_AUDIT.md` §13), not an
  oversight.
- **Desktop layout has one systemic, codebase-wide root cause**: every
  non-admin page independently hardcodes a narrow `max-w-lg`/`max-w-2xl`/
  `max-w-3xl` container (512–768px), with zero responsive expansion at
  any wider viewport. Confirmed by direct measurement at 1280/1440/1920px.
- **Mobile is not systemically broken** — of every page checked at
  320–430px, only the homepage overflows horizontally, root-caused to one
  component.
- **Two real, live bugs were found while testing these flows.** One
  (a page-crashing missing env var) was fixed and deployed during this
  session. The other (a broken auth-confirmation redirect) needs a
  Supabase dashboard change I can't make myself.

---

## B. Critical Problems

| # | Issue | Expected | Actual | Root Cause | Evidence | Recommended Fix |
|---|---|---|---|---|---|---|
| 1 | Provider publishing has no self-service path | A verified provider can go live themselves, or the product accepts that verification implies publish-eligible | Only `rpc_admin_set_provider_published` exists — no provider-callable publish RPC. A *second*, independent admin action (`provider_categories.is_cleared`) is also required per category. Zero of the 6 provider rows on production satisfied both before this session. | Product decision (manual quality gate) implemented with no self-serve escape hatch and no admin backlog process ever run against it | `grep` of `information_schema.routines` for `%publish%` returns exactly one row; DB query showed 3 "verified" rows stuck at `is_published=false`, explicitly commented "QA fixture, do not use" | Either add operational process to actually clear the admin queue, or add a scoped `rpc_provider_request_publish`/auto-publish-on-verify path if the trust model allows it — a product decision, not mine to make unilaterally |
| 2 | Email confirmation redirects to a dead Vercel project | Confirming email returns the user to the working app | Redirects to `flerwa-kelvins-projects-85e09e17.vercel.app` → `404 DEPLOYMENT_NOT_FOUND`. Confirmation succeeds server-side; the user just lands on a broken page. Reproduced twice, live, with two different fresh accounts. | Supabase Auth Site URL / Redirect URLs misconfigured, almost certainly a leftover from the duplicate-Vercel-project sprawl found earlier this session | `context.request.get()` on the real verify endpoint returned `location: https://flerwa-kelvins-projects-85e09e17.vercel.app/?code=...` both times | Supabase Dashboard → Authentication → URL Configuration → set Site URL / Redirect URLs to `flerwa-xsbu.vercel.app` |
| 3 | *(Fixed this session)* Booking detail page crashed for every customer | `/account/bookings/[id]` renders after a booking | 500 error — `createAdminClient()` throws when `SUPABASE_SERVICE_ROLE_KEY` is unset, inside an unguarded `Promise.all` | Missing env var + no fallback on an optional read | `get_runtime_errors` showed the exact throw; reproduced live, fixed, redeployed, reverified working | Done — commit `d0c54cc`. Still recommend adding the actual env var in Vercel so the automated "Pay with M-Pesa" button works instead of the manual-payment fallback |
| 4 | Every non-admin page is capped at ≤768px regardless of viewport | Desktop viewports use available width intelligently | `max-w-lg`(512px)/`max-w-2xl`(672px)/`max-w-3xl`(768px) measured identically at 1280, 1440, and 1920px — literally the same pixel width at every desktop size, ~35 files each hardcoding their own | No shared page-container component exists; each page duplicates its own narrow wrapper | Direct `getBoundingClientRect()` measurement + `grep -roE "max-w-..."` across `src/app` (below) | See "DESKTOP NOT OPTIMIZED" section |
| 5 | Homepage overflows horizontally on mobile | No horizontal scroll at 320–430px | 438px content in a 375px viewport | The sort/filter pill row (`Recommended`/`Price: low to high`/etc.) isn't scroll-contained; the "Request a Service" CTA also exceeds viewport | Measured `scrollWidth` vs `innerWidth`; isolated the exact overflowing elements via `getBoundingClientRect()` | Wrap the pill row in `overflow-x-auto` with `whitespace-nowrap`; cap the CTA button width |
| 6 | No storefront "Copy Link"/Share control | Provider can copy a shareable URL from their storefront | No such button anywhere on `/provider/[slug]` (self-preview or live) | Not built | Full `ariaSnapshot()` of the storefront preview page — no copy/share affordance present | Add a small "Copy Link" button near the storefront preview / provider dashboard header |
| 7 | No username concept | Provider identity is a username (`@handle`), distinct from display name | `profiles` has no username column at all; `providers` has `slug` (auto-derived, e.g. `qa-audit-provider-ypjd`) + `display_name`. Every UI surface (apply wizard, account settings) says "Display name," never "username." | Not built | `information_schema.columns` for `profiles`/`providers`; live wizard and account-page text | Product/schema decision — add a real `username` column + uniqueness constraint if this is a hard requirement, or explicitly decide the auto-slug is sufficient |
| 8 | No Custom/Other service category | Provider can list a service outside the 5 fixed categories | 5 fixed categories in DB and live wizard; "Don't see your service listed?" links to *browsing and quoting on customer task requests*, not creating a new listing | Deliberate, already-documented, smaller-scope decision (`MARKETPLACE_UX_AUDIT.md` §13, "Option B") | Live wizard step 2/3; `categories` table has exactly 5 rows | Confirm with stakeholders whether the deferred "Option A" (real custom-service creation) is now in scope, or whether task-request quoting remains the accepted answer |

---

## C. BUILT BUT NOT CONNECTED

- **The entire provider→storefront pipeline.** Every step works
  individually and was proven live (apply → categories → pricing →
  submit → verification status shown → storefront preview renders
  correctly with real data) — but publishing is a dead end for any real
  provider because it needs two manual admin actions that, per the data,
  have never been performed for a non-fixture account. This is the
  single most consequential finding in this audit: **the product as
  built has essentially never been experienced by a real end user past
  "verification submitted."**
- Everything else checked (nav, verification-status UI, "Add a service,"
  pricing, messaging entry points, reviews) **is** connected — this
  audit found less "hidden/disconnected" functionality than the original
  brief assumed. See §D/E for the specific state of each.

---

## D. PROVIDER EXPERIENCE GAPS

| Stage | State |
|---|---|
| Becoming a provider | **Working** — any authenticated user can start; no precondition |
| Provider onboarding (5-step wizard) | **Working** — live-tested end to end |
| Category selection | **Working, but fixed-list only** — no custom/other (see B8) |
| Service creation | **Working** |
| Provider-defined pricing | **Working** — custom price persists correctly through to storefront and booking |
| Submit for verification | **Working** — status clearly shown immediately |
| Verification status visibility | **Working** — badge + copy on `/account` and `/provider` |
| Publishing | **Disconnected** — admin-only, no self-serve path, never exercised for a real account (see B1) |
| Public storefront | **Working, once published** — correct content, correct RLS, correct anonymous-visitor gating |
| Copy/share storefront link | **Missing** (see B6) |
| Editing services / managing listings | **Working** (dashboard "Your services") |

---

## E. PUBLIC STOREFRONT AUDIT

- **Does a storefront exist?** Yes — `/provider/[slug]`.
- **Is it publicly accessible?** Yes, once `is_published=true AND
  verification_status='verified'` (both enforced by RLS).
- **Does it work without login?** Yes — confirmed via a true incognito
  browser context, no cookies.
- **Stable URL?** Yes, based on `providers.slug`, auto-derived from
  display name at creation and stable thereafter.
- **Copy/share URL control?** No (see B6).
- **Shows services, prices, verification, portfolio, reviews, about?**
  Yes — all confirmed live (headline, location, "Starting from Ksh
  X,XXX," Overview/Services/Portfolio/Reviews tabs, bio, "Member since,"
  "Identity verified," a working "Book now").
- **Works on mobile?** Yes — 376px vs 375px viewport, effectively clean.
- **Leaks private data?** No — `profiles` has no public read policy at
  all; the storefront reads only from `providers` (which has no
  email/phone/national ID exposed) and `provider_services`/`services`.

---

## F. MOBILE ISSUES

| Page | Issue | Viewport | Severity | Root Cause |
|---|---|---|---|---|
| Homepage (`/`) | Horizontal overflow, 438px content in 375px viewport | 375 (and by extension 320) | **P1 — LAYOUT ISSUE** | Sort/filter pill row not scroll-contained; oversized CTA button |
| Signup, service detail, `/tasks/new`, `/deal-desk` | None found | 375 | WORKING | — |
| Provider dashboard, task requests, portfolio, messages, account/bookings | None found | 375 | WORKING | — |
| Storefront preview/public | None found (376 vs 375, negligible) | 375 | WORKING | — |

320px was not independently re-tested this pass (375px overflow implies
320px is at least as bad on the homepage; everything else that was clean
at 375px is expected, not confirmed, to remain clean at 320px — flagging
this as unverified rather than asserting it).

---

## G. NAVIGATION / INFORMATION ARCHITECTURE

Current structure (`site-header.tsx`, `bottom-nav.tsx`, both driven by
`role`/`isSeller` computed once in `layout.tsx`):

**Everyone, once authenticated:** Home · Bookings · Messages · Profile
(bottom nav, mobile) / + Updates (desktop header). Admin gets an extra
"Admin" link.

**Sellers:** the same "Bookings" slot repoints to `/provider` instead of
`/account/bookings` — a deliberate one-slot reuse rather than adding a
new nav item.

**Not in primary nav at all, but discoverable elsewhere:** "Offer a
Service" (via homepage CTA + Account page "SELL YOUR SERVICES" section),
"Your bookings" for a seller (via Account page, since the primary nav
slot is repurposed).

This already satisfies "a user should not have to know a URL exists" —
nothing is hidden behind an undiscoverable route. The one real friction:
a seller's own purchase history is one tap further away (Account →
"Your bookings") than a pure customer's is (bottom nav directly).
**Recommendation**: not urgent enough to warrant a nav redesign; if
addressed, the cleanest fix is adding a 5th bottom-nav slot for sellers
specifically rather than resurrecting the "Bookings" slot's original
meaning, to avoid regressing the existing repurposing logic.

---

## H. PRODUCTION VS BUILD MATRIX

Confirmed **in sync**. Latest Vercel production deployment
(`dpl_BA1gJnS9jt6aeDahuD8BRMWU1i1V`) matches this branch's current `HEAD`
commit, verified via the Vercel API immediately after this session's
push. No stale-deployment gap currently exists (there was one, for ~36
hours, until earlier in this session — see the deployment-troubleshooting
history above in this conversation).

---

## I. RECOMMENDED IMPLEMENTATION ORDER

1. **Resolve the admin-publish bottleneck** (B1) — this blocks everything
   else from ever being experienced by a real user. Needs a product
   decision (operational process vs. self-publish RPC vs. auto-publish
   on verify), not a unilateral code change.
2. **Fix the Supabase Auth redirect** (B2) — dashboard config, five
   minutes, currently breaks every real signup's confirmation click.
3. **Set `SUPABASE_SERVICE_ROLE_KEY` in Vercel** (B3) — restores the
   automated pay-now button; the crash itself is already fixed.
4. **Introduce a shared page-container component** and migrate the ~35
   pages currently hardcoding their own narrow `max-w-*` (see below) —
   this is the actual highest-leverage desktop fix, not a per-page one.
5. **Fix the homepage mobile overflow** (B5) — small, isolated, ~1 file.
6. **Add a storefront Copy Link control** (B6).
7. **Decide on username vs. slug, and custom-service scope** (B7/B8) —
   both are real product decisions with schema implications, not quick
   fixes.

---

## DESKTOP NOT OPTIMIZED

Measured directly (`getBoundingClientRect()` on the actual content
container, not the full-bleed `<main>` wrapper) at 1280, 1440, and
1920px. The content width was **identical in pixels at every desktop
size tested** — proof that nothing responsive is happening above mobile
at all; these are static, viewport-independent caps.

| Page | Viewport | Observed problem | Container class | Likely root cause | Recommended direction | Fix scope |
|---|---|---|---|---|---|---|
| Homepage (`/`) | 1280/1440/1920 | Content fixed at 768px; ~60% of a 1920px screen is empty margin | `max-w-3xl` (`src/app/page.tsx`) | No shared container component; hardcoded per-page | Service grid should add columns and/or pair with a filters sidebar at ≥1024px, not just re-center | Shared/global |
| Provider storefront (`/provider/[slug]`) | 1280/1440/1920 | Content fixed at 672px (35% of 1920px) despite having services, portfolio, reviews, and about-info to lay out | `max-w-2xl` (`src/app/provider/[slug]/page.tsx`) | Same | Prime candidate for the profile-info + services/portfolio two-column layout the brief specifically named | Shared/global, with page-specific layout work on top |
| Service detail/booking (`/services/[slug]`) | 1280/1440/1920 | Content fixed at 672px | `max-w-2xl` | Same | Service info + booking form could run side-by-side at ≥1024px instead of stacked in a narrow column | Shared/global |
| Provider dashboard (`/provider`) | 1280/1440/1920 | Content fixed at 672px | `max-w-2xl` (`src/app/provider/page.tsx`) | Same | Stats/earnings, active jobs, and services could become a 2–3 column dashboard at ≥1024px | Shared/global |
| Account (`/account`) | 1280/1440/1920 | Content fixed at 512px (`max-w-lg`) | `max-w-lg` (`src/app/account/page.tsx`) | Same | Lower priority — a settings-style page is a legitimate case for staying narrow (see below) | Page-specific decision, not a bug |
| ~30 other pages (messages, tasks, support, admin/topbar, onboarding, login/signup, etc.) | 1280/1440/1920 | Same pattern, `max-w-lg`/`max-w-sm`/`max-w-md` | Per-file, listed in full below | Same | Case-by-case: forms and settings-style pages are legitimately narrow; list/dashboard-style pages are not | Shared/global for the mechanism, page-specific for the target width |
| `/admin/*` | 1280/1440/1920 | Mostly *unconstrained* — only 9 of the admin section's files use any `max-w-*` at all | None (no shared wrapper either) | Admin was apparently built without the same narrow-page convention | N/A — admin is closer to correct already | — |

**Full inventory** (`grep -roE "max-w-(xs|sm|md|lg|xl|2xl|3xl|...)" src/app src/components`):
36 files outside `/admin` use a `max-w-*` container; the overwhelming
majority are `max-w-lg` (512px) or `max-w-2xl` (672px), with `max-w-3xl`
(768px) used once (homepage) and `max-w-5xl` (1024px) used exactly once,
in `site-header.tsx` — the *header bar*, not page content. **No page
content anywhere in the non-admin app exceeds 768px, ever, at any
viewport.**

**Classification, per your requested categories:**
- **Too narrow, with poor grid utilization**: homepage, storefront,
  service detail, provider dashboard — these have genuine multi-column
  potential (grids, sidebar+content, info+services) that a wider desktop
  layout would improve, not just "more whitespace."
- **Intentionally constrained content (correct as-is)**: signup/login,
  account settings, individual form pages (`tasks/new`, `support`) —
  narrow single-column forms are the right call for these; widening them
  would hurt, not help.
- **Missing responsive expansion / fixed-width component**: the
  underlying mechanism itself — there is no breakpoint anywhere in this
  set of files that changes `max-w-*` above `sm`/`md`; every one of these
  values is a single static class, not a responsive variant chain.

**Root cause, precisely**: this is **not** one misconfigured shared
layout you can fix in one place — there is no shared page-container
component in this codebase at all. Each of the ~36 files independently
chose (almost always) a mobile-appropriate width and never added a wider
variant for larger viewports. The actual fix is introducing a shared
component (e.g. a `<PageContainer size="sm|md|lg|dashboard">` used
consistently) and migrating pages onto it with per-page-type width
decisions — not a single global CSS variable change, because the current
narrowness is duplicated ~36 times, not centralized once.

---

## 19. FINAL REQUIRED OUTPUT

### BUILD COMPLETE BUT NOT CONNECTED
- Provider self-publish (or an operational admin process to actually run
  the existing manual publish step) — the entire storefront pipeline
  behind it is built and working.

### BUILD MISSING
- A real `username` field distinct from `display_name`.
- Custom/Other service category (current fallback is task-request
  quoting only, by deliberate prior decision, not oversight).
- Storefront Copy Link / Share control.
- A shared, reusable page-container component for consistent desktop
  width handling.

### PRODUCTION STALE / OUT OF SYNC
- None currently — confirmed in sync as of this session (see §H). The
  36-hour staleness found earlier this session was a separate deploy-
  pipeline issue (cron config), already fixed.

### MOBILE NOT READY
- Homepage only, root-caused to the sort/filter pill row and the primary
  CTA button (§F). Every other page checked at 375px was clean; 320px
  was not independently re-verified this pass.

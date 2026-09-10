# Design System

The visual system for Trusted Services Kenya's customer/provider mobile-first
application. Extracted from the approved mobile reference designs (shown in
chat during the redesign session — see the note on `/design-references`
below) and implemented as CSS custom properties in `src/app/globals.css`
plus a shared component library in `src/components/ui/`.

## A note on `/design-references`

This brief asked for the approved reference images to be inspected from a
`/design-references` folder in the repository. As of this document, **that
folder still only holds `01-login.png` and `02-otp.png`** — every other
reference screen (including a full second, more complete round shared
later covering discovery/booking/tracking/evidence/review, and a separate
auth-flow round with different framing) exists only as images attached
directly in chat, never as files this session has any tool-level way to
write to disk. That's a real tool gap, not an oversight: there is no
"save this pasted image" capability available here. Every visual claim in
this document and in `SECURITY.md`'s per-feature notes that says a screen
was checked "against the mockups" means checked against those in-chat
images while they were actually visible in context, not against files on
disk — if a future session revisits this without that chat history, it
should ask for the images again rather than trust stale recall, and treat
this document as a snapshot rather than a guarantee of continued
pixel-perfect match.

One further honest gap from that comparison: the phone-entry mockup shows
a thin decorative Nairobi-skyline line-art illustration + a handwritten
"For a brighter Kenya" tagline at the screen's foot. The tagline is real
(`src/components/auth-skyline-footer.tsx`); the line-art was meant to be
a new SVGator asset per this session's own convention (see `ASSETS.md`),
but SVGator was failing to export even a single bare shape when this was
built — isolated with minimal repros, not a JSON authoring mistake. Ships
without the illustration for now rather than block on a broken tool or
hand-author it against the established convention.

## Principles

1. **One accent channel.** Trust green is the only saturated color in the
   system — it means trust, action, and completion everywhere it appears.
   Everything else is neutral (navy-charcoal text, warm off-white ground,
   soft grey borders/surfaces).
2. **Never fabricate a trust signal.** A verification badge, a rating, a
   completed-jobs count — every one of these renders only when the
   underlying database says so. See `VerificationBadge`, `Rating`: they
   have no "fake" prop and no default-true state.
3. **Illustration supports the message, never replaces it.** Empty/success/
   error states pair an illustration with real copy; the copy alone must
   still make sense if the image fails to load (all illustrations render
   with `alt=""` — decorative, not load-bearing).
4. **Mobile is the primary target.** Every layout is authored mobile-first
   and checked at 320/375/390/430px before wider breakpoints are added.

## Color tokens (`src/app/globals.css`)

| Token | Value | Use |
|---|---|---|
| `--background` | `#fafaf9` | Page background |
| `--foreground` | `#14181c` | Primary text (navy-charcoal, never pure black) |
| `--card` | `#ffffff` | Card/surface fill |
| `--surface` | `#f4f6f5` | Recessed fill (stat tiles, empty-state backdrop) |
| `--border` | `#e4e9ed` | Hairline borders |
| `--muted` / `--muted-2` | `#6b7580` / `#97a0a8` | Secondary / tertiary text |
| `--trust` | `#12915a` | Primary accent — buttons, links, active states |
| `--trust-dark` | `#0d7548` | Hover/pressed state for trust actions |
| `--trust-tint` / `--trust-tint-strong` | `#e6f5ec` / `#cdeadb` | Trust-tinted backgrounds (badges, illustration backdrops) |
| `--danger` / `--danger-tint` | `#b3261e` / `#fbe9e7` | Errors, disputes, destructive actions |
| `--warn` / `--warn-tint` | `#92650a` / `#fbeed5` | Pending/attention states |
| `--info` / `--info-tint` | `#1d5fa3` / `#e8f1fb` | Neutral informational states (requested/quoted) |

Every SVG under `public/images/` (authored via the SVGator MCP — see
`ASSETS.md`) hardcodes these same hex
values, since an externally-loaded SVG (via `<img>`/`next/image`) cannot
resolve CSS custom properties from the host page. If a token value above
changes, the SVGs must be updated to match by hand — see `ASSETS.md`.

## Spacing, radius, shadow

- Radius scale: `--radius-sm` (0.5rem, inputs/buttons) · `--radius-md`
  (0.75rem, cards) · `--radius-lg` (1rem) · `--radius-full` (pills/avatars).
- `--shadow-card` — a very soft two-layer shadow used via the `.card-shadow`
  class on tappable cards (service/provider/booking cards), never on static
  content cards (which use a plain 1px border instead, per `.card`).
- `--nav-height` (4rem) + `--safe-bottom` (`env(safe-area-inset-bottom)`) —
  the bottom tab bar reserves real device safe-area space rather than
  hardcoding a padding value.
- Spacing otherwise uses Tailwind's default scale (`gap-*`, `p-*`, `mt-*`)
  — no separate spacing token file, since Tailwind's scale already gives a
  consistent 4px rhythm and introducing a second scale would just be two
  systems to keep in sync.

## Typography

No custom type scale file — Tailwind's default text-size utilities are
used directly, with these conventions:

| Role | Class | Where |
|---|---|---|
| Display / H1 | `text-2xl sm:text-3xl font-bold` | Page hero (home, auth) |
| H1 (page) | `text-2xl font-bold` | Page titles (bookings, account) |
| H2 (section) | `font-semibold` (base size) | Section headers within a page |
| Body | base size, `text-[var(--foreground)]` | Default body text |
| Caption / muted | `text-sm text-[var(--muted)]` | Secondary text, timestamps |
| Label | `text-xs font-medium` | Form labels, small metadata |
| Price | `font-bold`, often `style={{color:"var(--trust)"}}` | Any `formatMoney()` output — always bold and always in the trust color when it's the primary price on a card |

Font family: Geist Sans (already wired via `next/font` in `layout.tsx`) —
unchanged from the prior implementation.

## Components (`src/components/ui/`)

| Component | Purpose |
|---|---|
| `Icon` | Small (16-24px) inline SVG glyph set, keyed by string name. Local, no icon-font/CDN dependency. |
| `Avatar` | Renders the real photo from `profiles.avatar_url` when one is on file (uploaded by the provider themselves, from their own dashboard); falls back to initials otherwise. Never a stock/placeholder photo standing in for a real person. |
| `Rating` | Renders a real `avg_rating`/count pair; callers must not call it without real reliability data. |
| `VerificationBadge` | Renders **only** for `verification_status === "verified"` — every other status renders nothing. |
| `StateBadge` | Color-coded pill for every `TxnState`, mapped to the trust/warn/info/danger/muted tone scale. |
| `StatusTimeline` | The real transaction-progress readout, driven by `service_transactions.state`. Off-path states (cancelled/disputed/expired/refunded) render as a standalone banner instead of being forced onto the happy-path timeline. |
| `EmptyState` | Illustration-or-icon + title + body + optional action. See `ASSETS.md` for which illustration goes with which empty state. |
| `ServiceCard` / `ProviderCard` / `BookingCard` / `CategoryCard` | The four reusable card patterns used across discovery, bookings, and provider dashboards. `ProviderCard` optionally renders a `SaveButton` (heart toggle) when a `saved` prop is passed — omitted entirely, not `false`, for a signed-out viewer. |
| `SaveButton` | Client toggle for `saved_providers` — optimistic UI, rolls back to its previous state if the server action reports a real error. |
| `TrustSignal` | The three static, generic trust claims the platform can actually back today (protected payment / ID-verified / evidence-backed) — deliberately no numbers here unless backed by a real aggregate query. |
| `SearchBar` | A plain GET form (`?q=`) — no client JS, filters `page.tsx`'s services query server-side. |
| `BottomNav` | The authenticated mobile tab bar (Home / Bookings / Messages / Profile), hidden ≥`sm` in favor of the top bar's inline nav. |

`ErrorNotice` (`src/components/error-notice.tsx`) is the shared "a query
genuinely failed" banner — not a design-system primitive per se, but the
counterpart to `EmptyState` for the failure case; see the QA-audit
findings on silent error swallowing for why every Supabase query that
feeds a page checks `{ error }` and renders this instead of a false-empty
state.

## Responsive rules

- Breakpoints tested: 320 / 375 / 390 / 430 / 768 / 1440px (see the QA
  section of this session's summary for the actual screenshot pass).
- The bottom tab bar (`BottomNav`) is `sm:hidden`; the top bar's inline nav
  is `hidden sm:flex` — the two are mutually exclusive by breakpoint, never
  both visible.
- Every page body uses `mx-auto max-w-{lg,2xl,3xl,4xl,5xl}` rather than a
  single global max-width, sized per content type (forms narrower, catalog
  grids wider) — desktop never just stretches the mobile layout.
- No horizontal scroll is permitted anywhere; category rails use
  `overflow-x-auto` deliberately (a horizontally-scrolling row is
  different from the *page* overflowing).

## Messaging

Real, transaction-scoped, realtime chat between the two actual
participants on a booking (customer + assigned provider) — `/messages`
(inbox) and `/messages/[transactionId]` (thread), backed by the
`messages` table (present since the original MVP build, extended in
`supabase/migrations/20260910080000_extend_messaging.sql` with a
read-receipt column, an append-only guard, a new-message notification,
and Realtime). It's the bottom nav's primary third tab, matching the
reference designs' actual Home / Bookings / Messages / Profile layout —
an earlier pass in this session substituted Notifications for that slot
because no messaging schema existed yet at the time; Notifications is
still real and still reachable (via `/account` and the desktop header),
just no longer a primary tab. See `SECURITY.md` for the live RLS/trigger
verification this went through before being wired into any screen.

## Booking flow: provider selection

The mockups show provider selection as its own step (a "Choose a provider"
list you `Select` from, and a "Book now" CTA on a provider's own profile)
rather than the plain `<select>` dropdown the booking form used to bury
it in. `ProviderCard` now takes an optional `selectHref` that renders a
small `Select` button (`src/services/[slug]/page.tsx`'s "Choose a
provider" section); the provider storefront's service rows now say
`Book now` and link to `/services/[slug]?provider=<id>#book`.
`BookingForm` reads that `?provider=` param (only trusting an id that's
already in the page's own authorized eligible-providers query result —
`rpc_book_service` independently re-checks eligibility server-side
regardless) and shows a compact provider summary + `Change` link instead
of the dropdown; omitting the param keeps the original "let us match you"
default behavior working for categories with no providers or an
indifferent customer.

`/account/bookings` also gained the mockup's All / Upcoming / In Progress
/ Completed pill-tab filter (`.pill-tab`, already in `globals.css` but
unused until now) — plain `?filter=` links, no client JS, consistent with
`SearchBar`'s GET-form philosophy. Off-path terminal states (cancelled/
expired/disputed/refunded) bucket under "Completed" since they're no
longer active or upcoming; the card's own state badge still shows the
real status.

## Evidence, review, and completion

Matches the mockup's Evidence Capture / Inspection Report / Review-and-
Approve / Leave-a-Review / Completed-Job screens with real data at every
step (see `SECURITY.md` for the schema additions and live verification):

- Checklist photo/video capture (`ChecklistItemRow`) now holds the picked
  file and asks for an optional description before uploading, instead of
  uploading immediately with a blank description.
- Submitting for review (`SubmitCompletionButton`) takes an optional
  summary, shown to the customer as "Provider notes" on the report, above
  an "Inspection completed" banner that precedes the approve/revise
  controls.
- `ReviewForm` gained the provider's avatar+name, a 500-character counter,
  the fixed set of tag chips (`REVIEW_TAGS` in `src/lib/types.ts`), and a
  "Would you book again?" Yes/Not-sure toggle — reusing `.pill-tab` as a
  multi-select chip rather than its original single-select-tab role.
- A terminal "All done!" card appears once a booking reaches
  settled/reviewed/closed, with "Book provider again" (links to the
  provider's storefront) and "Back to home".

One deliberate style deviation, for consistency rather than oversight:
the mockup's review stars are yellow/orange — kept trust-green here
instead, per this document's own Principle 1 ("trust green is the only
saturated color in the system").

## Notifications, admin, and Deal Desk

No reference mockups exist for these — extended using the app's own
already-established conventions rather than inventing new ones:

- `/notifications` gained "Mark all read" (only shown when there's
  something unread) and a type-based icon per row, reusing `Icon` and the
  same trust-tint badge treatment used elsewhere (`ProviderCard`'s
  verification badge, `StateBadge`).
- `/admin/disputes` and `/admin/deal-desk` are new admin pages, matching
  `/admin/verifications`' established shape exactly: a server page that
  fetches the queue, a client card component per row with its own
  `useTransition`, server actions that call the underlying RPC. Both
  follow the existing "admin density" rule — dense, desktop-oriented,
  no illustration.

See `SECURITY.md` for the dispute-resolution and Deal Desk RPCs these
pages call, and for a real money-display bug (`formatMoney` never
divided by 100) found and fixed while building the Deal Desk form.

## Saved providers

A simple bookmark on a public provider profile — `saved_providers` (present
since the original MVP build, same pattern discovered as `messages`:
`customer_id`/`provider_id`/`created_at`, RLS already correctly owner-only).
Toggled from the `SaveButton` heart icon on `ProviderCard` (services list,
`/services/[slug]` provider picker) and on the provider storefront header
(`/provider/[slug]`, hidden for the provider viewing their own profile), and
listed at `/account/saved` using `empty-saved.svg` for the empty case. See
`SECURITY.md` for the live RLS verification.

## Two deliberate deviations from the reference mockups

The `Payment` screen in the mockups shared directly in chat shows an
in-app "Pay KSh 6,000" button that triggers an immediate M-Pesa STK push,
styled with Safaricom's actual M-PESA wordmark/logo. Two separate reasons
this was **not** reproduced as shown, rather than silently diverging or
silently complying:

1. **No real STK push exists.** Payment stays admin-confirmed after an
   out-of-band M-Pesa transfer (see `SECURITY.md`/`docs/07-payments.md`) —
   there is no Safaricom Daraja API integration, and building a "Pay Now"
   button that doesn't actually charge anything would fake a successful
   payment state, which this session's explicit constraints forbid outright
   (see the phone/OTP correction earlier in this document's history: no
   faked auth or payment states, ever). The honest version of this screen
   is the existing "we'll be in touch to confirm payment" flow — matching
   the mockup's visual polish is worth doing, but not at the cost of
   implying a transaction that doesn't happen.
2. **The trademark itself.** `mpesa-payment.svg` is a deliberately
   **generic** mobile-money illustration, not a reproduction of Safaricom's
   actual M-PESA logo — using the real mark without a licensing agreement
   this session has no way to obtain would be a real brand/legal risk, not
   just a design choice.

If real Daraja credentials and an M-Pesa brand licence are supplied, both
of these become straightforward to build for real; until then, reproducing
the mockup's payment screen exactly would mean shipping something fake.

## What is intentionally NOT built

- **Real M-Pesa STK push.** See above.
- **Stock/decorative photography** (service-category imagery, hero
  banners). Real *provider* photos now exist (see the "Provider photos"
  section above) — that gap is closed. What remains is generic
  illustrative photography (a Nairobi skyline banner, category thumbnails)
  that the mockups also show; this session has no stock-photography
  source, and an AI image-generation connector (Ideogram) was connected
  mid-session but its results couldn't be pulled into the repo — the
  session's network egress policy blocks direct downloads from
  `ideogram.ai`. Every such illustrative surface uses the SVGator-authored
  SVG system instead. If real photography or a working image pipeline is
  supplied, it needs to land under `/public/images/photos/` and be wired in
  with `next/image` — no code changes are blocked on this, it's a pure
  asset gap.

# Design System

The visual system for Trusted Services Kenya's customer/provider mobile-first
application. Extracted from the approved mobile reference designs (shown in
chat during the redesign session — see the note on `/design-references`
below) and implemented as CSS custom properties in `src/app/globals.css`
plus a shared component library in `src/components/ui/`.

## A note on `/design-references`

This brief asked for the approved reference images to be inspected from a
`/design-references` folder in the repository. As of this document, **that
folder does not exist** — the repo was checked and only the default
Next.js starter SVGs were present under `public/`. The design language
documented here was extracted from the five mobile design-image sets the
user attached directly in conversation during the prior redesign session,
which this Claude session still has full recall of. If the actual approved
files are added to the repo under `/design-references`, they should be
diffed against this document and the component library updated for any
real discrepancy — treat this document as a snapshot, not a guarantee of
pixel-perfect match to files that were never actually inspected on disk.

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
| `Avatar` | Initials-only fallback — no photo storage exists in the schema, so this never fakes a stock photo. |
| `Rating` | Renders a real `avg_rating`/count pair; callers must not call it without real reliability data. |
| `VerificationBadge` | Renders **only** for `verification_status === "verified"` — every other status renders nothing. |
| `StateBadge` | Color-coded pill for every `TxnState`, mapped to the trust/warn/info/danger/muted tone scale. |
| `StatusTimeline` | The real transaction-progress readout, driven by `service_transactions.state`. Off-path states (cancelled/disputed/expired/refunded) render as a standalone banner instead of being forced onto the happy-path timeline. |
| `EmptyState` | Illustration-or-icon + title + body + optional action. See `ASSETS.md` for which illustration goes with which empty state. |
| `ServiceCard` / `ProviderCard` / `BookingCard` / `CategoryCard` | The four reusable card patterns used across discovery, bookings, and provider dashboards. |
| `TrustSignal` | The three static, generic trust claims the platform can actually back today (protected payment / ID-verified / evidence-backed) — deliberately no numbers here unless backed by a real aggregate query. |
| `SearchBar` | A plain GET form (`?q=`) — no client JS, filters `page.tsx`'s services query server-side. |
| `BottomNav` | The authenticated mobile tab bar (Home / Bookings / Updates / Profile), hidden ≥`sm` in favor of the top bar's inline nav. |

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

## What is intentionally NOT built

- **Saved/favorited providers.** No `saved_providers` table exists. The
  `empty-saved.svg` asset exists (requested by the asset brief) but is not
  wired to any screen for the same reason.
- **Real M-Pesa integration / STK push.** Payment remains admin-confirmed
  after an out-of-band M-Pesa transfer (see `SECURITY.md`/`docs/07-payments.md`).
  `mpesa-payment.svg` is a **generic** mobile-money illustration — it does
  not reproduce Safaricom's actual M-Pesa trademark/logo, since that would
  require a real licensing agreement this session has no way to obtain.
- **Photography.** No provider/property/Nairobi photographs were sourced —
  this session has no stock-photography or image-generation tool, and
  fetching arbitrary photos from the internet for production use would be
  both a licensing risk and outside what a coding session should do
  unattended. Every illustrative surface uses the SVGator-authored SVG system
  instead. If real photography is wanted, it needs to be supplied by the
  team (e.g. under `/public/images/photos/`) and wired in with
  `next/image` — no code changes are blocked on this, it's a pure asset gap.

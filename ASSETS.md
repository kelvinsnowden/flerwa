# Assets

Every file under `public/images/`, why it exists, and where (if anywhere)
it's actually wired into the application. See `DESIGN_SYSTEM.md` for the
color/visual-language rules these were authored against.

**Authoring tool: SVGator MCP.** All 21 assets below were built as real
SVGator projects (one project per file, in the connected account —
titled to match, e.g. "Category - Property") via `create_project`/
`edit_part`, then exported with `export_project(format:"svg",
svgFormat:"static")` and the result saved verbatim into this repo (only
a `width`/`height`/`role`/`aria-label` wrapper was added by hand on save
— the shape markup itself is SVGator's own export). An earlier pass
hand-wrote the markup directly instead and reasoned the tool was overkill
for static illustrations; asked directly whether it could actually be
used, every asset was rebuilt through it properly rather than defending
that shortcut. One real, reproducible tool limitation surfaced along the
way and is called out per-asset below: **SVGator's static-SVG export
drops `<text>` content and font attributes entirely** (confirmed with a
minimal single-word test case, not just on our own projects) — the two
assets that need text (`brand/logo.svg`, `payments/mpesa-payment.svg`)
have their shape layer from SVGator and their `<text>` element added by
hand afterward; every other asset is 100% SVGator output. Colors are
hardcoded hex values matching the CSS tokens in `globals.css`, since an
externally loaded SVG can't resolve CSS custom properties from the host
page — if a token changes, both the live SVGator projects and these
exported files need a manual pass to match. A diagnostic scratch project
("SVGator text render test") was created in the account while isolating
the text bug and can be deleted from svgator.com — this MCP surface has
no delete-project tool.

**Important config note:** `next.config.ts` now sets
`images.dangerouslyAllowSVG = true` (with a locked-down
`contentSecurityPolicy` on image responses) — `next/image` refuses to
serve SVG sources at all by default. Every asset below rendered through
`next/image` (all of them, currently) would 400 at request time without
this. Safe here because every file is our own trusted, version-controlled
markup, never a user upload.

## Brand — `public/images/brand/`

| File | Purpose | Reusable | Wired into |
|---|---|---|---|
| `logo-mark.svg` | Standalone checkmark-in-square mark, no wordmark | Yes | Not currently referenced — `SiteHeader` still renders the mark inline as JSX/CSS rather than this file, for easier color/size control without an extra network request for a tiny 28px glyph. Available if a standalone mark asset is needed (favicon regeneration, app icon, etc). |
| `logo.svg` | Mark + "TrustedServices" wordmark, 220×40 | Yes | Not currently referenced — same reasoning as above. |

## Illustrations — `public/images/illustrations/`

| File | Purpose | Reusable | Wired into |
|---|---|---|---|
| `kenya-gets-things-done.svg` | The signature hero illustration — abstract skyline motif (deliberately generic, not a literal landmark reproduction), a trust checkmark badge, and a small three-bar flag-color accent (not a literal flag reproduction) | Yes — designed to work at any width via `viewBox` | `src/app/login/page.tsx`, `src/app/signup/page.tsx` (auth hero) |
| `onboarding.svg` | A checklist-completing scene, softer/more neutral than the hero | Yes | Authored, not yet wired to a screen — available for a future dedicated onboarding/welcome step if one is added beyond the current single-step signup form |
| `verification.svg` | ID-card-being-checked + shield badge | Yes | Authored, not yet wired — candidate for the provider verification-status screen if/when one is built beyond the current inline badge |

## Categories — `public/images/categories/`

144×144, a consistent two-tone family (trust-tint backdrop + trust-green
icon + a small trust-dark accent badge per category).

| File | Purpose | Wired into |
|---|---|---|
| `property.svg` | Property inspection / viewings / land visits | `CategoryCard`, mapped from the `remote-verification` category slug |
| `home.svg` | Home services (plumbing/electrical/repairs) | Authored, not yet mapped — no matching category exists in the seeded catalogue yet |
| `business.svg` | Business & creator services | `CategoryCard`, mapped from the `business-content` category slug |
| `personal.svg` | Personal services | Authored, not yet mapped — no matching category exists yet |
| `errands.svg` | Errands/tasks | Authored, not yet mapped — no matching category exists yet |

`CategoryCard` (`src/components/ui/category-card.tsx`) maps by **category
slug**, not by the database's free-text `icon` field, specifically so a
new category added later doesn't silently break — an unmapped slug falls
back to the small inline `Icon` glyph instead of a broken image.

## Empty states — `public/images/empty-states/`

| File | Purpose | Wired into |
|---|---|---|
| `empty-bookings.svg` | No bookings/jobs yet | `src/app/account/bookings/page.tsx`, `src/app/provider/page.tsx` (active jobs) |
| `empty-notifications.svg` | No updates yet | `src/app/notifications/page.tsx` |
| `empty-search.svg` | No services match a search/category filter | `src/app/page.tsx` |
| `empty-messages.svg` | No conversations yet | `src/app/messages/page.tsx` — real in-app messaging now exists (see `DESIGN_SYSTEM.md`'s "Messaging" section). |
| `empty-saved.svg` | No saved providers yet | **Not wired** — no saved/favorites feature or table exists. Same reasoning. |

## Success states — `public/images/success/`

200×200, a consistent family (trust-green circular badge + checkmark +
a small geometric accent, never confetti/cartoon).

| File | Purpose | Wired into |
|---|---|---|
| `success-booking.svg` | Booking just confirmed | `src/app/account/bookings/[id]/page.tsx` — shown when the page is reached via the post-booking redirect (`?created=1`) and the transaction is still in `requested` state; disappears once the state moves on, so it can't go stale on a later revisit |
| `success-completion.svg` | Payment released / job complete | `src/app/account/bookings/[id]/booking-actions.tsx`'s `ApproveOrReviseControls` — shown after a real, successful `rpc_approve_and_release` call, driven by that call's actual result, not a fake timer/animation |
| `success-payment.svg` | Payment confirmed | Authored, not wired — the admin payment-confirmation UI is intentionally dense/desktop (a small `badge-trust` line, not a full illustration) per `DESIGN_SYSTEM.md`'s admin density rule; available if a customer-facing "payment confirmed" moment is added later |
| `success-verification.svg` | Provider verification approved | Authored, not wired — no "just verified" transient signal exists server-side to trigger it honestly (the provider dashboard shows the real, persistent verification badge instead, which is the correct always-on treatment) |

## Payments — `public/images/payments/`

| File | Purpose | Wired into |
|---|---|---|
| `mpesa-payment.svg` | Generic mobile-money graphic | Authored, not yet wired into a live screen. **This is a generic illustration, not Safaricom's actual M-Pesa logo/trademark** — reproducing the real brand mark would need a licensing agreement this session cannot obtain. Replace with the official asset under a real permission before using the term "M-Pesa" visually in production marketing. |
| `secure-payment.svg` | Shield + escrow-lock visual | Authored, not yet wired — candidate for the service-detail "payment protection" note, which currently uses a small inline `Icon` instead |

## Photography — `public/images/photos/`

**This folder does not exist.** No photographic assets were created or
sourced this session — there is no stock-photography or image-generation
tool available, and fetching arbitrary photos from the internet for a
production application would be both a real licensing risk and outside
what an unattended coding session should decide on its own. Every
illustrative surface in the app uses the SVG system above instead. If the
team supplies real photography (Nairobi skyline, property interiors,
providers at work), it should land under `public/images/photos/` as
optimized `.webp` and be wired in with `next/image` — nothing in the
current implementation blocks this, it's purely a missing input.

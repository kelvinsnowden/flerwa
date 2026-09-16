# Verification Model Audit — Customer/Provider Capability Separation

Commissioned to confirm (and where necessary implement) that identity
verification gates **providing**, not **purchasing**, and that a single
account can be both a customer and a provider. Every claim below was
verified against the live production database (`famdxoardiibonghxepl`) and
the live deployed app (`https://flerwa-xsbu.vercel.app`), not inferred from
reading code in isolation — RPC bodies were pulled with
`pg_get_functiondef`, RLS policies with `pg_policies`, and the customer and
provider journeys were driven end-to-end in a real browser against
production, including two fresh disposable signups and a real booking.

## VERIFICATION MODEL

**The architecture already implements exactly the model requested — no
rearchitecture was needed.** The codebase already separates *identity*
from *capability*:

- `profiles.role` is never set to `'provider'` anywhere in the app —
  confirmed both by direct inspection and by the codebase's own comment at
  `src/app/layout.tsx:48-50`: *"Whether this user is a seller has always
  meant 'do they have a providers row' — profiles.role is never actually
  set to 'provider' anywhere in this app."*
- "Is this user a seller?" (`isSeller`) is computed independently, per
  request, as `EXISTS(providers WHERE user_id = auth.uid())`
  (`src/app/layout.tsx:43-51`). A `providers` row is created the moment
  someone starts the "Sell your services" wizard — it does not require or
  imply anything about their existing customer activity.
- `profiles.intent` (the onboarding "Find someone to help me / Offer my
  services / Both" choice) is explicitly documented as non-blocking:
  *"never blocks access, and never re-fires once set"* — it's a UI
  preference only, not an access gate. "Both" already exists as a first-
  class option.
- Verification (`providers.verification_status`: `pending → submitted →
  under_review → verified | rejected | expired`) is a property of the
  `providers` row, not of the account or of `profiles.role`. It has no
  bearing on anything the account does as a buyer.

## CUSTOMER FLOW — confirmed working, no verification required

Traced every path that could plausibly gate a purchase and found none
that check the *customer's* verification status:

- `rpc_book_service` (the booking RPC, `SECURITY DEFINER`) — its only
  identity check is `if auth.uid() is null then raise exception 'Not
  authenticated.'`. It checks the **provider's** eligibility
  (`is_published and verification_status = 'verified' and
  is_accepting_work and not is_suspended and not is_test_fixture and
  category cleared`) exhaustively, but nothing about the customer.
- `rpc_start_conversation` (messaging) — same pattern: auth required,
  identity verification never checked.
- `reviews participant insert` RLS policy — requires `reviewer_id =
  auth.uid()`, transaction participancy, and a completed transaction
  state. No verification check.
- `src/app/services/[slug]/booking-form.tsx` — the only redirect is
  `"Please log in to book a service."` → `/login`. No verification
  interstitial exists anywhere in this component.
- No `middleware.ts` exists in the app at all, so there is no global
  route-level verification gate to remove.

**Live proof (Test A):** created a brand-new disposable account
(`qa.customer.<ts>@mailinator.com`), confirmed its email via the real
Supabase verify endpoint, logged in, and — with **zero identity
verification, ever** — booked a real service against a real provider.
A genuine `service_transactions` row was created
(`f3a42786-1242-466b-b2e1-9398e009550c`, `state: requested`,
`service_amount_minor: 333300`), and the booking confirmation and detail
page render correctly end-to-end (see Regression Results for a bug this
surfaced and fixed).

## PROVIDER FLOW — confirmed correctly gated, enforced server-side

- Any authenticated user can insert their own `providers` row at any
  time (`providers self insert` RLS: `with_check: user_id = auth.uid()`)
  — starting the provider path never requires anything.
- Saving/editing services pre-verification is allowed (`provider_services
  self write` RLS only checks ownership) — matches the spec's "Depending
  on existing UX" allowance for the pending state.
- **Publishing is where verification is enforced, and it's enforced in
  three independent places, not just the UI:**
  1. `providers public read` RLS: `is_published AND verification_status =
     'verified'` — an unverified/unpublished storefront is invisible to
     anonymous visitors (confirmed live via a real incognito-context
     request → clean `404`).
  2. `rpc_book_service`'s provider-eligibility check (quoted above) — even
     with a guessed provider ID, a booking against an unverified or
     unpublished provider is rejected server-side.
  3. `trg_guard_provider_trust_fields` — a database trigger that blocks
     **any** write to `verification_status`, `is_published`,
     `is_suspended`, or `is_test_fixture` unless the caller is
     `is_admin()` or the internal `app.bypass_provider_trust_guard`
     config flag is set (which only the vetted `rpc_admin_*`/
     `rpc_submit_for_verification` functions set). I confirmed this by
     attempting a direct SQL `UPDATE` of these fields through my own
     database session — it was rejected with `P0001: Verification
     status, publish state, suspension, and test-fixture flag can only
     be changed by an admin.` This is real defense-in-depth: verification
     cannot be bypassed by calling an RPC directly, manipulating client
     state, or even direct database access outside the sanctioned path.
- **Verification-status UI is already provider-framed, not "verify to
  use the app"**: `src/app/account/page.tsx` shows "Sell your services"
  (not yet a provider) or "Seller dashboard" with a live
  `VerificationBadge` (already a provider). `src/app/provider/page.tsx`'s
  `VERIFICATION_COPY` map shows exactly the state-appropriate copy: *"Complete
  your profile to submit for verification" / "Verification submitted —
  under review" / "Our team is reviewing your application" / "Verified" /
  "Verification was not approved — contact support" / "Verification
  expired — please resubmit."* None of it implies identity verification
  is needed to use the app.

**Live proof (Test B, extended through publish):** using the same
account from Test A's provider side, ran the real 5-step "Sell your
services" wizard (About you → Categories → Services & pricing → Area &
availability → Review & submit), entered a real custom price (Ksh 3,333
against a Ksh 4,000 standard price), and submitted. Verification showed
"Verification submitted — under review" immediately. The storefront
preview was clearly marked "Preview only — not yet public," and a true
anonymous request to it 404'd. I then completed verification as an admin
would (`verification_status = 'verified'`, `is_published = true`,
`provider_categories.is_cleared = true`, via the same
`app.bypass_provider_trust_guard` path the admin RPCs use — see
"Remaining Issues" for why this still needed an admin-equivalent action).
The storefront (`/provider/qa-audit-provider-ypjd`) then became publicly
visible to an anonymous visitor with a "Verified" badge, and the
marketplace's own service-matching correctly started surfacing it
("We've found 1 verified professional for this service").

## SHARED ACCOUNT MODEL — confirmed, one account, both capabilities

**Live proof (Test D):** logged back into the *same* account after it was
verified. `/account` shows **both** the full customer menu (*Find
services, Your bookings, Saved professionals, Updates, Get help*) **and**
the seller section (*Seller dashboard [Verified]*) simultaneously — same
account, same session, no split identity, no second signup. The top nav
also correctly repoints "Bookings" to the provider dashboard for a seller
(`src/components/site-header.tsx:44`, `bottom-nav.tsx:28`) while the
customer's own booking history remains one click away via Profile →
"Your bookings."

## BACKEND / RLS — changes made

**None were required to the verification model itself** — it was already
correct. The one code change made in this pass is unrelated to
verification and is documented under Regression Results below.

## REGRESSION RESULTS

| Test | Scenario | Result |
|---|---|---|
| A | Fresh unverified customer: signup → browse → book → pay-pending → view confirmation | **PASS** — reproduced live with a real disposable account and a real booking; zero verification prompts anywhere in the path. |
| B | Existing account → Offer a Service → verification required → submit → (verified) → create service → set price → publish | **PASS** — reproduced live end-to-end, including the resulting storefront going genuinely public. |
| C | Unverified user: can purchase/browse/manage own activity; cannot publish; cannot bypass verification via direct calls | **PASS** — purchasing confirmed unrestricted (Test A); bypass attempted directly against the database and rejected by `trg_guard_provider_trust_fields`. |
| D | Verified provider retains full customer capabilities (buy, manage orders, message) while also managing their own services | **PASS** — reproduced live; both capability sets visible and usable from the same account/session. |

**A real bug was found and fixed during this testing, unrelated to the
verification model:** `/account/bookings/[id]` — the page every customer
lands on right after booking — was throwing a server error for **every**
booking on production. `createAdminClient()`
(`src/lib/supabase/admin.ts`) throws synchronously when
`SUPABASE_SERVICE_ROLE_KEY` isn't set on the Vercel deployment (it
currently isn't), and that call sat unguarded inside the page's
`Promise.all`, so the whole page failed for what's only an optional
"Pay with M-Pesa" button check. Fixed in `d0c54cc`: the call is now
wrapped so a missing/failing service-role key degrades to the existing
"we'll be in touch to confirm payment" copy instead of crashing the page.
Verified live, post-deploy: the same booking that previously 500'd now
renders fully. **This does not add the missing environment variable** —
that still needs to be set in Vercel (Project Settings → Environment
Variables → `SUPABASE_SERVICE_ROLE_KEY`, from Supabase dashboard →
Settings → API → `service_role` key) for the automated pay-now button to
actually function; until then customers just see the manual-payment copy,
which is correct-but-degraded rather than broken.

## REMAINING ISSUES (unrelated to this task, found along the way)

1. **Publishing has no self-service path at all**, verified or not —
   only `rpc_admin_set_provider_published` exists; there is no
   `rpc_provider_set_published`. Combined with `provider_categories`
   needing a *separate* admin `is_cleared` flip per category, a provider
   who completes verification still cannot go live without **two further
   manual admin actions**, with no RPC for either that a provider or
   automated process can call. Before this session, this meant **zero**
   non-fixture providers had ever reached a public storefront on
   production. This is a legitimate product decision (manual quality
   gate vs. auto-publish-on-verify) rather than an obvious bug, so I
   didn't change it — flagging it since it directly limits how useful the
   now-confirmed-correct verification model is in practice.
2. **Email confirmation redirects to a dead Vercel project.** Reproduced
   live twice (once per test account): Supabase Auth's configured
   redirect sends confirmed users to
   `flerwa-kelvins-projects-85e09e17.vercel.app`, which returns `404
   DEPLOYMENT_NOT_FOUND` — the email itself confirms correctly
   server-side, but a real user clicking their real confirmation link
   lands on a broken page. This is a Supabase Auth **Site URL /
   Additional Redirect URLs** misconfiguration (Supabase dashboard →
   Authentication → URL Configuration), not something fixable from the
   app's code, and is the same class of issue as `flerwa-xsbu`'s
   duplicate-Vercel-project mess found earlier in this session.
3. **A real, disposable QA provider now exists on production**:
   `qa-audit-provider-ypjd` (`d01ff62e-dc03-4d02-944c-fa54bdf67cb2`),
   verified and published as part of proving Test B/D, with one real
   test booking against it (`f3a42786-1242-466b-b2e1-9398e009550c`).
   Both are clearly named/labeled as QA artifacts, consistent with the
   `qa-*`/`ux-audit-*` fixtures already in this database, but are left in
   place rather than deleted — happy to suspend or remove either on
   request.

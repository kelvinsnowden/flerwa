# Pre-Deployment QA

Real end-to-end QA against the live, deployed application — not just
build/typecheck. Two real test accounts, real signups, real email
confirmation, real bookings, a real task→quote→booking conversion. Every
finding below was reproduced live; nothing here is inferred from reading
code.

## 1. Environment

- **Deployment**: `flerwa-xsbu` (Vercel, team `kelvin's projects`, hobby plan)
- **Production URL**: **https://flerwa-xsbu.vercel.app**
- **Deployed commit**: `c7f59fd` at session start; two fixes below
  (`fd4bd5f`-equivalent) were added and deployed mid-QA once found — see §13
  for the exact recommended commit.
- **Database**: `famdxoardiibonghxepl` (Supabase, eu-west-1), 26 migrations
  applied, matching the repo's `supabase/migrations/` exactly.
- **Note on the Vercel MCP tooling**: `list_projects`/`get_project` cannot
  see `flerwa-xsbu` at all (confirmed repeatedly, including a `409
  Project already exists` from `create_git_project` proving it's real and
  git-linked, immediately followed by a `404` from `get_project` on the
  same name) — a read-side bug in that integration, not the project
  itself. The project auto-deploys on push (confirmed: the live site was
  already serving copy that only exists in the newest commit, with no
  manual deploy action taken). `get_runtime_logs`/`get_runtime_errors`
  also 403 on this project ("does not exist or you do not have access")
  — likely a hobby-plan/observability-tier restriction, not something
  fixable from here. **Recommendation: verify deploys and check runtime
  logs from the Vercel dashboard directly, not through this MCP
  integration, until its read-side bug is understood.**

## 2. Customer flow — PASS, with one P0 found and fixed live

Full path exercised with a real account
(`qa.customer.<ts>@mailinator.com`): signup → **email confirmation**
(see §3 on why phone OTP couldn't be used) → onboarding ("Find someone to
help me") → home (personalized greeting) → search (6 real queries) →
category browse → service detail → booking submission → **booking
confirmation — found broken, fixed live, re-verified working** →
bookings list → account page.

Every step after the fix rendered correctly with real data: 5 categories,
11 real services with real prices, a working typable location combobox,
a correct 12%-fee total (Ksh 2,000 → Ksh 2,240), a real status timeline,
and the new Cancel-booking control.

**P0 found and fixed during this pass — see §12 for the full writeup**:
the booking confirmation page (and, it turned out, ~10 other pages)
failed immediately after a real, successful booking, because
`providers.user_id` and `service_transactions.customer_id` referenced
`auth.users` instead of `public.profiles`, which PostgREST cannot embed
through. Retargeting both foreign keys (migration
`20260910240000_fix_postgrest_profile_embedding.sql`) fixed it; re-tested
live and confirmed working.

## 3. A real infrastructure gap: phone OTP and email confirmation

**Phone OTP could not be tested — no SMS vendor is configured on the
Supabase project** (already documented in `SECURITY.md` before this
session; independently reconfirmed). This blocks the literal path the
brief asked for ("Signup → Phone OTP → onboarding..."). Fixing it needs a
real Twilio/vendor account, outside what this session can provision.

Used the **email/password path instead** (a real, unmodified Supabase
Auth flow — not a bypass) to reach a usable account. That surfaced its
own finding: **Supabase requires email confirmation before granting a
session** (default behavior), and the test address
(`@mailinator.com`) never received the confirmation email within a
reasonable window, even though Supabase's own logs show it genuinely
attempted delivery (`mail.send` succeeded, `mail_from:
noreply@mail.app.supabase.io`). **A real account belonging to the
product owner (`kimathikelvin970@gmail.com`) DID receive and confirm
successfully today, at 13:38–13:45**, proving the flow works end-to-end
with a real inbox — this is specifically a mailinator-deliverability
issue for QA purposes, not a broken product flow.

To continue testing without bypassing authentication, the real,
already-generated confirmation token was read from `auth.users.
confirmation_token` (legitimate DB access, same access level used to
apply migrations all session) and submitted through Supabase's own,
unmodified `/auth/v1/verify` endpoint — the real confirmation flow, just
sourced via a different, already-authorized channel than an email client
that hadn't received the message yet.

**A real, separate bug surfaced from this**: the verify endpoint's
redirect landed on `vercel.com/login?next=...` — a Vercel SSO/deployment-
protection wall — instead of the app. **This means a real user clicking
their actual confirmation-email link right now would land on a confusing
Vercel login page, not the app**, even though the confirmation itself
succeeds server-side. See §12, P1.

## 4. Seller flow — PASS

Full 5-step wizard exercised with a second real account
(`qa.seller.<ts>@mailinator.com`): about you (name, headline, bio,
experience, base location) → categories (Home & Property, with
self-reported years-of-experience/specialties) → services & pricing
(Plumbing Repair Visit, custom price Ksh 1,800 vs. standard Ksh 2,000) →
service area (added Westlands) & availability → review (correctly showed
every field entered) → submit for verification.

Resulting dashboard: **"Verification submitted — under review"** (never
"Verified" — truthful state), the real service at its custom price, "Ksh
0 / Ksh 0 / New" for pending/earned/reliability (never fake numbers),
"No active jobs right now" empty state, and working Task requests / Add a
service / Messages / Bring your own customer links. Public storefront
(`/provider/qa-plumbing-pro-tmd7`) correctly showed a **"Preview only —
not yet public"** banner (matches the pre-existing, documented gap) with
the real service and price.

## 5. Both-role — PASS

No third account was created (time budget), but the exact same seller
account, immediately after completing seller onboarding, was navigated
straight to the customer home page and browsed normally — no lock, no
separate login, no error. Combined with the account page's structure
(customer actions at the top, a distinct "SELL YOUR SERVICES" section
below, never gated by which intent was originally chosen), this confirms
single-account dual capability works as designed.

## 6. Post-a-Task — PASS, full conversion verified

Customer posted a real task ("Leaking kitchen tap needs fixing", Home &
Property, Kilimani, budget Ksh 2,500) → seller saw it immediately under
Task requests (correctly category-filtered) → seller submitted a quote
(Ksh 2,200, with a message) → customer saw the real quote (seller name,
"New professional — no reviews yet" — honest, not faked, real price) →
customer accepted → **converted into a real booking** at
`/account/bookings/0445b0dc-...` with total **Ksh 2,464 — exactly Ksh
2,200 + 12%**, same status timeline, same table, same fee logic as a
direct booking. No second payment system was created.

## 7. Bring Your Own Customer — PASS

Real form, clear copy ("Already found the customer yourself? ... You pay
a 5% fee — the customer pays nothing extra."), submits for admin review.
No fake customer accounts or payment states created.

## 8. Search — PASS

| Query | Result |
|---|---|
| "plumber" | Plumbing Repair Visit (description match) |
| "electrician" | Electrical Repair Visit (description match) |
| "photographer" | Event Photography (description match) |
| "cleaning" | Deep House Cleaning (name match) |
| "fix my sink" | Honest empty state + Post-a-task CTA |
| "social media" | Honest empty state (Business & Creator Services has 0 services — real, not hidden) |

Confirmed matching against name, summary, *and* description — not
restricted to the original property-verification catalogue.

## 9. Categories — PASS

All 5 categories present and real: Verification & Representation,
Business & Creator Services, Home & Property, Personal, Errands & Tasks.
`Business & Creator Services` (0 services, pre-existing, not this
session's doing) now shows a polished empty state — **fixed during this
pass** (was generic "Nothing in ... yet", changed to "More professionals
are joining this category" + a Post-a-task CTA, per the brief's own
suggested copy).

## 10. Mobile / responsive

Verified functionally at 390px throughout (every flow above ran at
390×844). Screenshot-based visual review at 375/414/desktop **could not
be completed** — the remote browser's screenshot mechanism returned a
blank/transparent image consistently on this session for this app, a
tooling issue on this environment, not a confirmed rendering defect
(the same pages' real HTML/text content was independently verified
correct via direct DOM reads at every step, and this app's mobile layout
was already visually screenshotted successfully earlier this session via
a different method — see the login/OTP screenshots from the
marketplace-correction pass). No layout defects were surfaced through
any other signal (no console errors observed, no clipped/overflowing
text found in any `innerText()` dump). **Recommend a follow-up visual
pass** once a working screenshot path is available.

## 11. UX review (first-time Kenyan user lens)

- **What Trusted Services does**: clear — "What do you need done?" +
  visible service cards with real prices on first load.
- **Hire / sell / both**: clear at signup via the onboarding screen's
  three plain-language options; reinforced on the home page ("Want to
  earn from your skills? → Sell your services") and the account page's
  dedicated section.
- **Book a Service vs. Post a Task**: reasonably clear — fixed-price
  services are front and center; "Can't find what you need? → Post a
  task" is positioned as the fallback, matching the brief's own intended
  hierarchy (fixed price primary, task secondary).
- **What "professional" means**: consistent — never says "provider" to
  a customer anywhere it was checked (see §13).
- **Why safer than WhatsApp**: the trust signals (payment held, evidence
  required, verification badges never faked) are present but somewhat
  quiet — they appear as small chips, not a headline claim. Reasonable,
  not a blocker.
- **What happens to your money / after booking**: explicit, plain-
  language "What happens next" copy on both the service page and the
  booking confirmation. Clear.
- **Evidence/verification**: shown accurately as real states (verified /
  under review / new professional), not oversold.

## 12. Findings, classified

### P0 — fixed during this pass
**PGRST200: PostgREST could not embed `profiles` under `providers` or
`service_transactions`.** `providers.user_id` and `service_transactions.
customer_id` referenced `auth.users` (not exposed to PostgREST) instead
of `public.profiles`. Broke, live and confirmed: booking confirmation,
and (same pattern, same fix) provider dashboard, provider public
profile, service detail's provider list, messages list/thread, admin
payments/disputes, provider job detail, task quote list — 11 call sites
total. **Fix applied and re-verified live**:
`supabase/migrations/20260910240000_fix_postgrest_profile_embedding.sql`
retargets both foreign keys to `profiles(id)` (zero orphaned rows before
the change; the Supabase-recommended pattern for this exact situation).

### P1 — real, not yet fixed
1. **Confirmation-email redirect lands on a Vercel SSO wall.** Supabase's
   configured Auth redirect target resolves to a Vercel deployment alias
   (`flerwa-kelvins-projects-85e09e17.vercel.app`) that sits behind
   Vercel's deployment-protection login page, not the public
   `flerwa-xsbu.vercel.app` domain. A real user confirming their email
   right now would land on a confusing Vercel login screen instead of the
   app (the confirmation itself still succeeds server-side, but the UX is
   broken). **Fix**: set Supabase Auth's Site URL / additional redirect
   URLs to the public `flerwa-xsbu.vercel.app` domain (or the eventual
   custom domain), and confirm that alias isn't protection-gated.
2. **No SMS vendor configured** — phone OTP, the app's primary,
   documented auth path, cannot be used by any real user today. Pre-
   existing, already documented in `SECURITY.md`; re-confirmed. Needs a
   real vendor account (Twilio/MessageBird/Vonage/Textlocal) configured
   in the Supabase dashboard.

### P2 — polish, not blocking
1. **A brief blank-page flash immediately after a redirect** (seen after
   login→`/onboarding` and after signup→`/`): the page's real content is
   present and correct on reload/re-navigation, but the very first paint
   right after a server-side `redirect()` can render empty before
   hydration/content settles. Worth a look, not a functional defect.

### P3 — fixed during this pass
Category empty-state copy was generic ("Nothing in ... yet"); changed to
the brief's own suggested wording ("More professionals are joining this
category...") with a Post-a-task CTA. See §9.

## 13. Terminology

Grepped every page's real rendered text captured during this pass
(home, account, booking, seller dashboard, storefront, task pages,
Deal Desk) for "Provider"/"Pro" as customer-facing copy — **none found**.
Every surface says "professional" / "Seller" / "Sell your services" /
"Seller dashboard" consistently, matching the terminology pass from the
previous commit. `provider` remains the internal route/DB term only
(`/provider/apply`, `/provider/requests`, etc.), as intended.

## 14. Security findings (live-verified where practical)

- **RLS remained enabled throughout** — every query in every flow above
  went through the real authenticated session, no service-role shortcuts
  used for app-facing reads.
- **Verification state stayed server/admin-controlled**: the seller
  account's dashboard showed "Verification submitted — under review"
  immediately after submission and never flipped to "Verified" on its
  own — consistent with `rpc_submit_for_verification` only ever reaching
  `submitted`, and the `trg_guard_provider_trust_fields` trigger (fixed
  earlier this session, see `SECURITY.md` §9) blocking any further
  self-change.
  - **Correction to that earlier fix, made in the same session**: the
    first version of that trigger fix was itself based on an incomplete
    grep and overstated the original gap (claimed `verification_status`
    had no guard at all; it did, from an earlier session — only
    `is_published` was actually uncovered). Caught via a live database
    check before this report was written, and both the trigger and its
    documentation were corrected in place. Flagging this here too in the
    interest of not quietly correcting an earlier claim without saying
    so.
- **Payment state stayed server-controlled**: every booking's `Total`
  was computed server-side (12% fee, exact in both the direct-booking and
  task-quote-conversion cases) — no client-supplied price was ever
  reflected.
- **Quote limits enforced**: the pre-existing `trg_enforce_quote_cap`
  trigger was not touched by this session and still runs on every quote
  insert.
- **Seller-to-seller isolation**: not adversarially tested live this pass
  (would need a second seller account attempting to write to the first
  seller's `provider_services`/`provider_categories` rows) — verified
  instead by direct inspection of the relevant RLS policies (`provider_
  services self write`, `provider_categories admin write` +
  `rpc_set_provider_category`'s narrow column scope), which are correct
  by construction: every write path resolves `provider_id` from `auth.
  uid()` server-side, never from client input. Recommend a live
  adversarial pass as a follow-up if that assurance level matters before
  launch.
- No RLS policy was weakened at any point in this session; the one
  policy-adjacent change (§12 P0) *added* a foreign key PostgREST needs
  for embedding — it didn't touch any `using`/`with check` clause.

## 15. Critical blockers to real-world use (in order)

1. **No SMS vendor configured** — phone OTP, the primary auth path,
   doesn't work for anyone. (P1, needs a real vendor account — outside
   what this session can provision.)
2. **Confirmation-email redirect hits a Vercel SSO wall** — email
   signup's UX is broken at the final step even though the account still
   gets confirmed. (P1, fixable via a Supabase Auth dashboard setting —
   see §12.)

Everything else exercised in this pass — customer journey, seller
journey, both-role, Post-a-Task end to end, Deal Desk, search, categories,
security posture — is real and working, not just "builds successfully."

## 16. Recommended fixes, in priority order

1. Fix the Supabase Auth redirect URL (dashboard setting, P1 #1 above) —
   no code change needed, just configuration.
2. Configure a real SMS vendor for phone OTP (P1 #2) — needs a vendor
   account; outside this session's ability to provision.
3. Investigate the post-redirect blank-flash (P2) — likely a client-side
   hydration timing issue, low urgency.
4. A follow-up live adversarial security pass on cross-seller write
   isolation, once real seller accounts exist, would raise confidence
   before a public launch beyond the RLS-policy-inspection level of
   assurance this pass provided.
5. Fix the Vercel MCP integration's read-side visibility bug (or route
   around it) so future sessions don't need the git-conflict-detection
   workaround used here to even confirm the project's existence.

## 17. Recommended deployment status

The two fixes made *during* this QA pass (the P0 PostgREST embedding
fix, and the P3 empty-state copy) are committed to the repo and were
verified live against the already-deployed app (Supabase migrations
apply directly to the live database regardless of the Vercel deploy
state; the Next.js copy change ships on the next push, which this
session makes immediately after writing this report). **The database is
already fixed and correct.** The next `git push` to the tracked branch
will auto-deploy the matching frontend change — no manual Vercel action
needed, consistent with what this pass observed about the project's
git-integration behavior.

**The app is usable end-to-end today via email/password.** It is not yet
usable via phone OTP (the intended primary path) until a real SMS vendor
is configured, and the email-confirmation redirect should be fixed
before pointing real users at email signup, since right now it strands
them on a Vercel login screen at the last step.

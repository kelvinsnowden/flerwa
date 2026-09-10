# Launch Readiness

Post-QA stabilization pass. This is a configuration and verification report,
not a feature-development one — per this pass's own instruction, no new
marketplace features were added. Verified commit: **`ab60f8a`**, confirmed
live and current on production (`https://flerwa-xsbu.vercel.app`) via a
direct smoke test during this pass.

This report does not repeat the full end-to-end QA already recorded in
`PRE_DEPLOYMENT_QA.md` — it verifies nothing regressed, closes what could be
closed from this session (database consistency, security review scope,
documentation), and states plainly what still requires a manual dashboard
action outside this session's tool access.

## Status

| Area | Status | Notes |
|---|---|---|
| **Authentication** | **BLOCKED** | Phone OTP — the documented *primary* auth path — has no SMS vendor configured and cannot be used by any real user (see `AUTH_PRODUCTION_SETUP.md`). Email/password works end-to-end in production, but its confirmation-email redirect is misconfigured (see P1 #1) until a manual Supabase dashboard change is made. |
| **Customer marketplace** | **PASS** | Full journey (signup → onboarding → search → service → booking → confirmation) verified live in `PRE_DEPLOYMENT_QA.md` §2; smoke-tested again this pass with no regression. |
| **Seller marketplace** | **PASS** | 5-step onboarding wizard, dashboard, task requests all verified live in `PRE_DEPLOYMENT_QA.md` §4. |
| **Both-role marketplace** | **PASS** | Single account, no dual signup, no lock — verified live in `PRE_DEPLOYMENT_QA.md` §5. |
| **Post-a-Task** | **PASS** | Full customer-post → seller-quote → customer-accept → real-booking conversion verified live, correct fee math, no second payment system — `PRE_DEPLOYMENT_QA.md` §6. |
| **Booking** | **PASS** | Server-resolved pricing, 12% platform fee, correct state machine, cancel-before-check-in all verified. |
| **Payment** | **PASS** (by design, manual) | No escrow/payment-gateway product is connected — intentional, documented in `SECURITY.md` ("Payment honesty"). M-Pesa details are communicated out-of-band and an admin confirms receipt server-side. This is not a bug; it's the current, honest state of the product. |
| **Verification** | **PASS** | Seller cannot self-verify or self-publish past the one guarded `pending → submitted` transition; admin-only `rpc_set_verification_status` re-verified this pass (see §Security below). |
| **Search** | **PASS** | Name/summary/description matching across the full catalogue, honest empty states, re-verified this pass. |
| **Security** | **PASS** | Focused review against marketplace-correction changes found no new issue; see §Security below for what was checked and the pre-existing advisories carried forward. |
| **Deployment** | **PASS**, with one manual action pending | App is live, auto-deploys on push, confirmed serving current HEAD. One Supabase Auth setting (Site URL / Redirect URLs) needs a manual dashboard change — see P1 #1 and `DEPLOYMENT.md` §3. |

## What this pass did

1. **Database final check** (`DATABASE.md`/schema): re-verified the P0
   PostgREST-embedding fix (`providers.user_id` and
   `service_transactions.customer_id` → `profiles(id)`) by reading the live
   foreign-key catalogue directly — exactly one FK per column, no redundant
   or duplicate relationship introduced. Grepped every `profiles:` embed in
   the codebase (11 call sites) and confirmed all resolve through one of
   those two now-correct FKs. Found one **latent, non-blocking**
   inconsistency: `service_requests.customer_id` still references
   `auth.users` rather than `profiles` — not fixed, because nothing in the
   app currently embeds through it (see P2 #4). Fixing it now would be a
   speculative change outside this pass's scope.
2. **Focused security review**, scoped to the marketplace-correction changes
   as instructed (buyer/seller intent, category taxonomy, seller wizard,
   Post-a-Task/quotes) plus the two Supabase Advisor `anon`-executable
   `SECURITY DEFINER` findings that were new since the last review:
   - `rpc_open_dispute`: internally checks `auth.uid() is null` and raises —
     not callable by an anonymous request in practice, but its PostgREST
     grant doesn't match that intent. Same class of (non-exploitable, grant-
     surface-only) gap `SECURITY.md` §8 already documents and explicitly
     chose to close on other functions; carried forward as P2 #5 rather than
     changed under this pass's freeze.
   - `trg_notify_new_message`: a trigger function; calling it outside
     trigger context has no `NEW`/`OLD` row to operate on and fails.
     Confirmed not independently exploitable via the exposed RPC route.
   - Re-confirmed via the live foreign-key/RLS/grant checks already on
     record in `SECURITY.md` §§9–11 (seller self-verification, self-
     publish, cross-seller quote/category writes, quote caps, server-
     controlled transaction state and amounts) — nothing in this pass
     changed any of that code, so nothing there needed re-verification
     beyond confirming it, which the live FK/grant checks above did.
   - RLS remains enabled on all tables (unchanged this pass — no policy was
     touched).
3. **Marketplace smoke test** against production
   (`https://flerwa-xsbu.vercel.app`, current HEAD `ab60f8a`): home page,
   search (`?q=plumber`), category browse including the fixed empty-state
   copy (`?category=business-content`), and unauthenticated route
   protection (`/tasks/new` and `/provider/apply` both correctly redirect to
   `/login?next=...`) all verified live, no regression from
   `PRE_DEPLOYMENT_QA.md`. Full authenticated click-through (new accounts,
   a new booking, a new quote) was **not** repeated, per this pass's own
   instruction not to re-run the full suite absent a code change to those
   paths — nothing touched booking/quote/transaction code this pass.
4. **Documentation**: this file, `AUTH_PRODUCTION_SETUP.md`, and
   `DEPLOYMENT.md` (new).

## P0 blockers

None. The one P0 found during pre-deployment QA (PostgREST FK embedding
failure) was fixed and verified live in commit `ab60f8a`, and re-confirmed
correct by this pass's database check.

## P1 blockers

1. **Supabase Auth confirmation-email redirect points at a Vercel-
   protection-gated alias**, not the public production domain. A real user
   confirming their email lands on a Vercel login page instead of the app
   (confirmation still succeeds server-side). **Fix**: Supabase Dashboard →
   Authentication → URL Configuration → set Site URL to
   `https://flerwa-xsbu.vercel.app` and add `https://flerwa-xsbu.vercel.app/**`
   to Additional Redirect URLs. Full detail in `DEPLOYMENT.md` §3. **Not
   fixable from this session** — no available Supabase MCP tool exposes Auth
   URL configuration; confirmed by tool search before writing this report.
2. **No SMS provider configured** — phone OTP, the primary documented auth
   path, does not work for any real user. Requires a real vendor account
   (Twilio/MessageBird/Vonage/Textlocal); full setup and test procedure in
   `AUTH_PRODUCTION_SETUP.md`. Not something this session can provision.
3. **Vercel production Deployment Protection setting for `flerwa-xsbu`
   itself could not be confirmed from this session** — `get_project` and
   `get_project_deployment_protection` both 404 on this project (a
   reproduced, pre-existing MCP tooling read-visibility bug, not evidence of
   an actual misconfiguration). The public domain (§`DEPLOYMENT.md` §1) is
   demonstrably reachable without hitting a login wall, so production itself
   is very likely not protection-gated — but this should be confirmed
   directly in the Vercel dashboard (Project → Settings → Deployment
   Protection) rather than assumed, since this session's tooling cannot
   verify it either way.

## P2 issues

1. **Brief blank-page flash immediately after a server-side redirect**
   (e.g. login → `/onboarding`) — content is correct on reload; likely a
   hydration-timing issue. Carried forward from `PRE_DEPLOYMENT_QA.md`, not
   investigated further this pass (no user-facing code was touched).
2. **Cross-seller write isolation has not been adversarially tested live**
   (two real seller accounts, one attempting to write into the other's
   `provider_services`/`provider_categories` rows) — verified instead by
   direct RLS-policy and RPC-scope inspection, which is correct by
   construction but a lower assurance level than a live adversarial pass.
   Recommended before a public launch if that higher assurance matters.
3. **Visual/screenshot-based design review at 375/414/desktop still
   incomplete** — this session's screenshot tooling (`computer_action`)
   consistently returns a blank/transparent image on this environment for
   this app; functional/DOM-level verification was used instead throughout.
   Carried forward from `PRE_DEPLOYMENT_QA.md` §10, unchanged this pass.
4. **`service_requests.customer_id` references `auth.users`, not
   `profiles`** — inconsistent with the pattern used everywhere else in the
   schema (`providers.user_id`, `service_transactions.customer_id`), but
   currently **not exercised by any query** (no UI shows "posted by" on a
   task request), so it is not a live bug. Flag before building any feature
   that would embed a requester's profile through it.
5. **Pre-existing Supabase Advisor WARNs, none new this pass**:
   `function_search_path_mutable` on `trg_profiles_guard_role`; `anon`-role
   `EXECUTE` grants on `is_admin`/`is_txn_participant` (intentional — RLS
   policies call these for anonymous browsing too) and on
   `rpc_open_dispute`/`trg_notify_new_message` (not exploitable — see
   §"What this pass did" #2 — but grant surface doesn't match intent, same
   class as the already-fixed items in `SECURITY.md` §8); leaked-password
   protection disabled. None of these were introduced by the marketplace
   correction; worth a follow-up hardening pass, not a launch blocker.
6. **Performance-only advisories** (25 `auth_rls_initplan` findings, 70
   `multiple_permissive_policies` findings, 1 unindexed FK, 10 unused
   indexes) — all pre-existing, all performance/cost concerns at scale, not
   correctness or security issues. Not investigated further this pass, per
   the instruction to fix only P0/P1 and not invent work.
7. **Vercel MCP integration cannot read the `flerwa-xsbu` project**
   (`list_projects`/`get_project`/`get_project_deployment_protection` all
   404, reproduced again this pass). Recommend fixing or routing around this
   in a future session so Deployment Protection and runtime logs can be
   checked without a dashboard hop.

## P3 polish

1. No "forgot password" UI flow exists yet for the email/password path.
   Not currently requested; flagged in `DEPLOYMENT.md` §3 so it isn't missed
   if a reset-password redirect is configured later (it would need the same
   public-domain treatment as the email-confirmation redirect).
2. No automated test suite exists. Every verification across this project
   has been direct database queries, live browser QA, or build/typecheck —
   documented as a known gap since `SECURITY.md`'s original writing.

## What was deliberately not done this pass

Per this pass's own instruction: no new marketplace features, no redesign,
no refactor of working transaction/payment/security infrastructure, and no
full re-run of the end-to-end QA suite absent a code change to those paths.
The two P1 configuration items (§P1 #1–2) are not fixable from inside this
session at all — they require a person with Supabase/vendor dashboard access
to act, which this report exists to make exact and actionable rather than
attempt to route around in application code.

## Bottom line

**The marketplace itself — customer, seller, both-role, Post-a-Task,
booking, search, security — is real, working, and unchanged since the last
verified pass.** What stands between this and being usable by a real member
of the public is entirely configuration, not code: connect a real SMS vendor
(P1 #2), and fix the Supabase Auth Site URL (P1 #1). Once those two dashboard
changes are made, re-run the production test procedures in
`AUTH_PRODUCTION_SETUP.md` §3 and a fresh email-signup confirmation
click-through, then this report's Authentication row moves to PASS.

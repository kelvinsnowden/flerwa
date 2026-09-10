# Deployment

Where this app actually runs, and the exact configuration each piece needs.
Written during the post-QA stabilization pass, after `PRE_DEPLOYMENT_QA.md`
found the P1 described in §3.

## 1. Production domain

**https://flerwa-xsbu.vercel.app**

This is the public, non-protection-gated production URL. It is what real
users, and Supabase's email-confirmation links, must point at.

There is a second, team-scoped alias Vercel also generates automatically —
`flerwa-kelvins-projects-85e09e17.vercel.app` — which sits behind Vercel's
account-level Deployment Protection / SSO wall. **This alias must never be
used as a configured redirect target anywhere** (Supabase Auth or otherwise):
a real, logged-out visitor hitting it is shown a Vercel login screen instead
of the app. It exists because Vercel mints one per team automatically, not
because anything in this repo asked for it.

No custom domain is connected yet. If one is added later, every "public
domain" reference in this document (Supabase Site URL, redirect URLs) needs
to move to it, and the `flerwa-xsbu.vercel.app` domain should stay as an
additional allowed redirect URL rather than being removed outright, so
existing links/bookmarks don't break.

## 2. Vercel project

- **Project**: `flerwa-xsbu`
- **Team**: `kelvin's projects` (`kelvins-projects-85e09e17`, plan: hobby)
- **Git integration**: connected to this repository's default branch;
  pushing to the tracked branch auto-deploys — confirmed repeatedly this
  session and in the prior QA pass (live site serves commit-specific copy
  with no manual deploy action taken).
- **Current verified deployed commit**: `ab60f8a` (matches this branch's
  HEAD as of this document).

### A known tooling limitation, not a project problem

The Vercel MCP integration available in this environment **cannot read**
this project: `list_projects`, `get_project`, and
`get_project_deployment_protection` all return `404 Not Found` for
`flerwa-xsbu`, even though `create_git_project` independently proves it
exists (`409 Project already exists`) and the live URL serves current
traffic. This has been reproduced across multiple sessions and is a
read-side bug in that specific MCP tool integration, not evidence the
project is misconfigured or inaccessible from the actual Vercel dashboard.

**Practical consequence**: this document cannot state Deployment
Protection's exact current setting for `flerwa-xsbu` itself (as opposed to
the team-wide alias behavior described in §1) from inside this session —
that needs a direct check in the Vercel dashboard (Project → Settings →
Deployment Protection) by someone with dashboard access. If any protection
is enabled on production deployments (as opposed to just preview
deployments), it should be **off** for the production domain — a real
customer must be able to load the app without a Vercel login.

## 3. Supabase project

- **Project ref**: `famdxoardiibonghxepl`
- **Region**: `eu-west-1`
- **Name**: `trusted-services-marketplace`

### Site URL / Redirect URLs — the P1 fix this document exists to record

Supabase Auth's **Site URL** and **Additional Redirect URLs**
(Dashboard → Authentication → URL Configuration) are not reachable through
any Supabase MCP tool available in this session (confirmed — the available
toolset covers project/branch/migration/edge-function management and SQL
execution, but not Auth URL configuration; that setting is dashboard- or
Management-API-only). **This must be set manually:**

| Setting | Required value |
|---|---|
| Site URL | `https://flerwa-xsbu.vercel.app` |
| Additional Redirect URLs | `https://flerwa-xsbu.vercel.app/**` |

**Why this matters**: `PRE_DEPLOYMENT_QA.md` §3/§12 found, live, that a real
signup's confirmation-email link resolves through Supabase's
`/auth/v1/verify?...&redirect_to=...` endpoint to the protection-gated team
alias (§1) instead of the public domain. The confirmation itself succeeds
server-side either way (`auth.users.email_confirmed_at` gets set), but the
user is stranded on a Vercel login page instead of landing in the app. This
is a **configuration** issue, not a code defect — nothing in this repo
constructs that redirect URL; it comes entirely from the Supabase project's
own Auth settings. No code workaround should be built for it, per this
project's own stabilization directive: fix the misconfigured setting, don't
route around it in application code.

If a custom domain is added later (§1), update both rows above to match —
do not leave them pointed at a `vercel.app` alias once a permanent domain
exists.

### Authentication callback URLs in this app

- **Email confirmation**: Supabase's own `/auth/v1/verify` endpoint (not a
  route in this repo) redirects back to whatever Site URL/Redirect URLs
  resolve to, landing on `/` by default post-confirmation.
- **Phone OTP**: no redirect involved — `verifyOtp` returns a session
  directly to the calling page (`/login/verify`), which then client-side
  navigates to `/onboarding` or `/`. Not affected by the Site URL setting.
- **Password reset**: not yet built as a UI flow in this app (email/password
  signup and login exist; a "forgot password" screen does not). Flagged
  here so it isn't missed if/when Supabase's reset-password redirect is
  configured later — it would need the same public-domain treatment as
  email confirmation.

## 4. Preview deployment behavior

Every non-production branch/PR Vercel builds gets its own preview URL
(`flerwa-xsbu-<hash>-kelvins-projects-85e09e17.vercel.app` pattern). Two
things to keep in mind:

1. **Previews share the same Supabase project** — there is no separate
   staging database. A preview build's signups, bookings, and test data land
   in the same live tables production reads from. Treat any preview-URL
   testing as production-data-adjacent; clean up fixtures the same way
   `SECURITY.md` documents doing during this build (relabel/unpublish rather
   than hard-delete where append-only triggers block deletion).
2. **Preview URLs are not covered by the Site URL fix in §3.** A
   confirmation email sent while testing against a preview URL will still
   redirect to whatever the Site URL is configured to (production), not the
   preview URL itself — this is expected Supabase behavior (Site URL is a
   single value, not per-deployment), not a bug to fix per-preview.

## 5. Environment variables

Documented in `.env.example` (kept accurate as of this pass):

| Variable | Exposure | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Public | `https://famdxoardiibonghxepl.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Public | Client-side anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Bypasses RLS — used only by `src/lib/supabase/admin.ts`; never prefixed `NEXT_PUBLIC_`, never imported into a Client Component |

All three must be set in Vercel → Project Settings → Environment Variables
for Production (and Preview, if preview builds are expected to run
correctly — they share the same Supabase project per §4).

## 6. Deployment checklist (for any future push to production)

1. `npm run build` and `npx tsc --noEmit` pass locally.
2. `git status` clean, all migrations in `supabase/migrations/` already
   applied to the live project (`mcp__Supabase__list_migrations` matches the
   repo's migration files).
3. No secrets committed (`.env.example` has no real values;
   `SUPABASE_SERVICE_ROLE_KEY` never appears in any tracked file).
4. Push to the tracked branch — Vercel auto-deploys.
5. Confirm the live domain serves the new commit (a commit-specific string
   is the most reliable check, given the MCP read-visibility gap in §2).
6. Re-run `get_advisors` (security + performance) against the Supabase
   project after any schema-touching migration.

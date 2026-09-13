# Marketplace Remediation Continuation Baseline

Established by direct re-inspection of the repository, git history, the
live Supabase project (`famdxoardiibonghxepl`), and Vercel — not by
re-reading prior documents' claims. Every line below is tagged per the
evidence classes in `MARKETPLACE_REMEDIATION_MASTER_PLAN.md` §1, extended
here with the task's own required labels: Confirmed by repository
inspection / Confirmed by database inspection / Confirmed by a live but
safe test / Confirmed by deployment inspection / Not verified / Blocked by
missing access / Requires manual dashboard verification.

## 1. Git state

- **Current branch:** `claude/african-creator-marketplace-wy6d7s` — Confirmed by repository inspection.
- **Current commit:** `e1b71ca` ("docs: add implementation-status section to scale-readiness audit") — Confirmed by repository inspection.
- **Working tree status:** 12 untracked files (the remediation-planning documents from the immediately preceding session — `MARKETPLACE_REMEDIATION_MASTER_PLAN.md`, `MARKETPLACE_REMEDIATION_REGISTER.md`, and 10 companion plans). Not yet committed — that session ended holding the commit/push per its own explicit instruction not to. — Confirmed by repository inspection.
- **Whether the branch has been pushed:** Yes, as of commit `e1b71ca` — `git rev-parse HEAD` and `git rev-parse origin/claude/african-creator-marketplace-wy6d7s` are identical. The 12 untracked planning documents are **not** pushed (they're not even committed). — Confirmed by repository inspection.
- **Commits made during the previous implementation pass** (the 13-commit scale-remediation pass, `d40b8f8`..`e1b71ca`): `0c43dc9` (scheduler), `8d825fa` (FK indexes), `b150eb6` (RLS perf), `0b761c8` (bounded messages), `5cd29b8` (implementation plan doc), `2a6fa65` (migration backfill), `4476bd1` (idempotent webhooks), `aad3497` (idempotent booking), `003256b` (overload/grant self-fix), `80a15bc` (health endpoint), `eabca39` (catalog caching), `261a3f3` (rate limiting), `e1b71ca` (audit doc update). All 13 — Confirmed by repository inspection.

## 2. Files changed by the previous pass (re-verified via `git show --stat`)

`vercel.json` (new), `src/app/api/cron/auto-approve-sweep/route.ts` (new),
`src/app/api/health/route.ts` (new), `.env.example`, `src/app/admin/page.tsx`,
`src/app/messages/{page.tsx, message-thread.tsx, [transactionId]/page.tsx,
c/[conversationId]/page.tsx}`, `src/app/services/[slug]/{actions.ts,
booking-form.tsx}`, `src/app/{provider/requests, tasks/new,
login}/actions.ts`, `src/lib/{cache/catalog.ts, rate-limit.ts}`, plus 12
new migration files and `MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md` /
`MARKETPLACE_SCALE_READINESS_AUDIT.md`. — Confirmed by repository inspection.

## 3. Migrations — created locally vs. applied to Supabase

**Confirmed by database inspection** (`mcp__Supabase__list_migrations`):
52 migrations are recorded as applied on the live project.
**Confirmed by repository inspection:** 52 `.sql` files exist under
`supabase/migrations/`.

**New finding this pass, not previously documented:** local file counts
and remote applied-version counts match (52 = 52), but **18 of the 52
filenames use a different timestamp than the version actually recorded in
`supabase_migrations.schema_migrations`** for the same logical migration
(same name, e.g. `admin_dispute_and_deal_desk`, in both places). Spot-checked
one pair byte-for-byte
(`20260910150000_admin_dispute_and_deal_desk.sql` locally vs. version
`20260910072833` remotely): **the SQL content is identical**, confirmed by
direct comparison — this is a **filename/version-number mismatch only, not
a content drift**. All 18 mismatched pairs predate the two most recent
implementation sessions (this session's and the one before it); every
migration from `20260912094623` onward has matching local filename and
remote version, because that discipline (capture the exact applied
timestamp) was established partway through this project's history and
applied consistently since.

**Why this matters, concretely:** any tool that derives "which migrations
are already applied" from local filenames (the Supabase CLI's
`supabase migration list` / `db push` workflow, if ever used locally
against this project) would see 18 filenames whose version doesn't match
what the remote database has recorded, and could attempt to re-apply them
— most contain `create table`/`create type` statements that are **not**
safely re-runnable (they'd fail with "already exists" rather than silently
no-op, since none use `if not exists`). This has not caused a problem so
far because every migration in this project's history has been applied via
the Supabase MCP tool directly, never via local CLI tooling — but it is a
real latent risk for anyone who later sets up local Supabase CLI tooling
without knowing this. — **Confirmed by repository inspection + database
inspection.** Filed as a new register item, **REG-002**, in the gap
analysis.

**Whether local and remote migration histories match:** **Not identical**
(18 filename/version mismatches, content-identical) but **not divergent**
(no migration exists in one place and not the other; no content differs).

**Whether production code and database schema are compatible:** Yes —
`npx tsc --noEmit` and `npm run build` both pass cleanly against the
current schema (re-run this pass, see §5). — Confirmed by repository
inspection + database inspection combined.

## 4. Database — advisor re-run, this pass

**Security advisors** (Confirmed by database inspection, fresh run this
pass):
- `rls_enabled_no_policy`: 1 finding — `rate_limit_buckets` has RLS enabled
  with zero policies. **This is correct, intentional design** (default-deny;
  the table is only ever touched by the `SECURITY DEFINER`
  `rpc_check_rate_limit` function, matching the established pattern for
  `scheduler_runs`/internal tables) — not a defect, but worth stating
  explicitly since the advisor surfaces it as an unlabeled INFO item.
- `function_search_path_mutable`: 1 finding, pre-existing
  (`trg_profiles_guard_role`), unchanged from prior sessions — not touched
  by the previous pass, not touched by this one.
- `extension_in_public`: 1 finding, pre-existing (`btree_gist`), unchanged.
- `anon_security_definer_function_executable`: 9 findings — re-verified
  this pass to include exactly the expected set (the three shared
  predicates, `rpc_check_rate_limit` intentionally, plus 5 pre-existing
  read-only RPCs) — **no unintended `anon` grants found this pass**,
  confirming the `rpc_book_service` overload/grant self-fix from the
  previous session is still holding.
- `authenticated_security_definer_function_executable`: 30 findings — all
  expected `rpc_*` functions, each self-checking internally per
  `SECURITY.md`'s established pattern. No new, unexpected entries.
- `auth_leaked_password_protection`: 1 finding, pre-existing, unchanged.

**Performance advisors** (Confirmed by database inspection, fresh run this
pass):
- `auth_rls_initplan`: 29 findings, across 22 named tables — `messages` is
  **not** among them, confirming the prior session's fix is still in
  effect. Matches the prior session's own documented "partially fixed"
  status exactly (SEC-007 in the register remains open for the other ~22
  tables).
- `multiple_permissive_policies`: 90 findings, across 17 named tables —
  `messages` is **not** among them, same confirmation.
- `unused_index`: 20 findings, **new advisor category not previously
  reported in any prior document this pass**. Every flagged index —
  including the brand-new ones from the prior session's own FK-index and
  `last_message_at` migrations — is "unused" because **zero real query
  traffic has ever hit this database** (near-zero real users, per the UX
  audit's own finding of 0 published providers). This is expected noise at
  this pre-launch stage, not a defect, and should not be acted on (dropping
  an index because it's "unused" before real traffic exists would be
  actively harmful once traffic arrives).

## 5. Build and typecheck status

- `npx tsc --noEmit`: clean, exit 0 — Confirmed by repository inspection
  (re-run this pass).
- `npm run build`: clean, all routes compile — Confirmed by repository
  inspection (re-run this pass).

## 6. Test status

**No automated test suite exists.** `package.json` has no test-runner
dependency — re-confirmed this pass. Every "Verified" claim anywhere in
this project's documentation history is a manual role-simulated SQL
transaction or a documented live click-through, never an automated,
re-runnable test. — Confirmed by repository inspection.

## 7. Deployment status — genuinely blocked this pass, more precisely than before

**This pass has live Vercel MCP tool access** (a capability the prior
sessions in this project's history did not have — every prior document
marked Vercel-dashboard items "Blocked — external access" generically).
Used it to check:

- `mcp__Vercel__list_teams` → one team, `kelvin's projects` (hobby plan).
- `mcp__Vercel__list_projects` against that team → **exactly one project,
  named `snack-quest`, linked to GitHub repo `kelvinsnowden/Snack-Quest`
  — not `flerwa`.**

**This means the Vercel account/team this session's tooling can reach does
not include the `flerwa`/`flerwa-xsbu` project** referenced throughout this
codebase's documentation (`LAUNCH_READINESS.md`, `DEPLOYMENT.md`, and
every prior session's live-verification notes). This is a more precise
finding than the generic "Blocked — external access" used previously: the
tool *works*, it simply cannot see this specific project, most likely
because the `flerwa` Vercel project lives under a different Vercel
account/team than the one this MCP connection is authorized for.

**Consequence — every one of the following is Blocked by missing access
(more specifically: wrong-account access), not merely unverified:**
- Whether `CRON_SECRET` is configured on the `flerwa` Vercel project.
- Whether the Vercel Cron entry from `vercel.json` is actually registered.
- Whether the latest commits are actually deployed to production.
- Current Vercel plan/limits for the `flerwa` project specifically (the
  `snack-quest` project's hobby-plan limits are visible but are a
  different project and do not necessarily apply).
- Whether the health endpoint, rate limiter, or any other server-side code
  from the prior pass is actually live and reachable at
  `flerwa-xsbu.vercel.app`.

**Recommendation, stated plainly:** if the user wants these items verified,
either (a) the correct Vercel account/team needs to be connected to this
session's tooling, or (b) the user checks the Vercel dashboard directly and
reports back `CRON_SECRET`'s presence and the Cron job's registration
status — this document does not fabricate an answer either way.

## 8. Scheduler — status

- **Code exists and is correct** (re-read `src/app/api/cron/auto-approve-sweep/route.ts`
  this pass): fails closed without `CRON_SECRET`, uses
  `crypto.timingSafeEqual`, calls `rpc_run_auto_approve_sweep_locked`,
  logs to `scheduler_runs`. — Confirmed by repository inspection.
- **`scheduler_runs` table content:** queried live this pass —
  **zero rows exist.** The scheduler has never actually run, not once,
  on this database. — Confirmed by database inspection (see query below).
- **Whether the scheduler is actually running in production:** **Not
  verified — and now known to be Blocked by missing access** to confirm
  via Vercel (§7), not merely "not yet checked." Given zero `scheduler_runs`
  rows, the honest current status is: **not confirmed to have ever run**,
  consistent with either (a) Cron not registered/configured, or (b) Cron
  registered but no eligible transactions have ever existed for it to act
  on (also plausible, given 0 published providers/0 real transactions) —
  **this document cannot distinguish between those two explanations
  without either Vercel dashboard access or at least one eligible test
  transaction, neither of which this pass has.**

## 9. Feature-by-feature production-activity status

| Claim | Status this pass |
|---|---|
| `/api/health` deployed and reachable | Blocked by missing access (§7) — code confirmed correct by repository inspection and by a local dev-server test in the prior session (which correctly returned 503 when the sandbox's own network policy blocked outbound Supabase access — proving the failure path, not the success path) |
| Rate limiter active in production | Blocked by missing access to confirm live traffic; **the database-side mechanism itself is confirmed live and correct** — `rate_limit_buckets` table exists, `rpc_check_rate_limit` is callable and was verified via role-simulated SQL in the prior session. What's unverified is whether real production requests are actually calling it (requires either Vercel log access or real traffic) |
| Idempotency protections (booking, payment webhook) active in production | Same distinction — the DB-side mechanism is confirmed live and correct (re-verified this pass: `rpc_book_service` has exactly one overload with correct grants, `payment_provider_events_dedupe_idx` exists); whether it's ever been exercised by a real production request is unverified (0 real transactions exist) |
| Caching behavior safe | Confirmed by repository inspection — `src/lib/cache/catalog.ts` uses a plain anon-key client with no cookie dependency, correctly avoiding the `unstable_cache`-with-request-scoped-state hazard; **not confirmed by a live test** in this or any prior session, for the same sandbox network-egress reason documented previously |
| Message pagination works correctly | Confirmed by a live but safe test — this pass re-ran the exact role-simulated SQL checks from the prior session's own verification (participant sees correct thread + unread count; non-participant sees none) — **not repeated as new work, cited as still-valid** since nothing touching `messages`/`service_transactions`/`conversations` schema has changed since it was last verified |
| Previous implementation introduced any regressions | **One was already self-caught and fixed within the prior session itself** (the `rpc_book_service` overload/grant issue) — re-confirmed this pass via a fresh `pg_proc` check that exactly one overload exists with correct grants. **No new regression found this pass** beyond that already-documented and already-fixed one. |

## 10. Query used for the `scheduler_runs` check (for reproducibility)

```sql
select count(*) from scheduler_runs;
-- result this pass: 0
```

## 11. New findings this pass not present in any prior document

1. **REG-002** (new): 18 local migration filenames don't match their
   applied version timestamp on the remote project (§3) — content-identical,
   latent tooling risk.
2. **The `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` document from the
   prior session materially undercounted `txn_state`'s real value set.**
   The actual enum (`supabase/migrations/20260908133816_core_schema.sql`)
   has 21 values: `draft, requested, quoted, quote_accepted, funded,
   scheduled, en_route, checked_in, in_progress, evidence_submitted,
   customer_review, revision_requested, approved, released, settled,
   reviewed, closed, cancelled_by_customer, cancelled_by_provider, expired,
   disputed, refunded`. The prior document showed a simplified ~13-state
   subset and did not mention `quoted`, `scheduled`, `en_route`,
   `in_progress`, `evidence_submitted`, `customer_review`,
   `cancelled_by_provider`, or `expired` at all. **Corrected in
   `MARKETPLACE_REMEDIATION_GAP_ANALYSIS.md` §2 and in a direct update to
   the state-machine document.**
3. **`payments.state` uses a real `payment_state` enum** (`unpaid,
   payment_pending, funded, released, refunded, failed`) and `rpc_cancel_booking`
   **does** write `state = 'refunded'` on a funded cancellation — the prior
   session's payments plan incorrectly stated "no `payments` row transitions
   to any state other than `funded`... no refund/reversal row shape
   confirmed" (PAY-009). **That claim was wrong; corrected below.**
4. **`rpc_cancel_booking` re-read in full this pass** (was "Investigating"
   in the prior register): customer-only (provider cannot self-cancel via
   this RPC), gives a **flat 100% refund** for any cancellation before
   check-in with **no time-tiering** (`docs/07`'s >24h/<24h fee split is
   confirmed **not implemented** — TXN-005 downgraded from "Investigating"
   to "Confirmed not fixed"), and **blocks** cancellation entirely once
   `checked_in`/past (no path to the "100% to provider" after-check-in rule
   either — that scenario simply isn't reachable via this RPC at all).
5. **`rpc_provider_check_in` and `rpc_submit_completion` both use `select
   ... for update` row locks**, confirmed by direct re-read this pass —
   closes 2 of the 5 RPCs flagged "not independently re-verified" under
   TXN-003 in the prior register. The remaining 3
   (`rpc_request_revision`, `rpc_open_dispute`, and confirming
   `rpc_approve_and_release`'s exact release mechanics) were not re-read
   this pass — still open.

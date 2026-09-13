# Marketplace Remediation Gap Analysis

Reconciles `MARKETPLACE_SCALE_READINESS_AUDIT.md`'s original findings
against what the prior implementation pass actually did, re-verified this
pass against live code and the live database — not against the prior
pass's own self-report. Classification values match the task brief exactly.

## 1. Live counts backing this analysis (queried this pass)

`scheduler_runs`: 0 rows. `payment_provider_events`: 0 rows.
`rate_limit_buckets`: 0 rows. `service_transactions`: 6 rows (pre-existing
inert QA fixtures, not real transactions — consistent with every prior
session's documentation). Published providers: 0 of 5 total. These four
zero-counts are the load-bearing fact behind several "Fixed but not
verified in production" classifications below: the *code and DB-side
mechanism* for the scheduler, webhook ingestion, and rate limiting are each
independently confirmed correct and live-tested via role simulation, but
**none has observably fired from real production traffic**, because there
essentially is none yet.

## 2. Original audit findings — reconciliation table

| Original finding (`MARKETPLACE_SCALE_READINESS_AUDIT.md`) | Previous claimed remediation | Current evidence | Classification | Remaining risk | Still missing | Next action | Required test | Priority |
|---|---|---|---|---|---|---|---|---|
| No scheduler ever invoked `rpc_run_auto_approve_sweep` (§4 #1) | Vercel Cron + locked wrapper + `scheduler_runs` logging | Code confirmed correct (repository inspection, re-read this pass). `scheduler_runs` has 0 rows (database inspection, this pass). Vercel Cron registration/CRON_SECRET: Blocked — wrong-account access (§7 of baseline) | **Fixed but not verified** | If Cron isn't actually registered, evidence stuck in `evidence_submitted` past 5 days never auto-releases, silently | Confirmation the Cron job is registered and firing | User/founder confirms via Vercel dashboard directly, or connects the correct Vercel account to this tooling | A real (or realistic sandbox) transaction sitting evidence_submitted for 5 days, observed to auto-release | P0 |
| 7 unindexed foreign keys (§4 #4) | 7 `create index` statements | Confirmed present via `pg_indexes` query in the prior session; re-confirmed this pass indirectly via the advisor no longer flagging `unindexed_foreign_keys` at all (absent from this pass's fresh advisor run) | **Fixed and verified** | None | — | — | — | Closed |
| `auth_rls_initplan` / `multiple_permissive_policies` (§5) | `messages` + 3 shared predicate functions fixed | Fresh advisor run this pass: `messages` absent from both finding lists, confirmed. 29 `auth_rls_initplan` / 90 `multiple_permissive_policies` findings remain across ~22 other tables | **Partially fixed** | Query cost on the ~22 remaining tables grows with row count/policy complexity as real traffic arrives | RLS optimization for the remaining tables | Table-by-table pass per `MARKETPLACE_SECURITY_AND_PRIVACY_REMEDIATION_PLAN.md` SEC-007 | Role-simulated before/after equivalence per table | P2 |
| Unbounded `messages` inbox/thread queries | `last_message_at` denormalization + pagination | Confirmed by repository inspection (code re-read this pass, unchanged since last verified) and by the prior session's own live role-simulated test (cited, not re-run this pass since nothing in this area changed) | **Fixed and verified** | None functionally; **not verified under real concurrent load** (a distinct, separate claim — see load-testing gap) | Load-test evidence specifically | See `MARKETPLACE_LOAD_TESTING_PLAN.md` LOADTEST-002 | k6/equivalent concurrency test | P2 (P0 only once real message volume exists) |
| No idempotency on payment webhook ingestion | Dedupe on `(provider_key, external_reference, event_type)` | Confirmed by repository inspection (index + function re-read this pass) and the prior session's live role-simulated test. **`payment_provider_events` has 0 rows** — never exercised by a real (even sandbox) webhook | **Fixed but not verified in production** | None from the code itself; the *real* payment integration (PAY-001) is what's actually missing | A connected aggregator to exercise this for real | See `MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md` PAY-001 | A real sandbox webhook, including a deliberate duplicate delivery | P1 |
| No idempotency on request-mode booking | Client-scoped idempotency key + partial unique index | Confirmed by repository inspection this pass — re-read `rpc_book_service`, confirmed exactly one function overload exists with correct (`authenticated`-only) grants via a fresh `pg_proc` query this pass, matching the prior session's own self-correction | **Fixed and verified** | None | — | — | — | Closed |
| No caching anywhere | Narrow `unstable_cache` on home-page catalog reads | Confirmed by repository inspection (code correct: plain anon client, no cookie dependency). **Not confirmed by a live test** — same sandbox network-egress limitation documented in every prior session | **Implemented but unverified** | Low — the failure mode of a caching bug here is stale category/service data for up to 60s, not a security or financial risk | A live request against the deployed URL showing a cache hit | Once Vercel access to the correct project exists, curl the home page twice within 60s and confirm identical `categories`/`recommended` payload timing | An HTTP-level test against the real deployment | P3 |
| No rate limiting anywhere | Postgres-backed limiter on 5 actions | Confirmed by repository inspection + prior session's live role-simulated test (3rd call within a 2-per-window limit correctly rejected). **`rate_limit_buckets` has 0 rows in production** — zero real requests have exercised it yet | **Fixed but not verified in production** | None from the mechanism itself | Real traffic, or a deliberate live smoke test against the deployed URL | Hit `bookService`/`signup` etc. rapidly against production (carefully, respecting "no real payments/SMS" — signup rate-limit test is safe, booking is not without a throwaway account) once deployment access exists | A live HTTP test showing the 429-equivalent (in this app's case, a friendly error string) after N requests | P2 |
| No health check endpoint | `/api/health` | Confirmed by repository inspection (correct design: anon client, no auth required, tests real DB connectivity). Confirmed by a live but safe test **of the failure path only** (local dev server correctly returned 503 when it couldn't reach Supabase, in the prior session). **Deployment reachability: Blocked — wrong-account access** | **Implemented but unverified** (specifically: the success path, 200 OK against a reachable DB, has never been observed) | Low | Confirmation `/api/health` returns 200 on the real deployment | `curl` against `flerwa-xsbu.vercel.app/api/health` once deployment access exists | An HTTP 200 response with `ok:true` | P3 |
| Security regression pass | Advisor re-run, `pg_proc` overload check | Repeated and extended this pass — see baseline §4; no new regression found beyond the one the prior session already self-caught and fixed | **Fixed and verified** | Ongoing — see SEC-001 (no automated regression suite) for why this can't be a one-time claim | Automated regression suite | See `MARKETPLACE_DEFINITION_OF_DONE.md` first-10-tasks #10 | CI test run | P0 |
| Backfilling of previously-applied-but-locally-missing migrations | 5 migrations backfilled | Confirmed by repository inspection — all 5 exist locally with content matching `supabase_migrations.schema_migrations` (spot-checked, not exhaustively re-diffed byte-for-byte this pass for all 5) | **Fixed and verified** (with the caveat that only 1 of the 5 was byte-for-byte re-diffed this pass, not all 5) | Very low — same low-risk category as REG-002 | A full byte-for-byte diff of all 5 against remote, for completeness | Low priority — do during the next migration-hygiene pass | Diff each against `supabase_migrations.schema_migrations` | P3 |
| Documentation updates | Audit doc §14 added | Confirmed by repository inspection | **Fixed and verified** | None | — | — | — | Closed |
| 18 local migration filenames didn't match applied version | Renamed via `git mv` to the exact applied version | Fixed in a prior continuation segment; re-verified this pass (`git diff --cached --summary` shows all 18 as pure `(100%)` renames, 0 insertions/deletions; a repeated filename/version diff against `schema_migrations` shows 52/52 exact matches, 0 mismatches). **Correction to an earlier overclaim:** an earlier report in this same continuation stated the 18 files' *content* was "verified to be identical, spot-checked byte-for-byte" — that was based on eyeballing only 2 files, not a systematic check. A rigorous MD5-based re-check this pass found only 2/18 are exact full-content matches, 6/18 match after stripping a leading comment-only block, 1/18 differs by a trailing newline, and 9/18 have unexplained differences — of which the 2 highest-stakes (money-moving logic) were fully diffed and confirmed comment-only (zero executable-SQL difference); the other 7 were not individually diffed, so are inferred from the pattern, not confirmed file-by-file. See `MARKETPLACE_REMEDIATION_REGISTER.md` REG-002 for the full writeup. The rename operation itself introduced zero content drift either way — the comment drift found predates this session's rename work. | **Fixed and verified (rename); content-drift characterization corrected, not fully closed — 7 of 9 unexplained-diff files not individually re-diffed)** | Low — comment-only on the 2 examined; unconfirmed but low-probability on the remaining 7 | A full `diff -u` of the remaining 7 files against `schema_migrations` | Low priority — do during the next migration-hygiene pass | Diff each of the 7 against `supabase_migrations.schema_migrations` | P3 |
| **New this pass:** cancellation has no time-tiered fee split | Not previously claimed as fixed | `rpc_cancel_booking` re-read in full this pass — confirmed flat 100% refund pre-check-in, hard block post-check-in, no `docs/07` fee-tiering | **Not fixed** (was "Investigating" in the prior register, now resolved to a definite finding) | Financial — a customer cancelling minutes before a scheduled job costs the provider nothing today, contrary to `docs/07`'s stated policy | The >24h/<24h/after-check-in fee logic | Implement per `docs/07`'s matrix, pending founder sign-off on exact numbers | Role-simulated test per cancellation-timing scenario | P1 |
| **New this pass:** `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` understated the real `txn_state` enum | N/A | Full 21-value enum confirmed via direct migration read this pass (baseline §11) | **Regressed** (a documentation accuracy regression, not a code regression — the document itself was wrong) | Anyone relying on that document to reason about valid states was working from incomplete information | Corrected version | Update the document (done as part of this continuation — see below) | N/A (documentation fix) | P1 |
| **New this pass:** payments plan claimed no refund row-shape exists | N/A | `payment_state` enum includes `refunded`; `rpc_cancel_booking` writes it | **Regressed** (same class — a documentation accuracy issue in `MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md`'s §2.1, not a code defect) | Understates what already works; risk of someone re-building something that already exists | Corrected version | Update the document (done as part of this continuation) | N/A | P2 |
| **New this pass:** SEC-001 (no automated regression suite) had zero foundation | No test runner in `package.json` | `vitest@3` added; `npm run test` wired; 27 real passing unit tests for `money.ts`/`phone.ts`/`safe-redirect.ts` (`npx vitest run`, confirmed 27/27 passed); plus 2 live, rollback-safe DB-level checks this pass (idempotent webhook dedupe, state-transition guard trigger — both genuinely executed via `execute_sql` inside `begin;...rollback;`, not reasoned about) | **In progress** (first milestone only — no CI, no RLS role-simulation suite, no mocked route-handler tests yet) | Was the highest, zero-decision-blocked priority in this continuation's own Phase 5 ordering | The rest of the original SEC-001 recommended solution (CI wiring, RLS tests, route-handler tests) | See `MARKETPLACE_REMEDIATION_REGISTER.md` SEC-001 for full detail | `npx vitest run` (unit tier); live `execute_sql` rollback-safe transactions (DB-invariant tier) | P0 |

## 3. Items from the prior register still fully open, unchanged by this pass

Not re-litigated in full here — the register (`MARKETPLACE_REMEDIATION_REGISTER.md`)
remains the authoritative source. Confirmed this pass to still be accurately
"Not started": TSF-001 through TSF-014 (trust & safety), PROV-001..006,
LIQ-001..006, PAY-001/002/003/004/006/007/008/010, OPS-001..008,
DR-001..005, ANALYTICS-001..006, LOADTEST-001..003, SEC-001..006/008..012,
NOTIF-001..004, MOBILE-001..005, REL-001..004, LEGAL-001..008. None of
these were touched by the prior implementation pass (which was explicitly
scoped to scale/performance, not trust-and-safety or payments-completeness)
and none were touched by this pass's own implementation work (§4 below) —
stated here so their absence from this table isn't mistaken for having been
closed.

## 4. Corrections made to existing documents this pass

1. `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` — corrected §1's state
   diagram and RPC table to reflect the real 21-value `txn_state` enum and
   the now-confirmed lock discipline on `rpc_provider_check_in`/
   `rpc_submit_completion`.
2. `MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md` — corrected §2.5
   (`rpc_cancel_booking`) from "Investigating" to a definite finding, and
   corrected the false claim that no refund payment-state exists.
3. `MARKETPLACE_REMEDIATION_REGISTER.md` — TXN-003 downgraded (2 of 5 RPCs
   now confirmed lock-safe), TXN-005 upgraded from Investigating to
   Confirmed-not-fixed, PAY-009 upgraded from Investigating to a definite
   finding (refund path exists for pre-check-in cancellation only, no
   post-check-in or partial path), new item REG-002 added.

## 5. Priority-ordered remaining gaps (this pass's own recommendation)

Given the live evidence gathered this pass — zero real transactions,
zero scheduler runs, zero rate-limit-bucket rows, no confirmed Vercel
access to the actual `flerwa` project — the single highest-leverage next
action is **not** further feature work; it is **closing the deployment-
visibility gap** (confirming `CRON_SECRET`/Cron registration on the actual
project) since every other "fixed but not verified in production" item in
§2 depends on that same missing piece of information. Everything else in
this table is secondary to that one blocker.

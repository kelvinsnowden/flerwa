# Marketplace Remediation Register

Every item below uses evidence tags defined in
`MARKETPLACE_REMEDIATION_MASTER_PLAN.md` §1. **No item is marked
Implemented or Verified without a specific citation.** Status definitions
match the originating brief exactly: Not started, Investigating, Planned, In
progress, Blocked, Implemented, Verified, Accepted. "Implemented" means code
exists; "Verified" means it was tested (live DB check, role simulation, or
an automated test) and the test passed; a status of Implemented without a
Verified follow-up is a known, stated risk, not a claim of completeness.

## Index

| ID | Title | Domain | Severity | Status |
|---|---|---|---|---|
| SEC-001 | No automated regression suite for financial/authz logic | Security | P0 | **In progress — tier 1 DB harness + tier 2 server-action tests added 2026-09-15** |
| SEC-002 | Storage buckets have no malware/content scanning | Security | P0 | Not started |
| SEC-003 | No dependency-vulnerability scanning in CI | Security | P1 | Not started |
| SEC-004 | No security headers configured | Security | P2 | Not started |
| SEC-005 | Admin routes have no audit-log UI (data exists, no viewer) | Security | P1 | Not started |
| SEC-006 | No secret-rotation procedure documented | Security | P1 | Not started |
| SEC-007 | RLS optimization incomplete for ~25 of ~29 tables | Security/Performance | P2 | Planned |
| SEC-008 | No brute-force protection beyond Supabase Auth defaults | Security | P1 | Not started |
| SEC-009 | Webhook endpoints have no replay-window enforcement | Security | P1 | Not started |
| SEC-010 | No PII redaction in server logs | Security | P1 | Not started |
| SEC-011 | No CSP or frame-ancestors header | Security | P2 | Not started |
| SEC-012 | Identity documents lack a defined retention/deletion policy | Security/Legal | P0 | Not started |
| SEC-013 | `_execute_*` dual-control functions had default PUBLIC EXECUTE grant — anon could bypass admin check + dual control entirely | Security | **P0 — critical** | **Resolved 2026-09-15** |
| PAY-001 | No real payment aggregator connected — `manual` only | Payments | P1 | Not started |
| PAY-002 | Payment-provider-timeout handling never exercised | Payments | P2 | Not started |
| PAY-003 | No reconciliation job against aggregator settlement | Payments | P0 | Not started |
| PAY-004 | No dual-control on `rpc_confirm_manual_payment` | Payments | P0 | **Resolved 2026-09-15** |
| PAY-005 | No prorated-payment path for partial completion | Payments | P1 | Not started |
| PAY-006 | Ledger self-consistency is never asserted by a job | Payments | P0 | **Verified** |
| PAY-007 | Flat 12% fee in code does not match `docs/10`'s vertical model | Payments | P1 | **Resolved 2026-09-14** |
| PAY-008 | No overpayment/underpayment handling path | Payments | P1 | Not started |
| PAY-009 | No refund RPC independent of dispute resolution | Payments | P1 | **Investigation closed — see below** |
| PAY-010 | No payout-detail-change hold (`docs/07`'s 24h re-verification rule) | Payments/Security | P1 | Not started |
| TXN-001 | `rpc_submit_quote`/`rpc_accept_quote` have no idempotency key | Transactions | P1 | Not started |
| TXN-002 | `rpc_start_conversation` has no idempotency key | Transactions | P2 | Not started |
| TXN-003 | No lock audit performed on 5 state-transition RPCs | Transactions | P2 | **Resolved 2026-09-15 — 5 of 5 confirmed** |
| TXN-004 | Disputes have no deadline/time-bound field | Transactions | P0 | **Resolved 2026-09-15** |
| TXN-005 | No cancellation-fee enforcement (`docs/07`'s <24h/after-check-in rules) | Transactions | P1 | **Resolved 2026-09-15** |
| TXN-006 | No customer-unreachable / repeat-non-funding penalty | Transactions | P2 | Not started |
| TXN-007 | No provider no-show detection or suspension trigger | Transactions | P1 | Not started |
| TXN-008 | Quote expiry not enforced | Transactions | P2 | Not started |
| TXN-009 | Booking expiry (unfunded `requested` transactions) never swept | Transactions | P2 | Not started |
| TXN-010 | No admin general-purpose transaction repair tool | Transactions/Ops | P0 | **Resolved 2026-09-15** |
| TXN-013 | `_execute_refund` never reversed `materials_held` — money stuck permanently on any disputed transaction with materials | Transactions/Payments | P0 | **Resolved 2026-09-15** |
| TXN-011 | Recurring/per-occurrence escrow model not implemented | Transactions/Payments | P2 | **Resolved 2026-09-14** |
| TXN-012 | Milestone payment structure (`docs/07`'s >KSh 25k rule) not implemented | Transactions/Payments | P2 | **Resolved 2026-09-14** |
| TSF-001 | No enforcement that evidence capture is in-app only | Trust & Safety | P0 | Not started |
| TSF-002 | No geotagging/timestamp verification on evidence uploads | Trust & Safety | P1 | Not started |
| TSF-003 | No perceptual-duplicate detection on uploaded evidence | Trust & Safety | P1 | Not started |
| TSF-004 | No conflict-of-interest declaration field/flow | Trust & Safety | P0 | Not started |
| TSF-005 | No dual-coverage (second inspector) mechanism for high-value jobs | Trust & Safety | P1 | Not started |
| TSF-006 | No outcome-follow-up mechanism (30–60 day post-job check) | Trust & Safety | P2 | Not started |
| TSF-007 | No report/flag mechanism on messages, reviews, or profiles | Trust & Safety | P0 | **Resolved** |
| TSF-008 | No moderation queue or admin abuse-review workflow | Trust & Safety | P1 | Partially addressed — see TSF-007 |
| TSF-009 | No risk-scoring or suspicious-behavior signal pipeline | Trust & Safety | P1 | Not started |
| TSF-010 | No account/transaction velocity limits beyond the 5 rate-limited actions | Trust & Safety | P1 | Not started |
| TSF-011 | No provider-safety opt-in/decline mechanism | Trust & Safety | P1 | Not started |
| TSF-012 | No emergency/safety-incident escalation path in-app | Trust & Safety | P0 | Not started |
| TSF-013 | No written incident-response protocol | Trust & Safety | P0 | Not started |
| TSF-014 | No emergency category/provider/customer pause control | Trust & Safety | P0 | Not started |
| PROV-001 | Verification is one flat status, not the tiered (0–3) model in `docs/06` | Provider Quality | P1 | Not started |
| PROV-002 | No category-specific competence-assessment mechanism | Provider Quality | P1 | Not started |
| PROV-003 | No provider-suspension-for-cause automated trigger | Provider Quality | P1 | Not started |
| PROV-004 | No provider-appeal workflow | Provider Quality | P2 | Not started |
| PROV-005 | No new-account-after-ban detection | Provider Quality | P2 | Not started |
| PROV-006 | No "New — platform guaranteed" cold-start mechanism | Provider Quality/Liquidity | P2 | Not started |
| LIQ-001 | No liquidity metrics instrumented (`docs/13`'s full list) | Liquidity | P0 | Not started |
| LIQ-002 | No matching/ranking algorithm — implicit query order only | Liquidity | P1 | Not started |
| LIQ-003 | No zero-quote-request fallback (waitlist/callback) | Liquidity | P1 | Not started |
| LIQ-004 | No category/area launch-gating control | Liquidity | P1 | Not started |
| LIQ-005 | No provider-overexposure / workload-cap tracking | Liquidity | P2 | Not started |
| LIQ-006 | Zero published providers on production (supply gap, not code) | Liquidity | P0 (business) | Not started |
| MSG-001 | Messages: malicious-file-upload path not implemented (no attachments exist yet) | Messaging | P2 | Not started |
| MSG-002 | No message-level report/block mechanism | Messaging | P1 | Not started |
| MSG-003 | No Realtime-degraded fallback UX (no live indicator if socket fails) | Messaging | P2 | Not started |
| MSG-004 | No message retention/archival policy | Messaging | P3 | Not started |
| MSG-005 | Realtime connection-limit behavior unverified | Messaging | P2 | Blocked — external access |
| NOTIF-001 | No email notification channel at all | Notifications | P1 | Not started |
| NOTIF-002 | No SMS/WhatsApp notification channel connected | Notifications | P2 | Not started |
| NOTIF-003 | No notification-delivery-failure handling (critical actions never blocked, confirmed) | Notifications | P2 (confirmed safe) | Verified |
| NOTIF-004 | No user notification preferences/opt-out | Notifications | P2 | Not started |
| MOBILE-001 | No explicit "unknown/awaiting confirmation" UI state for payments | Mobile/PWA | P1 | Not started |
| MOBILE-002 | No PWA manifest/offline-shell verified | Mobile/PWA | P2 | Not confirmed |
| MOBILE-003 | No low-end-device/slow-network testing performed | Mobile/PWA | P2 | Not started |
| MOBILE-004 | No accessibility audit performed | Mobile/PWA | P2 | Not started |
| MOBILE-005 | Booking-form idempotency key covers double-submit; STK-push app-switch scenario untested | Mobile/PWA | P2 | Not started |
| LEGAL-001 | PSP-status legal opinion not commissioned | Legal | P0 | Requires legal review |
| LEGAL-002 | Contractor-classification opinion not commissioned | Legal | P0 | Requires legal review |
| LEGAL-003 | Property-representation regulatory opinion not commissioned | Legal | P0 | Requires legal review |
| LEGAL-004 | ODPC registration status unknown | Legal | P0 | Requires business decision |
| LEGAL-005 | No published privacy notice / terms / provider agreement | Legal | P0 | Requires legal review |
| LEGAL-006 | No public liability / professional indemnity insurance confirmed | Legal | P0 | Requires business decision |
| LEGAL-007 | Data retention periods not defined anywhere in code or policy | Legal | P1 | Requires business decision |
| LEGAL-008 | Tax treatment (withholding, VAT) by service type not resolved | Legal | P1 | Requires legal review |
| OPS-001 | No admin single-pane transaction-detail view | Ops/Support | P0 | **Resolved — confirmed pre-existing 2026-09-15** |
| OPS-002 | No safe transaction-repair tool beyond 2 narrow RPCs | Ops/Support | P0 | **Resolved 2026-09-15** |
| OPS-003 | No support/fraud/verification queue triage UI beyond `/admin/verifications` | Ops/Support | P1 | Not started |
| OPS-004 | No role-based admin access — `is_admin()` is all-or-nothing | Ops/Support | P1 | Not started |
| OPS-005 | No two-person approval for financial/ban actions | Ops/Support | P0 | **Resolved — via PAY-004/GOV-P4** |
| OPS-006 | No SLA timers or escalation on admin queues | Ops/Support | P2 | Not started |
| OPS-007 | No internal-notes/assignment mechanism on disputes or verifications | Ops/Support | P2 | Not started |
| OPS-008 | No customer-visible communication-history view for support | Ops/Support | P2 | Not started |
| DR-001 | No backup-restore has ever been tested | Disaster Recovery | P0 | Not started |
| DR-002 | No RPO/RTO defined | Disaster Recovery | P1 | Not started |
| DR-003 | No documented outage runbook for Supabase/Vercel/payment-provider outages | Disaster Recovery | P1 | Not started |
| DR-004 | No read-only/degraded-mode capability | Disaster Recovery | P2 | Not started |
| DR-005 | No post-incident-review process defined | Disaster Recovery | P2 | Not started |
| REL-001 | No documented release checklist | Release Engineering | P1 | Not started |
| REL-002 | No staging environment exists | Release Engineering | P0 | Not started |
| REL-003 | No smoke-test suite run post-deploy | Release Engineering | P1 | Not started |
| REL-004 | No feature-flag mechanism | Release Engineering | P2 | Not started |
| ANALYTICS-001 | No event-tracking pipeline for customer/provider funnels | Analytics | P1 | Not started |
| ANALYTICS-002 | No marketplace-health dashboard | Analytics | P1 | Not started |
| ANALYTICS-003 | No technical-health (p50/p95/p99, error rate) dashboard | Analytics | P1 | Not started |
| ANALYTICS-004 | No cost-to-serve / contribution-per-job computation | Analytics | P1 | Not started |
| ANALYTICS-005 | No category-level contribution-margin reporting | Analytics | P2 | Not started |
| ANALYTICS-006 | GMV/materials-pass-through separation exists in code comments only, not a dashboard | Analytics | P2 | Not started |
| LOADTEST-001 | No staging environment for load testing | Load Testing | P0 | Not started |
| LOADTEST-002 | No load test at any scale has ever been executed | Load Testing | P0 | Not started |
| LOADTEST-003 | No concurrency test proving no duplicate financial outcomes under real parallel load | Load Testing | P1 | Not started |
| PERF-001 | Infra plan limits (Supabase/Vercel) unconfirmed | Performance | P1 | Blocked — external access |
| PERF-002 | Real cross-session advisory-lock contention never independently verified | Performance | P2 | Not started |
| REG-002 | 18 local migration filenames didn't match their applied remote version | Release Engineering | P2 | **Fixed and verified** |

## Detail

Format per item: Domain/Subdomain, Problem, Why it matters, Current state,
Evidence, Severity, Affected users, Affected components, Failure scenario,
Business/Security/Financial/Trust/Operational impact, Recommended solution,
Implementation tasks (DB/Backend/Frontend/Admin/Docs/External config), Test
cases, Monitoring, Rollback, Dependencies, Owner, Complexity, Definition of
done, Evidence required for closure, Status.

---

### SEC-001 — No automated regression suite for financial/authorization logic

- **Domain/Subdomain:** Security / Testing
- **Problem:** `package.json` has no test-runner dependency (confirmed across three separate sessions). Every "verified" claim in this project's history — RLS checks, idempotency checks, grant checks — is a one-time manual role-simulated SQL transaction or a live click-through, never re-run automatically.
- **Why it matters:** a future change (a migration, a refactor, a dependency bump) can silently reintroduce any previously-fixed bug (self-escalation, grant leakage, double-funding) with nothing to catch it before it reaches production.
- **Current state:** Missing entirely.
- **Evidence:** Confirmed (code) — `grep -l "test"` against `package.json` scripts returns nothing; `MARKETPLACE_SCALE_READINESS_AUDIT.md`, `SECURITY.md`, and `MARKETPLACE_UX_AUDIT.md` all independently state "no automated tests exist."
- **Severity:** P0
- **Affected users:** All — this is a systemic risk, not user-facing directly.
- **Affected components:** Every RPC, every RLS policy, every route handler.
- **Failure scenario:** A future migration accidentally drops the `messages` RLS consolidation's `sender_id <> auth.uid()` clause on the mark-read policy; nothing fails until a user reports being able to mark their own message read, or worse, until it's exploited silently.
- **Business impact:** High — trust is the entire product; a silent regression discovered by a user is a trust event.
- **Security impact:** Critical — this is the single biggest lever on every other security finding's durability.
- **Financial impact:** Indirect but severe if a payment/idempotency regression slips through.
- **Trust impact:** Severe if discovered publicly.
- **Operational impact:** High engineering cost avoided long-term; moderate cost to build.
- **Recommended solution:** Stand up a test runner (Vitest or Jest) with three tiers: (1) DB/RLS tests using role-simulated SQL against a disposable branch/local Postgres, converting every existing manual verification in `SECURITY.md`/audit docs into an executable test; (2) route-handler/server-action unit tests with a mocked Supabase client; (3) a small number of true end-to-end tests against a staging environment (depends on REL-002).
- **Implementation tasks:**
  - *DB changes:* none directly; requires a disposable test database (Supabase local dev stack or a branch).
  - *Backend/API changes:* none to production code; new `tests/` directory.
  - *Frontend changes:* none.
  - *Admin/ops changes:* CI pipeline (GitHub Actions or Vercel's own) to run tests on every PR.
  - *Documentation:* a `TESTING.md` describing how to run tests locally and in CI.
  - *External config:* CI provider access (GitHub Actions is free for public/private repos on reasonable limits — confirm plan).
- **Test cases:** Re-implement every "Verified" row from `SECURITY.md`'s tables (9 messaging checks, 5 saved-provider checks, 4 trust-guard checks, 9 dispute/deal-desk checks, 3 evidence/review checks) as executable tests, plus the idempotency/RLS checks from `MARKETPLACE_SCALE_READINESS_AUDIT.md` §14.
- **Monitoring required:** CI status visible on every PR; a failing test blocks merge.
- **Rollback plan:** N/A — additive only.
- **Dependencies:** none blocking; benefits from REL-002 (staging) for the E2E tier.
- **Suggested owner:** Engineering lead.
- **Estimated complexity:** Large (multi-week, but incremental — can ship tier 1 alone as a first milestone).
- **Definition of done:** CI runs on every PR; at minimum every RPC listed under "financial/authorization logic" in `SECURITY.md` has a passing test for both the authorized and unauthorized path.
- **Evidence required for closure:** A CI run log showing all tests passing, linked in this register entry.
- **Status:** Not started.

---

### SEC-002 — Storage buckets have no malware/content scanning

- **Domain/Subdomain:** Security / File handling
- **Problem:** `provider-documents` and `transaction-evidence` buckets enforce MIME-type allowlist and file-size limits at the bucket level (Confirmed, code: `supabase/migrations/20260908135437_storage_buckets.sql`) but nothing scans uploaded content for malware, embedded exploits (e.g. a polyglot PDF/image), or CSAM.
- **Why it matters:** identity documents and evidence photos/videos are exactly the kind of upload a malicious actor would target; a compromised file served back to another party (an admin reviewing verification, or a customer viewing evidence) is a real attack vector.
- **Current state:** MIME/size limits only.
- **Evidence:** Confirmed (code) — bucket policies read directly; no scanning step exists anywhere in the upload path (`src/app/provider/apply/actions.ts`, `src/app/provider/jobs/[id]/actions.ts`'s `recordEvidence`).
- **Severity:** P0
- **Affected users:** Anyone viewing an uploaded file — admins reviewing verification documents, transaction participants viewing evidence.
- **Affected components:** `provider-documents`, `transaction-evidence`, `provider-portfolio` (if publicly readable) buckets.
- **Failure scenario:** A malicious provider uploads a crafted "ID document" that exploits a PDF viewer used by an admin reviewing the verification queue.
- **Business impact:** High — a compromised admin workstation cascades into full platform compromise.
- **Security impact:** Critical.
- **Financial impact:** Indirect (breach response cost).
- **Trust impact:** Severe if exploited and disclosed.
- **Operational impact:** Moderate to add; low to run (most scanning services are cheap at this volume).
- **Recommended solution:** Add a scanning step (ClamAV via a Supabase Edge Function trigger on upload, or a third-party API like VirusTotal/Google Cloud's Web Risk for the smaller scale here) that quarantines a file pending scan and only marks it "clean" before it becomes viewable.
- **Implementation tasks:**
  - *DB:* add a `scan_status` column (`pending|clean|flagged`) to `transaction_evidence` and a parallel mechanism for provider documents; RLS on read must additionally require `scan_status = 'clean'` (except for the uploader themselves and admins, who may need to see a pending/flagged file for review).
  - *Backend:* an Edge Function or webhook triggered on Storage object creation, calling the scanning service, updating `scan_status`.
  - *Frontend:* a "Scanning..." state in the evidence/document upload UI.
  - *Admin:* a flagged-file review queue.
  - *Docs:* update `SECURITY.md`'s Storage section.
  - *External config:* a scanning vendor account.
- **Test cases:** Upload the EICAR test file; upload a clean file; confirm RLS blocks a non-uploader/non-admin from viewing a `pending`/`flagged` file.
- **Monitoring:** Alert on any `flagged` result.
- **Rollback plan:** Feature-flaggable; disabling reverts to current (unscanned) behavior — document this is a known regression if disabled.
- **Dependencies:** none.
- **Suggested owner:** Security engineer / backend.
- **Estimated complexity:** Medium.
- **Definition of done:** Every new upload to the two private buckets passes through scanning before becoming visible to anyone other than the uploader/admin.
- **Evidence required for closure:** A test showing EICAR is flagged and blocked; a live upload showing a clean file becomes visible only after `scan_status='clean'`.
- **Status:** Not started.

---

### SEC-003 — No dependency-vulnerability scanning in CI

- **Domain/Subdomain:** Security / Supply chain
- **Problem:** no `npm audit`/Dependabot/Snyk step exists in any CI pipeline (no CI pipeline exists at all beyond Vercel's build — Confirmed, code: no `.github/workflows/` directory found).
- **Why it matters:** a known-vulnerable transitive dependency (Next.js, Supabase SDKs, etc.) can sit unpatched indefinitely.
- **Current state:** Missing.
- **Evidence:** Confirmed (code) — no workflow files, no `.github` directory.
- **Severity:** P1
- **Affected users:** All, indirectly.
- **Affected components:** Entire dependency tree.
- **Failure scenario:** A CVE in a Next.js middleware/auth-adjacent package goes unpatched for months.
- **Business/Security/Financial/Trust/Operational impact:** Moderate individually; compounds over time.
- **Recommended solution:** Enable GitHub's Dependabot (free) for security updates at minimum; add `npm audit --audit-level=high` as a CI gate.
- **Implementation tasks:** *Admin/ops:* enable Dependabot in repo settings; add a CI workflow file.
- **Test cases:** Confirm a deliberately-downgraded vulnerable package triggers a Dependabot alert (can be checked against Dependabot's own historical alerts once enabled, no need to manufacture one).
- **Monitoring:** Dependabot alerts feed.
- **Rollback:** N/A.
- **Dependencies:** GitHub repo admin access.
- **Owner:** Engineering lead.
- **Complexity:** Small.
- **Definition of done:** Dependabot active; CI blocks on high/critical `npm audit` findings.
- **Evidence required for closure:** Screenshot/link of Dependabot enabled + one clean CI run with the audit gate active.
- **Status:** Not started.

---

### SEC-004 — No security headers configured

- **Domain/Subdomain:** Security / Web hardening
- **Problem:** no `next.config.ts` headers configuration for `Strict-Transport-Security`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` was found.
- **Evidence:** Confirmed (code) — `next.config.ts` read; no `headers()` export present.
- **Severity:** P2
- **Recommended solution:** Add a `headers()` function in `next.config.ts` for the standard secure-defaults set (Vercel applies some defaults, but not all — verify which via a live response-header check once deployed, **Not confirmed** which Vercel supplies by default for this project).
- **Implementation tasks:** *Frontend/config:* one `next.config.ts` change.
- **Test cases:** `curl -I` the production URL and confirm headers present.
- **Owner:** Frontend/security.
- **Complexity:** Small.
- **Definition of done:** All 4 headers present on every response.
- **Evidence required for closure:** A `curl -I` output attached showing the headers.
- **Status:** Not started.

---

### SEC-005 — Admin routes have no audit-log UI

- **Domain/Subdomain:** Security / Admin ops
- **Problem:** `admin_actions` table exists and is written to by admin RPCs (Confirmed, code: `rpc_resolve_dispute`, `rpc_convert_deal_desk_request`, `rpc_set_active_payment_provider` all insert into it), but no admin page renders it.
- **Why it matters:** the audit trail exists but is unusable without direct DB access, defeating its own purpose for day-to-day accountability.
- **Severity:** P1
- **Recommended solution:** Build `/admin/audit-log` — searchable, filterable by admin, action type, date range, target.
- **Implementation tasks:** *Frontend:* new admin page. *Backend:* none (table exists). *DB:* consider adding an index on `admin_actions(admin_id, created_at)` if not present (**Not confirmed** whether this index exists — verify before building the page).
- **Test cases:** Every admin RPC call in a test run appears correctly in the new view.
- **Owner:** Engineering (admin surface owner).
- **Complexity:** Small–Medium.
- **Definition of done:** Every admin action taken through the app is visible, searchable, in this view within 5 minutes.
- **Evidence required for closure:** Screenshot of the page showing real entries from a test session.
- **Status:** Not started.

---

### SEC-006 — No secret-rotation procedure documented

- **Domain/Subdomain:** Security / Operations
- **Problem:** `.env.example` documents which secrets exist (`SUPABASE_SERVICE_ROLE_KEY`, `INTASEND_*`, `CRON_SECRET`, `KORA_SECRET_KEY`) but there is no written procedure for rotating any of them if compromised.
- **Severity:** P1
- **Recommended solution:** Write a runbook (part of `MARKETPLACE_DISASTER_RECOVERY_PLAN.md`) covering: how to rotate the Supabase service-role key without downtime, how to rotate `CRON_SECRET` (update Vercel env var + redeploy), how to rotate payment-provider keys.
- **Owner:** DevOps/founder (whoever holds dashboard access).
- **Complexity:** Small (documentation only).
- **Definition of done:** A written runbook exists and has been dry-run at least once for the lowest-risk secret (`CRON_SECRET`).
- **Evidence required for closure:** The runbook document + a record of the dry run.
- **Status:** Not started.

---

### SEC-007 — RLS optimization incomplete for ~25 of ~29 tables

- **Domain/Subdomain:** Security / Performance
- **Problem:** the prior session's RLS performance pass fixed `auth_rls_initplan` and `multiple_permissive_policies` only for `messages` and the 3 shared predicate functions (`is_admin`, `is_txn_participant`, `is_conversation_participant`). A fresh advisor run (cited) still shows 29 `auth_rls_initplan` and ~90 `multiple_permissive_policies` findings across the remaining tables.
- **Evidence:** Confirmed (live DB, prior session) — `MARKETPLACE_SCALE_READINESS_AUDIT.md` §14 table, explicitly listed as "Partially fixed."
- **Severity:** P2 (performance, not a security hole — these are advisor perf warnings, not authorization gaps).
- **Recommended solution:** Table-by-table pass, same methodology as the `messages` fix: read each policy's exact semantics, wrap `auth.uid()`/`current_setting()` calls, consolidate genuinely-disjoint permissive policies, role-simulate before/after equivalence for each table before committing.
- **Implementation tasks:** *DB:* ~25 migrations, one per table or grouped logically. *Docs:* update the audit doc's status table per table fixed.
- **Test cases:** Role-simulated before/after equivalence per table (same pattern already proven for `messages`).
- **Dependencies:** SEC-001 (a test suite would make this much safer to do at scale).
- **Owner:** Backend/DB engineer.
- **Complexity:** Large (many small, low-risk changes).
- **Definition of done:** Fresh advisor run shows 0 `auth_rls_initplan` and `multiple_permissive_policies` findings, or each remaining one is explicitly justified in writing (e.g., genuinely overlapping policies that can't be safely merged).
- **Evidence required for closure:** Advisor output before/after.
- **Status:** Planned.

---

### SEC-008 — No brute-force protection beyond Supabase Auth defaults

- **Domain/Subdomain:** Security / Auth
- **Problem:** login (`src/app/login/actions.ts`) has no application-level rate limit; relies entirely on whatever Supabase Auth's own (unconfirmed) defaults are.
- **Evidence:** Confirmed (code) — `login()` has no `checkRateLimit` call, unlike `signup()` which was rate-limited in the prior session. Supabase's own limits: **Not confirmed** (Blocked — external access, dashboard).
- **Severity:** P1
- **Recommended solution:** Add `checkRateLimit("login", {...})` to the login action using the existing `src/lib/rate-limit.ts` infrastructure (already built, proven, and used elsewhere this session) — small, low-risk addition.
- **Implementation tasks:** *Backend:* one function call added to `login()`. *DB:* none (reuses `rpc_check_rate_limit`).
- **Test cases:** N failed logins within a window correctly rejects the N+1th attempt (mirror the pattern already verified for `rpc_check_rate_limit` in the prior session).
- **Owner:** Backend.
- **Complexity:** Small.
- **Definition of done:** Login rate-limited per the same pattern as the other 5 actions.
- **Evidence required for closure:** A test/live check showing the limit triggers.
- **Status:** Not started.

---

### SEC-009 — Webhook endpoints have no replay-window enforcement

- **Domain/Subdomain:** Security / Payments
- **Problem:** `src/app/api/webhooks/payments/route.ts` verifies IntaSend's shared-secret "challenge" string but does not check the payload's own timestamp against a replay window — a captured, valid webhook payload could in principle be replayed indefinitely.
- **Evidence:** Confirmed (code) — `verifyWebhookSignature` in `src/lib/payments/adapters/intasend.ts` does a constant-time string compare only, no timestamp/nonce check.
- **Severity:** P1 — mitigated significantly by the idempotency work already done (a replay of an already-processed event is a safe no-op per `rpc_ingest_payment_event`'s dedupe key), but a replay of a *not-yet-processed* pending event outside its real window is not specifically blocked.
- **Recommended solution:** If/when IntaSend's real webhook payload includes a timestamp, reject anything older than a defined window (e.g. 5 minutes) before it reaches `rpc_ingest_payment_event` at all.
- **Dependencies:** PAY-001 (no live aggregator connected yet — this can't be fully implemented/tested until then).
- **Owner:** Backend/payments.
- **Complexity:** Small once a real payload shape is confirmed.
- **Definition of done:** Old/replayed webhook payloads are rejected before processing, with a test using a synthetic old-timestamp payload.
- **Status:** Not started.

---

### SEC-010 — No PII redaction in server logs

- **Domain/Subdomain:** Security / Privacy
- **Problem:** `console.log`/`console.error` calls throughout the codebase (cron route, health route, rate-limit helper) log structured JSON that could include identifiers; not independently audited this pass for whether any log line includes a phone number, email, or ID number.
- **Evidence:** Not confirmed — flagged for review, not verified either way.
- **Severity:** P1
- **Recommended solution:** Grep every `console.log`/`console.error` call for interpolated user data; establish a lint rule or code-review checklist item forbidding logging raw PII (log user IDs, not emails/phones/names).
- **Owner:** Backend.
- **Complexity:** Small–Medium (audit + fixes).
- **Definition of done:** A documented pass confirms no log statement includes raw PII; going forward, a code-review checklist item enforces it.
- **Status:** Not started.

---

### SEC-011 — No CSP or frame-ancestors header

Folded into SEC-004's implementation (same `next.config.ts` change) — kept as
a separate line item because CSP requires its own careful allowlist design
(inline styles/scripts used by the app must be accounted for) and is
materially more work than the other headers.

- **Severity:** P2. **Owner:** Frontend. **Complexity:** Medium. **Status:** Not started.

---

### SEC-012 — Identity documents lack a defined retention/deletion policy

- **Domain/Subdomain:** Security / Legal / Privacy
- **Problem:** `provider-documents` bucket and `providers.national_id_number` column store real identity data indefinitely — no code path deletes or expires either.
- **Evidence:** Confirmed (code) — no deletion job, no TTL, no `retention_until` column exists anywhere in the schema.
- **Severity:** P0 — this is both a security and a Kenya Data Protection Act compliance gap (`docs/14` names this exact risk).
- **Recommended solution:** Requires a **business/legal decision first** (how long must ID documents be retained, and under what lawful basis) before engineering can build the deletion job — see `LEGAL-007`.
- **Dependencies:** LEGAL-007 (retention period must be decided before this can be implemented).
- **Owner:** Legal decision owner, then backend.
- **Complexity:** Small once the retention period is decided.
- **Status:** Not started. Requires business/legal decision.

---

### SEC-013 — `_execute_*` dual-control functions had default PUBLIC EXECUTE grant

- **Domain/Subdomain:** Security / Authorization
- **Problem:** `20260914120200_dual_control_approvals.sql` (the migration that built the GOV-P4 dual-control mechanism for refund/suspend_customer/suspend_provider/category_pause) has a comment stating "Deliberately no grants on any `_execute_*` function to anon/authenticated — only reachable through `rpc_decide_admin_action`'s own SECURITY DEFINER call chain" — but that migration never actually executed a `revoke`. PostgreSQL grants `EXECUTE` to `PUBLIC` by default on every newly created function, and `anon`/`authenticated` both inherit from `PUBLIC` implicitly. The result: `_execute_refund`, `_execute_suspend_customer`, `_execute_suspend_provider`, and `_execute_category_pause` — each of which trusts entirely that it is only reached through `rpc_decide_admin_action`'s own permission and self-decide checks, and performs **zero internal authorization check of its own** — were directly callable by anyone via `POST /rest/v1/rpc/_execute_refund` etc., **including unauthenticated (`anon`) requests**, completely bypassing both the `is_admin()`/role check and the entire two-person-approval mechanism those functions exist to enforce.
- **Evidence:** Confirmed live, before the fix — `select has_function_privilege('anon', '_execute_refund(jsonb)', 'EXECUTE')` returned `true` for all four functions, for both `anon` and `authenticated`. Confirmed by `mcp__Supabase__get_advisors(type:"security")` independently flagging all four under `anon_security_definer_function_executable` / `authenticated_security_definer_function_executable`.
- **Severity:** P0 — critical. An unauthenticated caller could have issued an arbitrary refund on any dispute (`_execute_refund`, taking `dispute_id`/`provider_minor`/`customer_refund_minor`/`resolution` straight from the request body), suspended or reinstated any customer or provider account, or paused/resumed any category — with no login, no admin check, and no second approver.
- **Failure scenario:** `curl -X POST .../rest/v1/rpc/_execute_refund -d '{"p": {"dispute_id": "<any open dispute>", "provider_minor": 0, "customer_refund_minor": <full amount>, "resolution": "..."}}'` with no `Authorization` header at all, issued by anyone who found the endpoint (e.g. from the advisor output, or generic Supabase RPC enumeration).
- **How it was found:** Discovered as a side effect of PAY-004 — the newly added `_execute_confirm_manual_payment` was given its `revoke all ... from public, anon, authenticated` explicitly, and the resulting advisor diff made the absence of an equivalent revoke on the four pre-existing functions visible immediately by contrast.
- **Fix:** `supabase/migrations/20260915090200_fix_execute_admin_action_functions_public_grant.sql` — `revoke all on function _execute_refund(jsonb), _execute_suspend_customer(jsonb), _execute_suspend_provider(jsonb), _execute_category_pause(jsonb) from public, anon, authenticated;`. The legitimate call path (`rpc_decide_admin_action` → `perform _execute_*(...)`) is unaffected: a `SECURITY DEFINER` function executes nested calls with the *owner's* privileges regardless of the invoking role's own grants, which is exactly the mechanism the original migration's comment described — it just never installed the revoke needed to close the direct path.
- **Verified:** live re-check of `has_function_privilege()` for all four functions (plus the new `_execute_confirm_manual_payment`) against both `anon` and `authenticated` now returns `false` uniformly; a fresh advisor run shows the count of `SECURITY DEFINER`-executable-by-`anon`/`authenticated` findings dropping (21→17 anon, 67→63 authenticated) with no new class of finding introduced.
- **Owner:** Backend/security.
- **Complexity:** Trivial fix once found (4 `revoke` statements) — the finding itself required noticing an absence, not an error message.
- **Status:** Resolved 2026-09-15.

---

### PAY-001 — No real payment aggregator connected

- **Domain/Subdomain:** Payments
- **Problem:** `payment_providers` has only `key='manual'` active; IntaSend/Kora adapters exist in code but require real credentials not present in this environment.
- **Evidence:** Confirmed (code) — `.env.example`, `src/lib/payments/adapters/intasend.ts`.
- **Severity:** P1 (not P0 — the platform can operate, awkwardly, on manual confirmation; but this blocks real scale).
- **Recommended solution:** Business decision on which aggregator, then a real account + credentials + go-live process with IntaSend (static-IP/webhook whitelisting per `docs/07` — resolved by using an aggregator rather than direct Daraja, which is the current design).
- **Dependencies:** LEGAL-001 (PSP-status opinion should be resolved or at least in progress before connecting a real money-moving rail).
- **Owner:** Founder/payments owner.
- **Status:** Not started. Requires business decision + external access.

---

### PAY-002 — Payment-provider-timeout handling never exercised

- **Domain/Subdomain:** Payments
- **Problem:** the code path exists (`processing_error` field, guard checks) but has never processed a real timeout because no live traffic exists.
- **Severity:** P2.
- **Recommended solution:** Once PAY-001 is resolved, test against IntaSend's sandbox with a deliberately-delayed/failed collection.
- **Dependencies:** PAY-001.
- **Status:** Not started.

---

### PAY-003 — No reconciliation job against aggregator settlement

- **Domain/Subdomain:** Payments
- **Problem:** `docs/07`'s non-negotiable rule #6 ("double-entry ledger, reconciled daily against the aggregator, owned by a named person") has no implementation — no job compares `ledger_entries` totals against any external settlement report, because there is no external settlement yet.
- **Severity:** P0 (must exist before real money moves, not after).
- **Recommended solution:** Build a scheduled job (same cron infrastructure already proven for the auto-approve sweep) that, once an aggregator is connected, pulls settlement data and diffs it against `ledger_entries`, writing exceptions to a new `reconciliation_exceptions` table for admin review.
- **Implementation tasks:** *DB:* new `reconciliation_exceptions` table. *Backend:* new cron route, following the exact pattern of `src/app/api/cron/auto-approve-sweep/route.ts` (fails closed without a secret, logs structured JSON, records a run). *Admin:* an exceptions queue.
- **Dependencies:** PAY-001.
- **Owner:** Backend/finance.
- **Complexity:** Medium.
- **Status:** Not started.

---

### PAY-004 — No dual-control on `rpc_confirm_manual_payment`

- **Domain/Subdomain:** Payments / Security
- **Problem:** any single `is_admin()` account can mark any transaction `funded` unilaterally — no second approval, no threshold above which a second admin must co-sign.
- **Evidence:** Confirmed (code) — `rpc_confirm_manual_payment`'s only check is `is_admin()`.
- **Severity:** P0.
- **Failure scenario:** A compromised or rogue admin account confirms fake payments, releasing real (future, once an aggregator exists) or reputational (today, since "funded" gates the whole downstream flow) value with no check.
- **Recommended solution:** For transactions above a configurable threshold (e.g. KSh 25,000, matching `docs/07`'s own milestone-structure threshold), require a second admin's explicit co-sign before the RPC executes — implement as a two-step RPC (`rpc_request_manual_payment_confirmation` + `rpc_cosign_manual_payment_confirmation`) or an admin-approval-queue row that a second `is_admin()` account must approve.
- **Implementation tasks:** *DB:* new `pending_admin_approvals` table (action type, target, requested_by, approved_by, threshold logic). *Backend:* split the RPC as above. *Admin:* an approval queue UI.
- **Owner:** Backend + Ops policy owner (threshold is a business decision).
- **Complexity:** Medium.
- **Resolution (2026-09-15):** No new threshold decision needed — the founder's earlier ratified decision (DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL #4: "two-person approval for everything, no single-admin threshold... every privileged financial/moderation RPC") already covers manual payment confirmation; it was simply never retrofitted when the generic dual-control mechanism (GOV-P4) shipped. Implemented in
  `supabase/migrations/20260915090000_pay004_dual_control_enum_value.sql` and
  `20260915090100_pay004_dual_control_manual_payment.sql`: added `confirm_manual_payment` to `approval_action_type`, gated by the pre-existing but previously-unused `finance_admin` role; `rpc_confirm_manual_payment` now proposes instead of executing directly (`rpc_propose_admin_action`), and a new `_execute_confirm_manual_payment` (the RPC's former body, unchanged, minus its own `is_admin()` check) runs only when a **different** finance admin decides via `rpc_decide_admin_action`. Same name/parameters on the public RPC, so `admin/payments/actions.ts` needed no change; the UI (`confirm-payment-form.tsx`) was updated to show "Submitted for approval" instead of claiming "Payment confirmed" immediately, matching the existing dispute-card pattern. `admin/approvals/page.tsx` extended with the new action type's label/payload summary. Verified live via role simulation (rolled back): propose alone leaves the transaction in `requested` state (not funded); the proposer attempting to decide their own proposal is rejected; a second, distinct admin's approval correctly funds the transaction with a payment row, a balanced ledger, and the audit-trail action attributed to the decider.
  **Known limitation, not fixed by this change:** the live database currently has exactly one admin account, so no manual payment can actually be *decided* (only proposed) until a second admin is granted the `finance_admin` role via `/admin/roles` — this is a pre-existing consequence of the dual-control architecture itself (true for refund/suspend/pause too), not something new introduced here.
  **Bonus finding — see SEC-013:** while adding this, discovered and fixed a critical, live, unauthenticated bypass of the *entire* dual-control mechanism affecting the four action types already shipped.
- **Status:** Resolved 2026-09-15.

---

### PAY-005 — No prorated-payment path for partial completion

- **Domain/Subdomain:** Payments
- **Problem:** `docs/07`'s failure matrix rule ("work incomplete → prorated by scope items completed") has no RPC implementing it — only full-release (`rpc_approve_and_release`) and full-dispute-resolution-split (`rpc_resolve_dispute`) paths exist.
- **Severity:** P1.
- **Recommended solution:** Either fold this into the dispute-resolution flow explicitly (an admin computing the prorated amount manually via `rpc_resolve_dispute`'s existing free-form split, which already supports arbitrary splits — **Confirmed, code**) — in which case this is a **process/training gap, not a code gap** — or build a dedicated self-serve proration RPC based on `transaction_checklist_results` completion percentage. Recommend the former (no new code) as the immediate fix, with a note in `MARKETPLACE_OPERATIONS_AND_SUPPORT_PLAN.md`, and the latter only if manual proration proves too slow/error-prone in practice.
- **Owner:** Ops policy + backend if the self-serve path is later needed.
- **Complexity:** Small (documentation) now; Medium if built later.
- **Status:** Not started.

---

### PAY-006 — Ledger self-consistency is never asserted by a job

- **Domain/Subdomain:** Payments
- **Problem:** no scheduled or ad-hoc job sums `ledger_entries` by account type and confirms debits equal credits, or that `Σ funds_held` matches the sum of `service_transactions` currently in a held state.
- **Evidence:** Confirmed (code) — no such function/route exists in the codebase.
- **Severity:** P0 — this is the cheapest, highest-value financial-integrity check available and does not depend on a live aggregator to build.
- **Recommended solution:** A scheduled job (daily, via the existing cron pattern) that runs a SQL assertion and alerts (not just logs) on imbalance.
- **Implementation tasks:** *Backend:* new cron route + SQL query. *Monitoring:* alert integration (see ANALYTICS-003/DR for what alerting channel exists — **currently none**, this depends on establishing one).
- **Dependencies:** none — buildable today, before an aggregator exists, against the manual-payment ledger entries that already flow through `_fund_transaction`/`rpc_resolve_dispute`.
- **Owner:** Backend/finance.
- **Complexity:** Small–Medium.
- **Status:** Not started.

---

### PAY-007 — Flat 12% fee in code does not match `docs/10`'s vertical fee model

- **Domain/Subdomain:** Payments / Product
- **Problem:** `rpc_book_service` hardcodes `v_fee := round(v_price * 0.12)` for every booking regardless of category, repeat-pair status, or Deal Desk origin. `docs/10` specifies a differentiated model (12/8/20% by vertical, descending repeat fees, 5% Deal Desk, 0% customer fee in some verticals).
- **Evidence:** Confirmed (code) — `supabase/migrations/20260908134754_transaction_functions.sql` line ~61 (also present, unchanged, in `rpc_convert_deal_desk_request`'s own separate fee logic — **not independently re-checked this pass** whether that path also uses a flat rate).
- **Severity:** P1 — not a security bug, but a real gap between ratified strategy and shipped code that will materially affect unit economics the moment real transactions happen.
- **Recommended solution:** A business decision on whether to ship the full vertical/repeat-fee model now or defer (it's meaningfully more schema work — needs a fee-schedule table keyed by category and pair-history, not a hardcoded constant) — flagged in `DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL`.
- **Implementation tasks (if approved):** *DB:* new `fee_schedules` table (category_id, customer_fee_pct, provider_fee_pct, effective_from). Track repeat-pair counts (a query against `service_transactions` grouped by customer+provider, or a denormalized counter). *Backend:* `rpc_book_service` and `rpc_convert_deal_desk_request` read from the schedule instead of a constant.
- **Owner:** Product/founder decision, then backend.
- **Complexity:** Medium–Large.
- **Resolution (2026-09-14):** Per the founder's decision (RESOLVED 2026-09-14, item 6/decision 2 — "build the full differentiated-by-vertical model now"), implemented in
  `supabase/migrations/20260914150000_differentiated_fee_schedule.sql`: a `fee_schedules` table (scope: vertical/deal_desk/repeat_2nd/repeat_3rd_plus/recurring, seeded verbatim from `docs/10`) and a `_resolve_fee_pcts` resolver, wired into all THREE live call sites that hardcoded the flat 12% — `rpc_book_service`, `rpc_convert_deal_desk_request` (the admin's freeform fee input removed — now the ratified 0%/5% Deal Desk rate), and `rpc_accept_quote` (found via grep, not one of the two the original problem statement named). A new `provider_fee_minor` column (deducted from the provider's payout at release, added to `platform_revenue`) makes the provider-side deduction — previously always 0% regardless of vertical — real. `docs/10`'s "never a hidden provider fee" principle is reflected in the provider job-detail page and dashboard earnings totals (both previously showed the gross amount as "you'll receive," which would have been actively misleading once a nonzero provider fee could apply). Verified live via role-simulated/rolled-back transactions: correct % for each vertical (remote_principal 12/8, business_services 12/0, home_services 8/10), correct repeat-pair escalation (2nd job → 6/6, 3rd+ → 5/5) after inserting synthetic prior completed transactions, deal_desk origin correctly overriding vertical, a category with no matching schedule row correctly raising rather than silently defaulting, and `_release_transaction`'s ledger staying balanced (debit = credit sum) with the provider fee correctly flowing to `platform_revenue`. Deliberately NOT touched: `_execute_refund` (dispute resolution) — that remains an admin's discretionary split, independent of the fee model, as before. The `recurring` schedule row is seeded but unreachable until the recurring-series feature (separately tracked) ships.
- **Status:** Not started. Requires business decision.

---

### PAY-008 — No overpayment/underpayment handling path

- **Domain/Subdomain:** Payments
- **Problem:** `rpc_ingest_payment_event` rejects (records as a `processing_error`, does not fund) any amount mismatch — there is no partial-acceptance or overpayment-credit path.
- **Severity:** P1.
- **Recommended solution:** Decide the policy (recommend: reject and require admin/customer resolution, which is close to current behavior — mostly a documentation and admin-tooling gap, not a code gap) — pair with OPS-002's general repair tool.
- **Status:** Not started.

---

### PAY-009 — No refund RPC independent of dispute resolution

- **Domain/Subdomain:** Payments
- **Problem:** the only way money currently flows back to a customer is through `rpc_resolve_dispute` (which requires an open dispute) — there's no direct "admin issues a goodwill/cancellation refund" RPC for the cancellation-policy scenarios in `docs/07`'s failure matrix (e.g., "Customer cancels >24h ahead → 100% refund") that don't necessarily need a full dispute record.
- **Evidence:** Confirmed (code) — `rpc_cancel_booking` exists (**Not confirmed** this pass whether it also handles the refund/ledger side, or only the state transition — needs direct re-read before scoping the fix).
- **Severity:** P1.
- **Recommended solution:** Audit `rpc_cancel_booking`'s current body first (this register item's own next step); build a dedicated refund path if the audit confirms the gap.
- **Status:** Investigating.

---

### PAY-010 — No payout-detail-change hold

- **Domain/Subdomain:** Payments / Security
- **Problem:** `docs/07`'s stated control ("24h hold and re-verification on payout-detail change") has no schema or code support — there is currently no concept of a provider "payout detail" stored at all (payouts are described in strategy docs but not yet a built feature, since the platform is pre-aggregator).
- **Severity:** P1 (becomes P0 once payouts are actually built).
- **Recommended solution:** Build alongside the real payout feature (not before) — track as a dependency, not a standalone task.
- **Dependencies:** PAY-001.
- **Status:** Not started.

---

### TXN-001 — `rpc_submit_quote`/`rpc_accept_quote` have no idempotency key

- **Domain/Subdomain:** Transactions
- **Problem:** unlike `rpc_book_service` (fixed in the prior session), the quote-flow RPCs have no client-supplied idempotency key — a double-submit of `submitQuote` could create... **actually protected by a different mechanism**: `quotes` has `unique(request_id, provider_id)` (Confirmed, code, `SECURITY.md` §10), so a duplicate quote submission is already blocked at the DB level, just via a different, table-shape-specific mechanism rather than a generic idempotency key.
- **Severity:** P1 downgraded from initial assumption — re-classify as **P2** given the existing unique constraint already prevents the duplicate-row outcome; the remaining gap is UX only (a double-submit shows a confusing "already quoted" error rather than a graceful no-op returning the existing quote).
- **Recommended solution:** Make `submitQuote`'s error handling recognize the unique-constraint violation and return the existing quote gracefully instead of a raw DB error string.
- **Owner:** Backend.
- **Complexity:** Small.
- **Status:** Not started.

---

### TXN-002 — `rpc_start_conversation` has no idempotency key

- **Domain/Subdomain:** Transactions
- **Problem:** similar analysis to TXN-001 — `conversations` has `unique(customer_id, provider_id)` (Confirmed, code, `supabase/migrations/20260911102345_conversations.sql`), so a double-submit already can't create two conversation rows; same UX-only gap.
- **Severity:** P2.
- **Status:** Not started.

---

### TXN-003 — No lock audit performed on remaining state-transition RPCs

- **Domain/Subdomain:** Transactions
- **Problem:** `_fund_transaction` and `rpc_accept_quote` are confirmed to use `for update` row locks (Confirmed, code/SECURITY.md). `rpc_provider_check_in`, `rpc_submit_completion`, `rpc_request_revision`, `rpc_cancel_booking`, `rpc_open_dispute` were **not individually re-verified this pass** for the same locking discipline.
- **Severity:** P2 (precautionary — no known failure, just unverified).
- **Recommended solution:** Read each function body; confirm each does `select ... for update` before checking/writing state, or document why it doesn't need to (e.g., an insert-only operation with a unique constraint doing the same job).
- **Owner:** Backend.
- **Complexity:** Small (audit) — Medium if fixes are needed.
- **Resolution (2026-09-15):** All 5 confirmed, no fixes needed. `rpc_provider_check_in` and `rpc_submit_completion` were confirmed in a prior pass. This pass confirmed the remaining 3 by reading their bodies AND cross-checking `pg_proc.prosrc ilike '%for update%'` directly against the live database (not just the migration files, which have been redefined multiple times this session — e.g. `rpc_cancel_booking` alone was redefined 3 times across sessions): `rpc_request_revision` and `rpc_open_dispute` both take `select ... for update` directly; `rpc_cancel_booking` (TXN-005) also does. `rpc_approve_and_release` itself has no lock — live check confirms `prosrc` has none — but it's a thin authorization-only wrapper that unconditionally delegates to `_release_transaction`, which does take the lock (confirmed both in file and live); this is the same safe "cheap auth check, then locked delegate" pattern already used by `rpc_confirm_manual_payment` → `_fund_transaction`, not a gap. `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` §1's table updated with all 5 findings plus a couple of other staleness fixes noticed in passing (the cancel-booking row still described pre-TXN-005 flat-refund/checked-in-blocked behavior; the disputed-resolution row didn't reflect PAY-004/GOV-P4 dual control).
- **Status:** Resolved 2026-09-15.

---

### TXN-004 — Disputes have no deadline/time-bound field

- **Domain/Subdomain:** Transactions
- **Problem:** `disputes` table has no `deadline`/`response_by`/`expires_at` column — the five-tier ladder in `docs/06` (L0 0–24h, L1 48h, L3 72h, L4 5 days) has no enforcement mechanism; a dispute can sit `open` indefinitely with no forced escalation.
- **Evidence:** Confirmed (code) — full `create table disputes` read this pass; no time-bound column present.
- **Severity:** P0.
- **Recommended solution:** Add `sla_deadline timestamptz` set on creation/state-change per the ladder's own timers; a scheduled sweep (same cron pattern) escalates or auto-resolves per `docs/06`'s published auto-resolution rules table.
- **Implementation tasks:** *DB:* new column + migration. *Backend:* new cron route (`dispute-sla-sweep`, mirroring `auto-approve-sweep`'s structure exactly — locked wrapper, `scheduler_runs` logging). *Admin:* SLA countdown visible on the disputes queue.
- **Owner:** Backend.
- **Complexity:** Medium.
- **Resolution (2026-09-15):** Implemented in `supabase/migrations/20260915091000_txn004_dispute_sla_deadlines.sql`: three new columns on `disputes` (`sla_deadline`, `escalated_at`, `overdue_notified_at`). Scope decision, documented in the migration's own header: a dispute arrives already carrying a structured reason+description, so it starts at L1's 48h timer rather than L0's; L2's automated-rules resolution and L3's "both parties accept a proposed split" step don't exist anywhere in this schema (`rpc_resolve_dispute` is a unilateral admin decision under dual control, not a two-party accept flow) and building either is a materially larger feature, deliberately out of scope here. What shipped: `rpc_open_dispute` now sets a real 48h `sla_deadline`; a new `rpc_escalate_overdue_disputes()` (wrapped in `rpc_escalate_overdue_disputes_locked()`, same advisory-lock overlap guard as the existing sweeps) moves `open` → `under_review` once that window lapses, extending the deadline by 72h (L1+L3's combined 120h = docs' own L4 "5 days" total) and notifying every admin; a dispute still unresolved past that second deadline is flagged (once — `overdue_notified_at` prevents re-notification on every subsequent run) as urgently overdue for adjudication. **Deliberately does not auto-resolve any financial outcome at any stage** — docs/06's own auto-resolution rules table (proration, scope disagreement, missing evidence) requires reading evidence no cron job can safely judge, and L4 is explicitly "trained ops decides on an evidence rubric," a human action; the sweep's job is to make an unresolved dispute impossible to lose track of, not to move money. New cron route `/api/cron/escalate-overdue-disputes`, added to `vercel.json` at `0 * * * *` (hourly, not daily like the other sweeps — SLA windows here are measured in hours, so a daily sweep could let a dispute sit up to 24h past its real deadline before being caught). `/admin/disputes` now shows the real state (open/mediation), a "respond by" / "escalated, respond by" / "overdue since — needs a decision today" line per dispute. Verified live via role simulation (rolled back): a fresh dispute gets a 48h deadline; backdating it and running the sweep correctly escalates to `under_review` with a fresh 72h deadline and one notification per admin; backdating again and re-running correctly sets `overdue_notified_at` and sends the urgent notification; a third sweep run does not duplicate either notification; the locked wrapper's overlap-guard shape is intact.
- **Status:** Resolved 2026-09-15.

---

### TXN-005 — No cancellation-fee enforcement

- **Domain/Subdomain:** Transactions / Payments
- **Problem:** `docs/07`'s cancellation-fee table (<24h → 50% to provider; after check-in → 100% to provider) has no corresponding logic in `rpc_cancel_booking` — **not independently re-verified this pass** what that RPC actually does financially; flagged as Investigating pending that read.
- **Severity:** P1.
- **Resolution (2026-09-15):** Confirmed via direct read (see TXN-005/PAY-009 investigation note below) that `rpc_cancel_booking` did flat 100% refund regardless of timing and hard-blocked cancellation entirely from `checked_in` onward. Implemented in
  `supabase/migrations/20260915093000_txn005_cancellation_fee_tiers.sql`: `rpc_cancel_booking` now computes a `v_provider_pct` (0/50/100) from `docs/07`'s table — >24h before `scheduled_for` (or no `scheduled_for` at all, i.e. nothing to violate) → 0%; <24h before → 50%; `checked_in`/`in_progress` → 100% — and splits the still-held `service_amount_minor + platform_fee_minor` between `provider_payable` and `refunds` accordingly (materials are always refunded in full to the customer regardless of tier — the customer never received them, so they aren't a "the provider showed up" cost). Cancellation is now allowed through `checked_in`/`in_progress` (previously hard-blocked, closing the register's own "provider is compensated after check-in is unreachable" finding) but still refused from `evidence_submitted` onward, where the existing approve/revise/dispute flow is the correct path instead. **Milestone correctness:** opening cancellation up to `checked_in`/`in_progress` means both the `scope_agreement` (released at funding) and `materials` (released at check-in) milestone stages may already be paid out by cancel time — both are now excluded from the reversal, extending the same "reverse only what's still actually held" fix TXN-012 already applied to `scope_agreement` alone. `/account/bookings/[id]` now allows cancelling from `checked_in`/`in_progress` and shows an honest, tier-specific warning before confirming (not a source of truth — the RPC computes the real figure server-side). Verified live via role-simulated, rolled-back transactions covering all four cases: >24h-before (0% provider, full refund, state=`refunded`), <24h-before (50%/50% split, state=`settled`), a milestone-qualifying transaction cancelled from `checked_in` with both `scope_agreement` and `materials` already released (100% of the remaining balance to the provider, full-lifecycle ledger stays balanced — the exact double-counting risk this design had to avoid), and `evidence_submitted` correctly still blocked.
- **Status:** Resolved 2026-09-15.

---

### TXN-006 — No customer-unreachable / repeat-non-funding penalty

- **Domain/Subdomain:** Transactions / Trust & Safety
- **Problem:** `docs/06`'s rule ("customers who fail to fund after acceptance twice lose the ability to book without prepayment") has no tracking or enforcement.
- **Severity:** P2.
- **Recommended solution:** Track a `funding_failures` counter on `profiles` (or derive it from `service_transactions` state history); gate a "book now, pay later window" feature if one exists (**not confirmed to exist today** — may be moot until such a feature is built).
- **Status:** Not started.

---

### TXN-007 — No provider no-show detection or suspension trigger

- **Domain/Subdomain:** Transactions / Trust & Safety
- **Problem:** `docs/07`'s rule ("provider no-show → 100% refund; 3 in 90 days → suspension") has no detection mechanism — nothing flags a transaction as a no-show versus a customer-initiated cancellation.
- **Severity:** P1.
- **Recommended solution:** Add an explicit `no_show` cancellation reason captured by whichever RPC handles cancellation from the customer side; a scheduled job counts no-shows per provider per rolling 90 days and calls the existing `rpc_set_verification_status`-adjacent suspension mechanism (**verify a suspension state exists for providers, separate from `is_suspended` on `profiles` which is customer/user-level** — Not confirmed this pass).
- **Status:** Not started.

---

### TXN-008 — Quote expiry not enforced

- **Domain/Subdomain:** Transactions
- **Problem:** `quotes` has no `expires_at` — a quote can sit "pending" indefinitely, and a customer could accept a week-old quote at a price the provider no longer wants to honor.
- **Severity:** P2.
- **Recommended solution:** Add `expires_at` (e.g. 7 days from submission), enforce in `rpc_accept_quote`'s existing guard chain.
- **Status:** Not started.

---

### TXN-009 — Booking expiry never swept

- **Domain/Subdomain:** Transactions
- **Problem:** a `service_transactions` row stuck in `requested` (never funded) has no automatic expiry/cleanup — these accumulate indefinitely and pollute the customer's booking list and any future liquidity metrics.
- **Severity:** P2.
- **Recommended solution:** A scheduled sweep (same cron pattern) that moves unfunded `requested` transactions older than N days to a `cancelled`/`expired` state.
- **Status:** Not started.

---

### TXN-010 — No admin general-purpose transaction repair tool

Cross-referenced with OPS-002 — same underlying gap, filed under both
domains since it's simultaneously a transactions-integrity issue and an
operations-tooling issue.

- **Severity:** P0. **Status:** Resolved 2026-09-15. See OPS-002 for full detail (three RPCs built: `rpc_admin_correct_transaction_amount`, `rpc_admin_reassign_provider`, `rpc_admin_force_resolve_stuck_transaction`, plus the `_execute_refund` materials bug fix — TXN-013).

---

### TXN-013 — `_execute_refund` never reversed `materials_held`

- **Domain/Subdomain:** Transactions / Payments
- **Problem:** `_execute_refund` (the function behind dual-control dispute resolution) only ever debited `funds_held` (service amount + platform fee) — it never touched `materials_held` at all, in any version of the function across this project's history. Any disputed transaction with `materials_amount_minor > 0` left that money permanently stuck in `materials_held` with no reversing ledger entry: neither refunded to the customer nor paid to the provider. `rpc_resolve_dispute`'s own signature has no materials parameter, so there was no way for an admin to even direct where it should go.
- **Evidence:** Confirmed (code) — full read of the live `_execute_refund` body (`supabase/migrations/20260914160000_milestone_payments.sql`) before the fix; confirmed by reproducing it live via a role-simulated, rolled-back dispute resolution on a transaction with `materials_amount_minor = 60000`: the resulting `materials_held` account's net balance for that transaction was left nonzero (money unaccounted for) before the fix.
- **How it was found:** Discovered while building TXN-010's `rpc_admin_force_resolve_stuck_transaction`, which is structurally almost identical to `_execute_refund` — writing the materials-handling logic for the new function made the absence of the same logic in the existing one obvious by contrast (the same pattern that surfaced SEC-013).
- **Severity:** P0 — real, unaccounted-for money in a live financial ledger.
- **Fix:** `supabase/migrations/20260915100100_txn010_admin_transaction_repair_tools.sql` — `_execute_refund` now also debits whatever portion of `materials_held` is still actually held (accounting for the `materials` milestone possibly having already released at check-in, same already-released reasoning applied elsewhere) and credits it in full to the customer's `refunds` — the same "customer never received the materials" default `rpc_cancel_booking` already established, since `rpc_resolve_dispute` has no parameter to direct it otherwise.
- **Verified:** live, role-simulated, rolled-back: opened a dispute on a transaction with materials, resolved it via the real `rpc_resolve_dispute` → dual-control → `rpc_decide_admin_action` path, confirmed a `materials_held` debit of the exact materials amount now exists, `materials_held`'s net balance for that transaction is 0, the refund total correctly includes the materials amount, and the full-lifecycle ledger balances (previously would have failed this check).
- **Status:** Resolved 2026-09-15.

---

### TXN-011 — Recurring/per-occurrence escrow model not implemented

- **Domain/Subdomain:** Transactions / Payments
- **Problem:** `docs/07`'s explicit rule ("never take a large upfront payment for a series... fund each occurrence shortly before it happens") describes a recurring-booking product that does not exist in the schema at all — no `recurring_series` concept, no linkage between multiple `service_transactions` rows as one series.
- **Severity:** P2 (product feature, not a bug in an existing feature).
- **Recommended solution:** A larger, dedicated feature — schema for a `recurring_series` table, a scheduled job to auto-create the next occurrence's `service_transactions` draft, customer approval per occurrence.
- **Owner:** Product decision first (is this in scope for the current launch vertical?), then backend.
- **Complexity:** Large.
- **Status:** Resolved 2026-09-14.
- **Resolution (2026-09-14):** Per the founder's decision (RESOLVED 2026-09-14, item 11: "Build both now"), implemented in `supabase/migrations/20260914170000_recurring_series.sql`. A `recurring_series` table holds the standing arrangement (customer, provider, service, frequency, `next_occurrence_date`, `lead_days`). Deliberate design choice, stated in the migration's own header: each occurrence is a completely ordinary `service_transactions` row, funded and released through the exact same RPCs every other booking uses — `recurring_series` only decides WHEN the next occurrence's row gets created, never a stored payment method or auto-charge, which makes "per-occurrence escrow, not a prepaid balance" true by construction rather than by policy. `_create_recurring_occurrence` (shared by `rpc_start_recurring_series` for the first occurrence and the scheduled sweep for every one after) mirrors `rpc_book_service`'s own price/fee resolution exactly, using the dedicated 'recurring' fee-schedule scope (5%/5%, seeded by the differentiated-fee-schedule migration but unreachable until this pass added the matching `_resolve_fee_pcts` branch). The next occurrence is created `lead_days` (default 3) before it's due, not on the due date, so the customer has time to fund it — matching docs/07's own reasoning for escrow-before-dispatch. `rpc_generate_due_recurring_occurrences_locked` is the scheduled sweep (new `/api/cron/generate-recurring-occurrences` route + `vercel.json` entry, identical shape to the existing auto-approve-sweep cron, including the `scheduler_runs` logging and `pg_try_advisory_lock` overlap guard). `rpc_cancel_recurring_series` stops future occurrences only — any already-created occurrence (paid or not) follows its own independent booking lifecycle, the concrete form of "customer can stop at any time" docs/10 names as the point of per-occurrence funding.

  Verified live via role-simulated, rolled-back transactions: starting a series correctly creates its first occurrence with the 5%/5% recurring fee rate and advances `next_occurrence_date` past it; directly invoking the sweep RPC against a backdated series correctly creates the next occurrence and advances the date by the right interval; cancelling a series correctly sets `is_active=false`; a different customer attempting to cancel someone else's series is correctly rejected. One customer-facing surface was added end to end: the booking form (`booking-form.tsx`) shows a frequency/first-occurrence picker instead of a one-off date field for any `pricing_model='recurring'` service, submitting through a new `startRecurringSeries` action; `/account/bookings` lists active series with a stop button. One real recurring-priced service ("Quarterly property check") was seeded so this has an actual product surface, per docs/07's own example.

  **Important, separately-discovered finding, out of scope for this migration to fix:** live inspection while testing this feature found the project currently has **zero cleared providers for any category** (`provider_categories` has 2 rows total, neither `is_cleared`, and zero published providers) — meaning every explicit-provider booking path (recurring or one-off) is currently unusable in the live app until at least one provider is published and cleared via the existing `/admin/providers` flow. This is a pre-existing data/operational gap, not introduced by or specific to this feature, and is flagged here rather than silently worked around.

---

### TXN-012 — Milestone payment structure not implemented

- **Domain/Subdomain:** Transactions / Payments
- **Problem:** `docs/07`'s >KSh 25,000 milestone structure (30% on scope agreement, materials as a discrete stage, balance on completion) has no schema support — `payments`/`ledger_entries` support one funding event per transaction today (**Confirmed, code** — `_fund_transaction` funds the full `total_amount_minor` in one call).
- **Severity:** P2.
- **Recommended solution:** A larger feature — multiple `payments` rows per transaction, each tied to a milestone definition.
- **Owner:** Product decision, then backend.
- **Complexity:** Large.
- **Status:** Resolved 2026-09-14.
- **Resolution (2026-09-14):** Per the founder's decision (RESOLVED 2026-09-14, item 11: "Build both now" — recurring-service bookings and milestone payments), implemented in `supabase/migrations/20260914160000_milestone_payments.sql`. Architectural choice made explicit in the migration's own header: FUNDING stays a single lump-sum event exactly as before (`_fund_transaction` unchanged in that respect — "fund before dispatch, always" per docs/07 rule 1 matters more, not less, for a large job); what becomes multi-stage is RELEASE. A new `transaction_milestones` table (scope_agreement 30% / materials / balance 70%) is created automatically for any transaction whose `service_amount_minor` exceeds KSh 25,000, via `_create_transaction_milestones_if_qualifying`, called from all three transaction-creation paths (`rpc_book_service`, `rpc_accept_quote`, `rpc_convert_deal_desk_request`). `_release_milestone` releases each stage 100% pass-through (fees netted out only at the terminal balance release) at its existing trigger point: scope_agreement at funding, materials at check-in, balance at the existing customer-approval step (`_release_transaction`). Jobs at or below KSh 25,000 get zero milestone rows and are completely untouched — the well-tested existing single-release path is byte-for-byte unchanged for the common case (this project's own seed data tops out around KSh 8,000).

  A genuine correctness bug was caught and fixed as a required part of this change, not a new feature: `rpc_cancel_booking` and `_execute_refund` (dispute resolution) both used to unconditionally reverse `service_amount_minor + platform_fee_minor` from `funds_held`, which becomes wrong the moment a milestone transaction's scope_agreement stage has already paid out to the provider before a cancel or dispute — the already-released amount can't be clawed back via a ledger reversal. Both now compute and reverse only what's actually still held. All three ledger paths (normal full-lifecycle release, cancel-after-scope_agreement-release, dispute-resolution-after-scope_agreement-release) were verified live via role-simulated, rolled-back transactions against a synthetic KSh 50,000 test service (real cleared-provider category, real customer/admin/provider role switches for booking → funding → check-in → completion → approval, and separately cancel and dispute variants) — every scenario's debit sum exactly equalled its credit sum, milestone `state` transitions matched the expected release sequence, and the provider's total payout net of scope_agreement-already-paid amounts matched hand-calculated expectations in every case. One real bug (an untyped `text` CASE expression against the `ledger_account_type` enum column) was caught by this live testing and fixed before commit.

  Deliberately not built in this pass, stated rather than silently assumed solved: docs/07's separate MATERIALS_ADVANCED → MATERIALS_RECEIPTED → auto-return-unused-balance receipt-reconciliation cycle (rule 2) — the `materials` milestone here is a plain advance at check-in, not that full cycle, which doesn't exist for ANY transaction size today (`_release_transaction` never touched `materials_held` before or after this migration). No UI lets a provider upload materials receipts or triggers an automatic unused-balance return; that remains a separate, larger gap. Milestone status is now surfaced read-only in the admin booking detail page, the customer booking detail page, and the provider job detail page (`MilestonesCard`), which also fixed a latent, now-load-bearing inaccuracy: the provider job page's "You'll receive" figure previously showed the gross job value (harmless when provider_fee_minor was always 0, actively misleading once real provider fees exist) — corrected to show the net payout with the fee broken out, alongside the differentiated-fee-schedule work.

---

### TSF-001 — No enforcement that evidence capture is in-app only

- **Domain/Subdomain:** Trust & Safety
- **Problem:** `docs/06`'s core anti-fraud control ("in-app capture only... gallery uploads are rejected for Tier 3 work") is not enforced — `recordEvidence` (Confirmed, code, `src/app/provider/jobs/[id]/actions.ts`) accepts whatever file URL the client sends after an upload, with no way to distinguish an in-app camera capture from a gallery-selected pre-existing file.
- **Why it matters:** this is named in `docs/14` as failure mode #4, "the failure mode that ends the company rather than damaging it" (agency fraud via fabricated evidence).
- **Severity:** P0.
- **Recommended solution:** Requires a genuine product/mobile-capability decision: true in-app-camera-only capture requires either a native app (not yet built) or a PWA using the `getUserMedia`/camera-capture APIs directly rather than a generic file input, plus server-side metadata checks (EXIF presence/consistency) as a second layer. This is one of the largest gaps relative to stated strategy in the entire program.
- **Implementation tasks:** *Frontend:* replace the generic file-upload evidence capture with a camera-capture component (`<input type="file" capture="environment">` is a *weak* signal, spoofable — real enforcement needs more). *Backend:* server-side EXIF/metadata validation, reject files with no camera metadata or with metadata inconsistent with the claimed capture time/location. *DB:* store extracted metadata (geotag, timestamp) alongside each evidence row for later audit.
- **Dependencies:** TSF-002 (geotagging) is the same underlying mechanism.
- **Owner:** Product + mobile/frontend engineering.
- **Complexity:** Large.
- **Status:** Not started.

---

### TSF-002 — No geotagging/timestamp verification on evidence uploads

Same mechanism as TSF-001; filed separately because it has its own
acceptance criteria (a photo can be genuinely camera-captured but still lack
a verifiable geotag if location permission was denied).

- **Severity:** P1. **Status:** Not started. See TSF-001 implementation tasks.

---

### TSF-003 — No perceptual-duplicate detection on uploaded evidence

- **Domain/Subdomain:** Trust & Safety
- **Problem:** `docs/06` names "recycled or staged photos" as fraud threat #3; no perceptual-hash comparison exists to detect the same photo reused across multiple jobs.
- **Severity:** P1.
- **Recommended solution:** Compute a perceptual hash (e.g. pHash) on upload, store it, flag near-duplicate matches against prior evidence for admin review.
- **Owner:** Backend.
- **Complexity:** Medium.
- **Status:** Not started.

---

### TSF-004 — No conflict-of-interest declaration field/flow

- **Domain/Subdomain:** Trust & Safety
- **Problem:** `docs/06`'s control #3 ("conflict-of-interest declaration, per job, contractual") has no schema field or UI step — a provider is never asked to affirm no relationship with a counterparty before starting a Tier 3 job.
- **Severity:** P0 (named explicitly as a required control for the highest-risk job type).
- **Recommended solution:** Add a required checkbox/affirmation step before check-in on jobs flagged as requiring it (tied to the tiered-verification model in PROV-001), recorded as an immutable event in `transaction_events`.
- **Dependencies:** PROV-001 (tiering must exist to know which jobs require this).
- **Owner:** Product + backend.
- **Complexity:** Small once PROV-001 exists.
- **Status:** Not started.

---

### TSF-005 — No dual-coverage mechanism for high-value jobs

- **Domain/Subdomain:** Trust & Safety
- **Problem:** `docs/06`'s control #5 ("random dual coverage... send a second, independent inspector who does not know the first was sent") has no implementation — the current model is one provider per transaction, period.
- **Severity:** P1 (explicitly named as the strongest detection signal against agency fraud, but genuinely large scope — requires a second-assignment mechanism and cost-modeling).
- **Recommended solution:** A larger feature requiring product decisions (sampling rate, value threshold, cost absorption) before engineering scope can be defined.
- **Owner:** Product/founder decision first.
- **Complexity:** Large.
- **Status:** Not started. Requires business decision.

---

### TSF-006 — No outcome-follow-up mechanism

- **Domain/Subdomain:** Trust & Safety
- **Problem:** `docs/06`'s control #6 ("contact the customer 30–60 days later: did reality match the report?") has no scheduled job or survey mechanism.
- **Severity:** P2.
- **Recommended solution:** A scheduled job (same cron pattern) that surfaces a follow-up prompt (in-app notification, or eventually SMS/email per NOTIF-001/002) to customers on settled Tier 2/3 transactions at day 30–60, feeding the answer into the provider's Integrity score (which itself does not exist yet as a computed field — depends on PROV-001's tier model and a scoring job).
- **Status:** Not started.

---

### TSF-007 — No report/flag mechanism on messages, reviews, or profiles

- **Domain/Subdomain:** Trust & Safety
- **Problem:** no "report" button or backing table exists anywhere in the UI or schema for flagging an abusive message, a fake review, or a suspicious profile.
- **Evidence:** Confirmed (code) — no `reports`/`flags` table in any migration; no report UI in `message-thread.tsx` or review components.
- **Severity:** P0 — this is a basic trust-and-safety primitive with no substitute.
- **Recommended solution:** New `reports` table (reporter_id, target_type, target_id, reason, description, state) with RLS allowing any participant to insert a report on content they can see; an admin moderation queue (TSF-008) to triage.
- **Implementation tasks:** *DB:* new table + RLS + index. *Backend:* a `reportContent` server action. *Frontend:* a report affordance on messages, reviews, and profiles. *Admin:* the queue (TSF-008).
- **Owner:** Product + backend.
- **Complexity:** Medium.
- **Status:** **Resolved.** `reports` table (`reporter_id`, `target_type` enum `message`/`review`/`provider_profile`/`customer_profile`, `target_id`, `reason`, `description`, `state` enum `open`/`reviewing`/`actioned`/`dismissed`) + RLS applied live (`supabase/migrations/20260915110000_tsf007_report_flag_mechanism.sql`, `20260915110100_tsf007_fix_reports_profile_embedding.sql`). `can_report_target(target_type, target_id)` (SECURITY DEFINER, mirrors `is_admin()`/`is_txn_participant()`'s "callable by authenticated, used inside RLS" pattern — not the `_`-prefixed internal-helper pattern) checks the reporter can actually see the target: for a message, they're the transaction customer/provider or conversation customer/provider; for a review, it's public; for a provider profile, it's public; for a customer profile, only a provider who has an active transaction/conversation with that customer. The insert policy requires both `reporter_id = auth.uid()` and `can_report_target(...)`. `rpc_admin_resolve_report(report_id, state, note)` (admin-only, logs to `admin_actions` as `resolve_report`) is the only way to change a report's state.
  - **Live-verified** (role-simulated, rolled-back `execute_sql` transaction): a transaction participant can report a message they can see; a non-participant's insert is blocked by RLS (`new row violates row-level security policy for table "reports"`); any authenticated user can report a public provider profile; a non-admin calling `rpc_admin_resolve_report` is blocked (`Only an admin may resolve a report.`); a real admin resolving a report updates `state`/`resolved_by`/`resolved_at` and writes exactly one `admin_actions` row. `get_advisors(type:"security")` showed no new-class finding — `can_report_target` and `rpc_admin_resolve_report` land in the same accepted "SECURITY DEFINER callable by anon/authenticated" baseline as every other public-facing RPC/permission-check function in this schema.
  - **Found and fixed in the same pass:** `reports.reporter_id`/`resolved_by` were originally defined against `auth.users(id)` (the same PGRST200-causing pattern `20260910154541_fix_postgrest_profile_embedding.sql` fixed for `providers.user_id`/`service_transactions.customer_id`) — retargeted to `profiles(id)` before any UI shipped against it, so the admin moderation queue's `profiles:reporter_id(full_name)` embed actually resolves.
  - **UI:** `src/components/report/report-button.tsx` (reusable client component, target-type-specific reason lists) + `src/components/report/actions.ts` (`submitReport` server action — a thin RLS-checked insert, no RPC needed since the policy does the real check). Wired into: `src/app/messages/message-thread.tsx` (a small flag affordance under each message from the *other* party — never on your own messages), `src/app/provider/[slug]/page.tsx` (per-review, plus a "Report this professional" link near the primary CTA).
  - **What this does NOT cover, on purpose:** a `customer_profile` report affordance has no UI entry point yet (there's no page that shows a customer's profile to a provider outside the transaction/message thread itself) — the schema and RLS support it, but nothing links to it. That's a real, documented gap, not a silent one.

---

### TSF-008 — No moderation queue or admin abuse-review workflow

- **Domain/Subdomain:** Trust & Safety / Ops
- **Problem:** even once TSF-007 exists, there is no admin surface to triage reports — `/admin` currently covers verifications, disputes, payments, integrations, deal-desk, and transactions, with no moderation section.
- **Severity:** P1 (depends on TSF-007 to be meaningful).
- **Recommended solution:** `/admin/moderation` — queue, filters, reason codes, resolution actions (warn/suspend/ban), linked to `admin_actions` for audit.
- **Dependencies:** TSF-007.
- **Owner:** Backend + admin frontend.
- **Complexity:** Medium.
- **Status:** Partially addressed as a side effect of closing TSF-007 — `/admin/moderation` (`src/app/admin/moderation/page.tsx`) lists open/reviewing reports and lets an admin mark actioned/dismissed with a note, logged to `admin_actions`. **Still missing, and NOT claimed as done here:** filters, a reason-code taxonomy (currently free-text reasons chosen from a fixed per-target-type list, not stored as a normalized code), and warn/suspend/ban shortcut actions — resolving a report today does not itself suspend the provider or hide the review; an admin still has to go do that separately from `/admin/providers` or `/admin/reviews`. That gap is real, scoped, and left open rather than papered over.

---

### TSF-009 — No risk-scoring or suspicious-behavior signal pipeline

- **Domain/Subdomain:** Trust & Safety
- **Problem:** no signals are computed or aggregated anywhere (velocity of actions, IP/device reuse across accounts, mismatched geolocation, rapid account creation followed by high-value transactions).
- **Severity:** P1.
- **Recommended solution:** Start narrow: a computed `risk_flags` view/table derived from existing data (multiple accounts sharing a phone/payout detail, rate-limit near-misses from `rate_limit_buckets` already logging volume, unusually fast time-to-first-high-value-transaction). Full ML-based scoring is out of scope for this phase — explicitly deferred to Phase 4 in the master plan.
- **Owner:** Backend/data.
- **Complexity:** Medium (rules-based) — treat "full risk-scoring system" as Large/Phase 4.
- **Status:** Not started.

---

### TSF-010 — No account/transaction velocity limits beyond the 5 rate-limited actions

- **Domain/Subdomain:** Trust & Safety
- **Problem:** the prior session's rate limiting covers booking, quoting, messaging, task-posting, and signup — it does not cover review submission, report submission (once TSF-007 exists), profile edits, or admin actions.
- **Severity:** P1.
- **Recommended solution:** Extend `checkRateLimit` (already-built, proven infrastructure) to `submitReview`, the new `reportContent` action, and consider admin-action rate limiting as a defense-in-depth measure against a compromised admin session.
- **Owner:** Backend.
- **Complexity:** Small (infrastructure already exists).
- **Status:** Not started.

---

### TSF-011 — No provider-safety opt-in/decline mechanism

- **Domain/Subdomain:** Trust & Safety
- **Problem:** `docs/06`'s safety architecture ("providers may decline any job, always, with no ranking penalty"; "no lone female provider dispatched... without explicit opt-in") has no schema support — no per-provider safety preferences, no decline-without-penalty guarantee enforced in the reliability-score computation (**not independently verified** whether `recompute_reliability()` currently penalizes declines — flagged for audit).
- **Severity:** P1.
- **Recommended solution:** Audit `recompute_reliability()`'s actual formula first (Investigating); add a provider safety-preferences field if the audit confirms decline is currently scored.
- **Status:** Investigating.

---

### TSF-012 — No emergency/safety-incident escalation path in-app

- **Domain/Subdomain:** Trust & Safety
- **Problem:** `docs/06`'s "in-app emergency button routing to a staffed number during working hours" does not exist in the UI.
- **Severity:** P0 for any real, physical, on-site transaction — but note this is **not yet a live risk** given zero published providers/real transactions exist today; it is a hard blocker before any real physical-service transaction is allowed to happen, not before this document is written.
- **Recommended solution:** Requires an operational decision first (is there a staffed number today? who answers it?) before the in-app button can point anywhere real — **Requires business decision**, then a small UI addition.
- **Owner:** Founder/ops decision, then frontend.
- **Complexity:** Small (once the destination exists).
- **Status:** Not started. Requires business decision.

---

### TSF-013 — No written incident-response protocol

- **Domain/Subdomain:** Trust & Safety / Operations
- **Problem:** `docs/06` explicitly says "have the protocol written before you need it" — it does not exist as a document anywhere in this repository.
- **Severity:** P0.
- **Recommended solution:** Write it — who is notified, response-time targets, communication templates, when law enforcement is contacted, when the platform pauses a provider/customer/category pending investigation.
- **Owner:** Founder + trust & safety lead (may be the same person pre-hire).
- **Complexity:** Small (documentation), but requires real operational decisions, not engineering.
- **Status:** Not started. Requires business decision.

---

### TSF-014 — No emergency transaction/provider/customer pause control

- **Domain/Subdomain:** Trust & Safety / Operations
- **Problem:** there is no admin control to immediately freeze a specific provider, customer, or entire category from further transactions pending investigation — `providers.verification_status` can be set to a non-verified state via the existing admin RPC, but there's no single "pause everything for this actor right now" action, and no category-level kill switch at all.
- **Severity:** P0.
- **Recommended solution:** A new `rpc_emergency_pause(target_type, target_id, reason)` admin RPC and a corresponding one-click admin UI action; for categories, a `categories.is_active` toggle already exists in the schema (**Confirmed, code** — used by the "categories readable" RLS policy) but has no admin UI exposed to flip it — that's the fastest, smallest fix for the category-pause half of this item.
- **Implementation tasks:** *Backend:* new RPC for provider/customer pause (may just be a thin wrapper calling existing `rpc_set_verification_status`/suspension mechanisms with an audit-logged reason). *Admin:* a category toggle UI (small) + a pause action on provider/customer detail views (medium).
- **Owner:** Backend + admin frontend.
- **Complexity:** Small (category toggle) to Medium (provider/customer pause).
- **Status:** Not started.

---

### PROV-001 — Verification is one flat status, not the tiered model in `docs/06`

- **Domain/Subdomain:** Provider Quality
- **Problem:** `providers.verification_status` is a single enum (pending/submitted/verified/rejected — **exact values not re-confirmed this pass**, Not confirmed), with no concept of Tier 0–3 or which category a given verification level applies to.
- **Why it matters:** the founding brief for this exact task explicitly says "do not treat a verified identity as proof of competence" — today's schema has no way to express the difference at all.
- **Severity:** P1.
- **Recommended solution:** Add a `provider_verification_tiers` table (provider_id, category_id nullable for portable tiers, tier int, evidence jsonb, verified_by, verified_at) replacing the single flat status with the Reliability/Competence/Integrity split `docs/06` specifies. This is a genuine schema redesign, not a small patch — scope it as its own project.
- **Implementation tasks:** *DB:* new table(s), migration of existing `verification_status` values into the new model, RLS following the existing admin-gated pattern. *Backend:* new admin RPCs for tier assignment. *Frontend:* verification badges reflecting the real tier/category, not a single "Verified" checkmark (`docs/06`'s own badge-definition table). *Admin:* tier-assignment UI in the verifications queue.
- **Owner:** Product (schema design sign-off) + backend.
- **Complexity:** Large.
- **Status:** Not started.

---

### PROV-002 — No category-specific competence-assessment mechanism

- **Domain/Subdomain:** Provider Quality
- **Problem:** `docs/06`'s Tier 2 requirement ("category assessment") has no implementation — no test-job, portfolio-review, or reference-check workflow exists beyond the free-text `attributes` field a provider self-declares.
- **Severity:** P1.
- **Dependencies:** PROV-001 (needs the tier model to attach to).
- **Status:** Not started.

---

### PROV-003 — No provider-suspension-for-cause automated trigger

- **Domain/Subdomain:** Provider Quality
- **Problem:** suspension today (per `SECURITY.md`) is an admin-manual `rpc_set_verification_status` call — no automatic trigger exists for accumulated no-shows (TXN-007), disputes, or low ratings.
- **Severity:** P1.
- **Dependencies:** TXN-007.
- **Status:** Not started.

---

### PROV-004 — No provider-appeal workflow

- **Domain/Subdomain:** Provider Quality
- **Problem:** a suspended/rejected provider has no in-app path to appeal — presumably handled ad hoc via whatever support channel exists (**none confirmed to exist yet** — see OPS-003).
- **Severity:** P2.
- **Status:** Not started.

---

### PROV-005 — No new-account-after-ban detection

- **Domain/Subdomain:** Provider Quality / Trust & Safety
- **Problem:** a banned provider can sign up again with a new email/phone with nothing to correlate the new account to the banned one, beyond whatever manual recognition an admin happens to have.
- **Severity:** P2.
- **Recommended solution:** Correlate on payout details (M-Pesa number), ID number, or device/IP fingerprint at signup — the ID-number correlation is the strongest and is already collected (`providers.national_id_number`); a uniqueness/history check against previously-banned providers' stored ID numbers is a small, high-value addition.
- **Owner:** Backend.
- **Complexity:** Small–Medium.
- **Status:** Not started.

---

### PROV-006 — No "New — platform guaranteed" cold-start mechanism

- **Domain/Subdomain:** Provider Quality / Liquidity
- **Problem:** `docs/06`'s recommended cold-start mechanism (platform underwrites a new provider's first 5 jobs, refunding the customer in full on any failure) does not exist.
- **Severity:** P2 — a real product feature with a real cost line, not a bug.
- **Status:** Not started. Requires business decision (budget for the underwriting).

---

### LIQ-001 — No liquidity metrics instrumented

- **Domain/Subdomain:** Liquidity
- **Problem:** none of `docs/13`'s marketplace-health formulas (fill rate, time to assignment, coverage depth, provider utilization) are computed anywhere — no analytics pipeline exists at all (ANALYTICS-001).
- **Severity:** P0 — without these numbers, every liquidity decision in §5 of the master plan is a guess.
- **Dependencies:** ANALYTICS-001.
- **Status:** Not started.

---

### LIQ-002 — No matching/ranking algorithm

- **Domain/Subdomain:** Liquidity
- **Problem:** provider lists render in whatever order the DB query returns them (**not independently re-verified this pass** whether an explicit `order by` exists — flagged as Investigating) — `docs/06`'s Trust Score (Bayesian cold-start, Wilson lower-bound ranking, 180-day half-life) is entirely unimplemented.
- **Severity:** P1.
- **Status:** Investigating (query order) / Not started (scoring).

---

### LIQ-003 — No zero-quote-request fallback

- **Domain/Subdomain:** Liquidity
- **Problem:** a customer whose `service_requests` row gets no quotes has no in-app signal, waitlist, or escalation — it just sits `open` silently.
- **Severity:** P1.
- **Recommended solution:** A scheduled job flags requests open >N hours with 0 quotes for an ops-assisted-matching queue (ties into OPS-003).
- **Status:** Not started.

---

### LIQ-004 — No category/area launch-gating control

- **Domain/Subdomain:** Liquidity
- **Problem:** `docs/14`'s density rule (≥5 verified providers per active service before opening a new area) has no operational enforcement — `categories.is_active` exists (LIQ-004 shares its fix with TSF-014's category-pause item) but nothing computes "does this category/area meet the density bar" automatically.
- **Severity:** P1.
- **Dependencies:** LIQ-001 (needs coverage-depth metric first), TSF-014 (shares the toggle mechanism).
- **Status:** Not started.

---

### LIQ-005 — No provider-overexposure / workload-cap tracking

- **Domain/Subdomain:** Liquidity
- **Problem:** `docs/14`'s "cap provider concentration at 15%" recommendation has no tracking — nothing computes what share of completed jobs any single provider represents.
- **Severity:** P2.
- **Status:** Not started.

---

### LIQ-006 — Zero published providers on production

- **Domain/Subdomain:** Liquidity (business, not engineering)
- **Problem:** every one of the 15 `services` rows has 0 published providers.
- **Evidence:** Confirmed (live DB, prior session) — `MARKETPLACE_UX_AUDIT.md` §12.
- **Severity:** P0, but explicitly **not an engineering task** — the machinery works end-to-end; there is no live supply.
- **Recommended solution:** Manual, founder-led supply recruitment per `docs/08`'s cold-start plan ("sell and deliver 20 jobs manually before building anything further").
- **Owner:** Founder/operations.
- **Status:** Not started. Requires business decision/execution, not code.

---

### MSG-001 — Malicious-file-upload path in messaging not implemented (moot, no attachments exist)

- **Domain/Subdomain:** Messaging
- **Problem:** `messages.body` is text-only (**Confirmed, code** — no attachment column/bucket referenced in the messages schema); this register item exists to record that if/when file attachments are added to messaging, they must go through the same scanning requirement as SEC-002.
- **Severity:** P2 (preventative, not a current gap since the feature doesn't exist).
- **Status:** Not started (no action needed until attachments are built).

---

### MSG-002 — No message-level report/block mechanism

Same underlying gap as TSF-007, filed here for messaging-specific
discoverability.

- **Severity:** P1. **Status:** **Resolved via TSF-007** — every message from the other party in a thread now has a report affordance (`src/app/messages/message-thread.tsx`). Blocking a user outright (as opposed to reporting a message) is still not built — that's a distinct feature, not covered by TSF-007's scope.

---

### MSG-003 — No Realtime-degraded fallback UX

- **Domain/Subdomain:** Messaging
- **Problem:** `message-thread.tsx`'s realtime subscription (Confirmed, code) has no visible indicator if the socket never connects — the thread silently falls back to whatever was server-rendered, with no "reconnecting..." or "live updates unavailable" signal to the user.
- **Severity:** P2.
- **Recommended solution:** Track `channel.subscribe()`'s own status callback and render a small, non-alarming "Updates may be delayed" banner if the channel enters a `CHANNEL_ERROR`/`TIMED_OUT` state.
- **Owner:** Frontend.
- **Complexity:** Small.
- **Status:** Not started.

---

### MSG-004 — No message retention/archival policy

- **Domain/Subdomain:** Messaging / Legal
- **Problem:** messages are retained indefinitely with no policy — ties into LEGAL-007's broader retention-period decision.
- **Severity:** P3.
- **Status:** Not started. Requires business decision.

---

### MSG-005 — Realtime connection-limit behavior unverified

- **Domain/Subdomain:** Messaging / Performance
- **Problem:** Supabase's Realtime concurrent-connection cap for this project's actual plan is unknown (same class of gap as the general infra-limits unknown, PERF-001).
- **Severity:** P2.
- **Status:** Blocked — external access (Supabase dashboard).

---

### NOTIF-001 — No email notification channel at all

- **Domain/Subdomain:** Notifications
- **Problem:** the `notifications` table exists and is written to (new message, verification decisions, etc. — Confirmed, code) but is only ever surfaced in-app; no email is ever sent for anything, including account-critical events.
- **Evidence:** Confirmed (code) — no email-sending code found anywhere in `src/` (grepped for `resend`/`sendgrid`/`nodemailer`/SMTP — nothing found this pass).
- **Severity:** P1 — a user who doesn't have the app open (the overwhelming majority of the time) never learns a quote arrived, a payment needs confirming, or a dispute needs their input.
- **Recommended solution:** Integrate a transactional email provider (Resend is already an available MCP connector in this environment, suggesting it may be the intended choice — **Not confirmed** as a business decision, just noting the tooling is present) for the highest-value transactional notifications first: new quote, payment confirmed, evidence submitted (customer needs to know to review), dispute opened, dispute resolved.
- **Implementation tasks:** *Backend:* an email-sending helper following this project's established "fails don't block the underlying action" principle (mirrors how the cron route logs but doesn't fail the sweep on a logging error). *DB:* consider a `notification_deliveries` table tracking channel/status/attempts for auditability. *External config:* email provider account + domain verification (SPF/DKIM).
- **Owner:** Backend.
- **Complexity:** Medium.
- **Status:** Not started.

---

### NOTIF-002 — No SMS/WhatsApp notification channel connected

- **Domain/Subdomain:** Notifications
- **Problem:** `docs/08` explicitly recommends WhatsApp-first communication for providers with unreliable smartphone/data access; nothing is connected.
- **Severity:** P2 (P1 once real physical-service providers are onboarded, per `docs/08`'s own reasoning — "providers cannot use the software... offline-tolerant capture, WhatsApp-first comms").
- **Status:** Not started. Requires business decision (which vendor, budget).

---

### NOTIF-003 — Critical actions never blocked by notification failure

- **Domain/Subdomain:** Notifications
- **Problem:** this is actually a **positive finding**, listed here to record it rather than let it go unstated.
- **Evidence:** Confirmed (code) — the cron route's own pattern ("a logging failure must never block the actual sweep from running") and every RPC's transaction boundary means a notification insert failure cannot roll back the underlying state change (notifications are a separate insert, not part of the same guarded transaction in the RPCs reviewed — **Confirmed** for the messaging notification path specifically, `SECURITY.md`'s messaging verification table).
- **Severity:** N/A (confirmed-safe finding, not a risk).
- **Status:** Verified.

---

### NOTIF-004 — No user notification preferences/opt-out

- **Domain/Subdomain:** Notifications / Legal
- **Problem:** no preference center exists; once NOTIF-001/002 are built, marketing-vs-transactional distinction and opt-out (a legal requirement for marketing messages under most data-protection regimes, and specifically relevant to `docs/14`'s ODPC-registration checklist) must exist before any marketing send.
- **Severity:** P2 now, P0 before any marketing communication is ever sent.
- **Status:** Not started.

---

### MOBILE-001 — No explicit "unknown/awaiting confirmation" UI state for payments

- **Domain/Subdomain:** Mobile/PWA
- **Problem:** the founding brief is explicit: "do not represent an unknown payment or booking state as a definitive failure." Current booking-status UI (**not re-audited pixel-by-pixel this pass**, based on `MARKETPLACE_UX_AUDIT.md`'s general findings) is not confirmed to have a distinct "we're checking" state separate from "failed."
- **Severity:** P1.
- **Recommended solution:** Audit the actual booking/tracking status components against the state list the brief requires (Not started / Processing / Confirmed / Failed / Unknown-awaiting-confirmation / Retry available / Already completed) and add whichever are missing.
- **Status:** Investigating.

---

### MOBILE-002 — PWA manifest/offline-shell not confirmed

- **Domain/Subdomain:** Mobile/PWA
- **Problem:** whether a `manifest.json`/service worker exists and functions was not re-verified this pass.
- **Severity:** P2.
- **Status:** Not confirmed — needs a direct check of `public/manifest.json` and any service-worker registration.

---

### MOBILE-003 — No low-end-device/slow-network testing performed

- **Domain/Subdomain:** Mobile/PWA
- **Problem:** no Lighthouse/WebPageTest run under throttled 3G conditions has been performed and recorded anywhere in this repository's history.
- **Severity:** P2.
- **Recommended solution:** Run Lighthouse in CI (or manually) under "Slow 4G"/"Fast 3G" presets against the deployed URL; record baseline scores.
- **Status:** Not started.

---

### MOBILE-004 — No accessibility audit performed

- **Domain/Subdomain:** Mobile/PWA
- **Problem:** no axe-core/Lighthouse-accessibility run has been performed and recorded.
- **Severity:** P2.
- **Status:** Not started.

---

### MOBILE-005 — STK-push app-switch scenario untested

- **Domain/Subdomain:** Mobile/PWA / Payments
- **Problem:** the classic M-Pesa STK-push UX failure (customer switches to the M-Pesa app to enter their PIN, then the browser tab is suspended/killed by the OS) has never been tested because no real STK push has ever been triggered (PAY-001 dependency).
- **Severity:** P2 today, P0 before real payments go live.
- **Dependencies:** PAY-001.
- **Status:** Not started.

---

### LEGAL-001 — PSP-status legal opinion not commissioned

- **Domain/Subdomain:** Legal
- **Problem:** `docs/07`/`docs/14` both flag this as the first item to resolve before taking real money; no evidence an opinion has been commissioned.
- **Severity:** P0.
- **Status:** Requires legal review. Owner: founder.

---

### LEGAL-002 — Contractor-classification opinion not commissioned

Same pattern as LEGAL-001. **Severity:** P0. **Status:** Requires legal review.

---

### LEGAL-003 — Property-representation regulatory opinion not commissioned

Same pattern. **Severity:** P0 (specifically for the remote-verification
vertical). **Status:** Requires legal review.

---

### LEGAL-004 — ODPC registration status unknown

- **Problem:** `docs/14` states registration is required above certain thresholds or when processing sensitive data (which ID documents/home addresses certainly are) — current registration status is unknown to this session.
- **Severity:** P0.
- **Status:** Blocked — external access / Requires business decision (who owns filing this).

---

### LEGAL-005 — No published privacy notice / terms / provider agreement

- **Problem:** grepped this pass for `/privacy`, `/terms` routes — **not found** in `src/app` (Confirmed, code, this pass).
- **Severity:** P0 — cannot legally collect the personal data the app already collects (phone, ID number, location) without a published notice under the Data Protection Act.
- **Recommended solution:** Legal drafts the documents; engineering builds the routes and a consent-capture step at signup/provider-apply if not already present (**not confirmed** whether any consent checkbox currently exists at signup — flagged as Investigating).
- **Status:** Requires legal review, then Not started (engineering).

---

### LEGAL-006 — No public liability / professional indemnity insurance confirmed

- **Problem:** `docs/14` names this as required "before the first on-site job." Status unknown to this session.
- **Severity:** P0 (for any physical/on-site vertical).
- **Status:** Requires business decision. Blocked — external (insurer relationship).

---

### LEGAL-007 — Data retention periods not defined

- **Problem:** ties together SEC-012, MSG-004; no retention period is defined anywhere for any data class (ID documents, evidence photos, messages, transaction records).
- **Severity:** P1.
- **Status:** Requires business decision + legal review.

---

### LEGAL-008 — Tax treatment by service type not resolved

- **Problem:** `docs/07` explicitly separates the confirmed digital-content-monetisation withholding regime from the unresolved question of trade labour/inspection-fee/platform-fee tax treatment.
- **Severity:** P1.
- **Status:** Requires legal review.

---

### OPS-001 — No admin single-pane transaction-detail view

- **Domain/Subdomain:** Operations / Support
- **Problem:** understanding one transaction's full history today requires querying `service_transactions`, `transaction_events`, `payments`, `payment_provider_events`, `ledger_entries`, `messages`, and `disputes` separately, directly against the database.
- **Evidence:** Confirmed (code) — `/admin/transactions` exists (**not re-audited this pass for exactly what it shows** — Investigating) but the founding brief's own standard ("a support agent must be able to understand a transaction without asking engineering to inspect raw database rows") is very likely not met given the breadth of tables involved.
- **Severity:** P0.
- **Recommended solution:** A `/admin/transactions/[id]` detail view unifying all of the above into one timeline, read-only, with links to take the two existing repair actions (`rpc_resolve_dispute`, manual payment confirmation) directly from that screen.
- **Owner:** Backend + admin frontend.
- **Complexity:** Medium.
- **Resolution (confirmed 2026-09-15):** This was already substantially built — a prior session's own work, referenced there as `MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md` BK-B2/B3/B4/B13, that this register's own "Investigating" status never got closed out. Full read of `/admin/bookings/[id]/page.tsx` this pass confirms it unifies: core transaction fields, payments, ledger entries (**with a live debit=credit balance check rendered on the page itself**), disputes, evidence (flagging any not captured in-app), the customer review, internal admin notes (with an add-note form), the full state-transition event history, and prior admin interventions — all in one page, one query batch, every underlying table's RLS policy confirmed `is_admin()`-gated (no service-role bypass needed). It lives at `/admin/bookings/[id]`, not `/admin/transactions/[id]` as originally proposed — the transactions list (`/admin/transactions`) already links there. This pass added the TXN-010/OPS-002 repair tools directly onto this same page (a "Repair tools" panel, gated by current state). **Not yet done:** payment_provider_events (raw webhook deliveries) isn't surfaced here — a minor gap, low priority until PAY-001 connects a real aggregator generating real webhook traffic to inspect.
- **Status:** Resolved — confirmed pre-existing 2026-09-15, register status corrected to match reality.

---

### OPS-002 — No safe transaction-repair tool beyond 2 narrow RPCs

- **Domain/Subdomain:** Operations
- **Problem:** `rpc_resolve_dispute` and `rpc_convert_deal_desk_request` are the only two "fix a stuck/wrong transaction" tools; anything outside those two exact shapes has no sanctioned admin path.
- **Severity:** P0 — the brief is explicit that direct database edits must not be the normal repair mechanism, and today they effectively are, for anything not covered by those two RPCs.
- **Recommended solution:** Identify the next 2–3 most common repair needs (a wrong amount before funding, a mis-assigned provider, a stuck `checked_in` transaction with no evidence ever submitted) and build narrow, audited RPCs for each, following the exact established pattern (`SECURITY DEFINER`, `is_admin()`-gated, `admin_actions` logged, `app.bypass_txn_guard`-style escape hatch for the one specific transition needed).
- **Owner:** Backend.
- **Complexity:** Medium (one RPC at a time).
- **Resolution (2026-09-15):** Built the register's own three named examples, in
  `supabase/migrations/20260915100000_txn010_force_resolve_enum_value.sql` and
  `20260915100100_txn010_admin_transaction_repair_tools.sql`:
  1. **`rpc_admin_correct_transaction_amount`** — fixes a wrong amount before funding (blocked once `funded_at` is set — the `guard_transaction_financial_write` trigger already enforces this at the DB level, and this RPC checks it explicitly for a clearer error). Recomputes the platform/provider fee via the same `_resolve_fee_pcts` call `rpc_book_service` itself uses, and regenerates any milestone rows against the corrected amount. Single `is_admin()` — no money has moved yet.
  2. **`rpc_admin_reassign_provider`** — fixes a mis-assigned provider, allowed only through `en_route` (before physical work starts, since reassigning after check-in would strand already-released milestone money with the wrong provider). Requires the new provider to be cleared for the category, the same check `rpc_book_service` enforces. Single `is_admin()`.
  3. **`rpc_admin_force_resolve_stuck_transaction`** — resolves a job stuck mid-flight (`checked_in` through `revision_requested`) with no open dispute to anchor a resolution (e.g. a provider checked in and went silent). Structurally mirrors `_execute_refund` almost exactly — same split rule, same already-released-milestone accounting, same materials handling — just keyed on the transaction directly. Money-moving with no dispute record, so this goes through the **same dual-control mechanism** as a real dispute resolution (a new `force_resolve_stuck_transaction` approval-action type, GOV-P4) — a single admin cannot execute it alone.

  Building (3) surfaced a real, separate bug — see **TXN-013** — fixed in the same migration.

  All three wired into `/admin/bookings/[id]` via a new "Repair tools" panel (gated by current state, mirroring each RPC's own guard), and `/admin/approvals` extended to show and link the new dual-control action type.

  Verified live via role-simulated, rolled-back transactions: amount correction resolves fees correctly and is blocked once funded; reassignment is blocked for an uncleared provider and once checked-in, succeeds for a cleared one; force-resolve is blocked from the wrong states, blocks self-decide, a distinct admin's approval correctly splits funds with the full-lifecycle ledger balanced (including the trickiest case — a milestone-qualifying transaction where both `scope_agreement` and `materials` had already released before the stuck resolution).
- **Status:** Resolved 2026-09-15.

---

### OPS-003 — No support/fraud/verification queue triage UI beyond `/admin/verifications`

- **Domain/Subdomain:** Operations
- **Problem:** the founding brief asks for queues covering customer support, provider ops, verification, payment exceptions, disputes, fraud, safety incidents, refunds, payouts, failed notifications, failed jobs, unmatched demand, and escalations. Confirmed to exist today: `/admin/verifications`, `/admin/disputes`, `/admin/payments`, `/admin/deal-desk`, `/admin/transactions`, `/admin/integrations`. **Missing:** fraud, safety, payout, failed-notification, failed-job, and unmatched-demand queues (several of these don't yet have underlying data to queue, since the features they'd surface don't exist yet — e.g. no payout feature exists before PAY-001).
- **Severity:** P1.
- **Status:** Not started (most, pending the underlying features existing first).

---

### OPS-004 — No role-based admin access

- **Domain/Subdomain:** Operations / Security
- **Problem:** `is_admin()` is a single boolean — there is no distinction between customer support, finance, trust & safety, and superadmin roles the brief asks for.
- **Severity:** P1.
- **Recommended solution:** Extend `profiles.role` (or a new `admin_role` enum/table) with named roles and scope each admin RPC/page's access accordingly; keep `is_admin()` as the "any admin role" superset check for backward compatibility with existing RLS policies that only need "is this an admin at all," and add finer-grained checks where a specific action should be restricted (e.g. only finance can call the payment-confirmation RPC).
- **Owner:** Backend.
- **Complexity:** Medium–Large (touches RLS across many tables).
- **Status:** Not started.

---

### OPS-005 — No two-person approval for financial/ban actions

Same underlying gap as PAY-004, filed under Operations for
process-completeness. **Severity:** P0.
- **Resolution (2026-09-15):** Resolved via PAY-004 and the GOV-P4 dual-control mechanism it extended — every financial or ban-type action in this schema now requires two different admins: refunds, customer/provider suspension, category pause (built in an earlier pass), manual payment confirmation (PAY-004), and force-resolving a stuck transaction (TXN-010) all route through the same propose/decide flow, none executable by a single admin. See PAY-004's own register entry for the verification evidence.
- **Status:** Resolved 2026-09-15. See PAY-004.

---

### OPS-006 — No SLA timers or escalation on admin queues

- **Severity:** P2. **Status:** Not started. Depends on OPS-001/003 existing first.

---

### OPS-007 — No internal-notes/assignment mechanism

- **Severity:** P2. **Status:** Not started.

---

### OPS-008 — No customer-visible communication-history view for support

- **Severity:** P2. **Status:** Not started. Depends on OPS-001.

---

### DR-001 — No backup-restore has ever been tested

- **Domain/Subdomain:** Disaster Recovery
- **Problem:** Supabase performs automated backups by plan tier (**exact tier and retention window: Blocked — external access, same unresolved unknown as every other infra-limit item in this program**), but no restore has ever actually been performed and verified in this project's history.
- **Severity:** P0.
- **Recommended solution:** Perform a real restore-to-a-scratch-Supabase-project test, time it, and document the procedure.
- **Status:** Not started. Requires external access (Supabase dashboard/billing to confirm backup tier).

---

### DR-002 — No RPO/RTO defined

- **Severity:** P1. **Status:** Not started. Requires business decision (acceptable data-loss and downtime windows).

---

### DR-003 — No documented outage runbook

- **Severity:** P1. **Status:** Not started.

---

### DR-004 — No read-only/degraded-mode capability

- **Problem:** no mechanism exists to put the app into a read-only mode during an incident (e.g., to stop new bookings while a payment issue is being investigated) short of the emergency-pause work in TSF-014.
- **Severity:** P2. **Status:** Not started. Overlaps TSF-014.

---

### DR-005 — No post-incident-review process defined

- **Severity:** P2. **Status:** Not started.

---

### REL-001 — No documented release checklist

- **Severity:** P1. **Status:** Not started.

---

### REL-002 — No staging environment exists

- **Domain/Subdomain:** Release Engineering
- **Problem:** every migration and every piece of verification in this project's entire history has been applied directly to the single production Supabase project, with role-simulated transactions as the safety net rather than a genuinely separate environment.
- **Evidence:** Confirmed (code/session history) — `MARKETPLACE_SCALE_IMPLEMENTATION_PLAN.md` explicitly names this as deferred ("needs a new Supabase project, a cost/access decision not mine to make unilaterally").
- **Severity:** P0.
- **Recommended solution:** Create a second Supabase project (Supabase branching, if available on the current plan — **Blocked — external access** to confirm) seeded with synthetic data; point a preview Vercel deployment at it; require every future migration to land there first.
- **Status:** Not started. Requires business decision (cost) + external access.

---

### REL-003 — No smoke-test suite run post-deploy

- **Severity:** P1. **Status:** Not started. Depends on REL-002/SEC-001.

---

### REL-004 — No feature-flag mechanism

- **Severity:** P2. **Status:** Not started.

---

### ANALYTICS-001 — No event-tracking pipeline for customer/provider funnels

- **Domain/Subdomain:** Analytics
- **Problem:** none of the funnel steps `docs/13`/the founding brief names (landing→discovery→request→quote→accept→checkout→payment→booking→service→review→repeat, and the parallel provider funnel) are instrumented anywhere.
- **Severity:** P1.
- **Recommended solution:** A lightweight, privacy-conscious event table (`analytics_events`: user_id nullable for anon, event_name, properties jsonb, created_at) written to from key server actions/pages, queried for dashboards — deliberately not a third-party analytics SDK shipping PII off-platform without a data-processor agreement (ties to LEGAL-007).
- **Owner:** Backend/data.
- **Complexity:** Medium.
- **Status:** Not started.

---

### ANALYTICS-002 — No marketplace-health dashboard

Depends on ANALYTICS-001 and LIQ-001. **Severity:** P1. **Status:** Not started.

---

### ANALYTICS-003 — No technical-health dashboard

- **Problem:** p50/p95/p99 latency, error rate, DB saturation, connection-pool utilization are not visible anywhere — Vercel/Supabase provide some of this natively in their dashboards (**Not confirmed** what's actually enabled/viewed), but nothing is aggregated into one operational view, and no alerting exists.
- **Severity:** P1.
- **Recommended solution:** Confirm what Vercel Analytics/Supabase's built-in dashboards already provide (likely covers a meaningful chunk of this for free) before building anything custom; add a lightweight external status/alerting integration (e.g. a hosted uptime monitor hitting `/api/health`, already built) as the cheapest first step.
- **Status:** Not started.

---

### ANALYTICS-004 — No cost-to-serve / contribution-per-job computation

Depends on ANALYTICS-001 + real transaction volume. **Severity:** P1.
**Status:** Not started.

---

### ANALYTICS-005 — No category-level contribution-margin reporting

Depends on ANALYTICS-004. **Severity:** P2. **Status:** Not started.

---

### ANALYTICS-006 — GMV/materials-pass-through separation not dashboarded

- **Problem:** the *correct* GMV calculation already exists in code as a comment/convention (`src/app/admin/page.tsx`'s GMV stat correctly excludes `materials_amount_minor` — **Confirmed, code**, re-verified this pass), which is good — but it exists in exactly one place (`/admin`'s overview card), not as a reusable, trustworthy metric definition available to any future dashboard.
- **Severity:** P2.
- **Recommended solution:** Extract the GMV formula into a single, tested, documented SQL view or function so every future dashboard/report uses the same, correct definition rather than each author re-deriving it (and risking the exact `formatMoney` off-by-100 class of bug found and fixed in the original build — `SECURITY.md`, "A real, live money-display bug").
- **Status:** Not started.

---

### LOADTEST-001 — No staging environment for load testing

Same underlying gap as REL-002. **Severity:** P0. **Status:** Not started.

---

### LOADTEST-002 — No load test at any scale has ever been executed

- **Evidence:** Confirmed (session history) — `MARKETPLACE_SCALE_READINESS_AUDIT.md` §10 is an explicitly-labeled "proposed, not executed" plan; nothing since has changed that.
- **Severity:** P0 for any claim of "5,000-user ready"; not a blocker for launch at current (near-zero) real traffic.
- **Status:** Not started. Depends on LOADTEST-001/REL-002.

---

### LOADTEST-003 — No concurrency test proving no duplicate financial outcomes under real parallel load

- **Problem:** the idempotency work done in the prior session was verified via **sequential** role-simulated SQL calls within one session, not genuinely concurrent load from multiple real connections — the advisory-lock overlap guard on the auto-approve sweep specifically was flagged as **not independently verified under true cross-session contention** (session-reentrant lock limitation, stated honestly in `MARKETPLACE_SCALE_READINESS_AUDIT.md` §14).
- **Severity:** P1.
- **Recommended solution:** Once a staging environment exists (LOADTEST-001), run a genuine concurrent-request test (e.g. `k6` or a small script firing N simultaneous requests from N real connections) against `rpc_book_service` with the same idempotency key, and against the auto-approve sweep's locked wrapper from two real, separate connections.
- **Status:** Not started.

---

### PERF-001 — Infra plan limits unconfirmed

Carried over across sessions, **narrowed this pass**: the Vercel MCP tool
is now reachable and returned the connected team's plan (`kelvin's
projects`, hobby) — but `mcp__Vercel__list_projects` against that team
returns exactly one project, `snack-quest` (linked to a different GitHub
repo, `kelvinsnowden/Snack-Quest`), **not** `flerwa`. The tool works; it
cannot see the project this codebase actually deploys to. Supabase plan
limits remain fully unconfirmed (no equivalent tool access attempted to
resolve that half this pass). **Severity:** P1. **Status:** Blocked —
external access (specifically: the connected Vercel account/team does not
include the `flerwa` project; Supabase billing/plan dashboard access
remains unattempted).

---

### PERF-002 — Real cross-session advisory-lock contention never independently verified

Same item as LOADTEST-003's second half; kept as a separate Performance-domain
entry since it's specifically about the scheduler's overlap guard, not
general load testing. **Severity:** P2. **Status:** Not started.

---

### REG-002 — 18 local migration filenames didn't match their applied remote version

- **Domain/Subdomain:** Release Engineering / Migration hygiene
- **Problem:** 18 of 52 local `supabase/migrations/*.sql` filenames used a
  different (rounder) timestamp than the version actually recorded for
  that same logical migration in `supabase_migrations.schema_migrations`
  on the live project.
- **Correction (this pass):** the prior report's claim that content was
  "verified to be identical, spot-checked byte-for-byte" was **overstated**
  — it was based on loosely eyeballing 2 files, not a systematic check. A
  rigorous re-verification this pass (MD5 of each local file vs.
  `md5(statements[1])` from `schema_migrations` for all 18) found: **2 of
  18 are exact full-content matches; 6 more match exactly after stripping a
  leading comment-only block; 1 is a trivial single-character (trailing
  newline) difference; 9 have differences not explained by a simple
  leading-comment strip.** Of those 9, the two touching money-moving logic
  (`guard_transaction_financial_writes`, `admin_dispute_and_deal_desk`) were
  fully `diff -u`'d against the exact remote-recorded text (fetched via
  `execute_sql`) — **both diffs are comment-only** (extra explanatory
  comments and minor em-dash/backtick edits added locally after the
  migration was applied, predating and unrelated to this session's rename
  work); zero difference in any executable SQL statement, function body,
  trigger, or grant. **The remaining 7 of the 9 were not individually
  diffed** — the comment-only characterization for them is inferred from
  this consistent pattern, not independently confirmed file-by-file. This
  is a correction of an earlier overclaim, not a new defect: the rename
  operation itself (`git mv`, confirmed via `git diff --cached --summary`
  showing all 18 as `(100%)` renames, `0 insertions(+), 0 deletions(-)`)
  introduced zero content change either way.
- **Why it matters:** any tool that derives "which migrations are applied"
  from local filenames (the Supabase CLI's `db push`/`migration list`
  workflow) would see 18 filenames with no matching remote version and
  could attempt to re-apply them — most contain non-idempotent DDL
  (`create table`/`create type` with no `if not exists`) that would fail
  loudly, or worse, partially apply before failing, if ever run against
  this specific database via local CLI tooling.
- **Current state (before fix):** 18/52 mismatched, discovered via a
  systematic filename-vs-`list_migrations` diff performed this pass — not
  previously documented in any prior session's work.
- **Evidence:** Confirmed by repository inspection + database inspection
  (`MARKETPLACE_REMEDIATION_CONTINUATION_BASELINE.md` §3).
- **Severity:** P2 (latent — has caused no actual incident, since every
  migration in this project's history has been applied via the Supabase
  MCP tool directly, never local CLI tooling).
- **Recommended solution / implementation:** `git mv` each of the 18 files
  to the exact applied version+name. No SQL, no DB change — pure filename
  correction.
- **Test performed:** re-ran the filename-vs-`list_migrations` diff after
  renaming — **0 mismatches, 52/52 exact match** (`set(remote) ^
  set(local) == set()`). `npx tsc --noEmit` and `npm run build` both
  re-run clean after the rename (renaming migration files touches no
  application code, confirmed by the build having zero new errors).
- **Definition of done:** local filenames exactly match applied remote
  versions for all 52 migrations. **Met.**
- **Status:** Fixed and verified.

---

### TXN-003 — Lock audit, updated: 2 of 5 RPCs confirmed this pass

- **Update to the original TXN-003 finding:** `rpc_provider_check_in` and
  `rpc_submit_completion` were both re-read in full this pass and confirmed
  to use `select ... for update` before checking/writing state (Confirmed,
  code — see `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` §1's updated
  table).
- **Still open:** `rpc_request_revision`, `rpc_open_dispute`, and
  confirming `rpc_approve_and_release`'s exact release mechanics — not
  re-read this pass.
- **Status:** In progress (2/5 closed).

---

### TXN-003 — Lock audit, closed 2026-09-15: 5 of 5 confirmed

- **Update to the above:** the 3 remaining RPCs were read in full AND
  cross-checked against the live database (`select prosrc ilike '%for
  update%' from pg_proc where proname = ...`), not just the migration
  files — worth calling out explicitly since `rpc_cancel_booking` alone
  was redefined 3 separate times across this session's migrations, so a
  stale local file read could easily have given a false answer.
  `rpc_request_revision` and `rpc_open_dispute` both take `select ...
  for update` directly. `rpc_approve_and_release` itself has **no**
  lock (confirmed live) — but it does nothing except an authorization
  check before unconditionally calling `_release_transaction`, which
  does take the lock (confirmed both in file and live). This is the
  same "cheap auth check, then a locked internal delegate" shape
  already used by `rpc_confirm_manual_payment` → `_fund_transaction`
  elsewhere in this schema — not a gap, just a two-function split.
- **Status:** Resolved 2026-09-15. See `MARKETPLACE_REMEDIATION_REGISTER.md`'s
  TXN-003 entry above and `MARKETPLACE_TRANSACTION_STATE_MACHINE.md` §1
  for the final table.

---

### TXN-005 / PAY-009 — Cancellation logic, investigation closed this pass

- **Finding, now definite (was "Investigating"):** `rpc_cancel_booking` was
  re-read in full this pass. Customer-only, flat 100% refund for any
  cancellation before check-in (writes real `ledger_entries` and
  `payments.state = 'refunded'` — correcting the payments plan's earlier,
  incorrect claim that no refund row-shape exists), hard-blocked entirely
  from `checked_in` onward. `docs/07`'s >24h/<24h/after-check-in
  fee-tiering is **confirmed not implemented** — there is no comparison
  against `scheduled_for` anywhere in the function, and the "provider is
  compensated after check-in" case is unreachable (cancellation is refused
  outright at that point, not resolved with a payout).
- **Financial risk:** a provider gets zero compensation for a
  last-minute cancellation, contrary to `docs/07`'s stated design
  principle. See `MARKETPLACE_PAYMENTS_AND_RECONCILIATION_PLAN.md` §2.5
  for the full writeup.
- **Recommended next action:** implement the fee-tiering, pending founder
  sign-off on the exact percentages/time windows (`docs/07`'s matrix is a
  recommendation, not yet a ratified policy — ties to
  `DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL` item #4).
- **Status:** TXN-005 confirmed not fixed (investigation closed, real
  finding). PAY-009 narrowed: a refund path *does* exist for pre-check-in
  cancellation (not "missing" as originally filed) — what's actually
  missing is the fee-tiered variant and any post-check-in payout path.

---

### SEC-001 — Regression-test foundation started this pass

- **Update to the original SEC-001 finding:** a test runner now exists.
  `vitest@3` added as a devDependency (`vitest@5` was tried first but
  conflicts with the project's pinned `@types/node: "^20"` peer range —
  `vitest@3` accepts `^18.0.0 || ^20.0.0 || >=22.0.0`, so it was used
  instead rather than widening an unrelated dependency's range). `"test":
  "vitest run"` added to `package.json` scripts.
- **Tier 1 (true unit tests, no DB/network — genuinely run and passing,
  confirmed via `npx vitest run`, 27/27 passed):**
  - `src/lib/money.test.ts` (4 tests) — regression coverage for the exact
    100x-display bug documented in `money.ts`'s own header comment.
    Uncovered a real, separate, minor finding along the way: this
    environment's ICU data renders `Intl.NumberFormat("en-KE", {currency:
    "KES"})` as `"Ksh"` (lowercase s) with a **non-breaking space** (U+00A0,
    confirmed via codepoint inspection) before the digits, not `"KSh"` with
    a regular space as the code comment (written against a different
    environment) implies. Not a logic bug — ICU currency-symbol rendering
    is locale-data-dependent across Node/ICU builds — so the tests assert
    the digits/grouping/decimal behavior precisely and tolerate the
    capitalization/whitespace variance. Documented here so a future
    "KSh" vs "Ksh" difference in a screenshot isn't mistaken for a
    regression.
  - `src/lib/phone.test.ts` (14 tests) — `normalizeKenyanPhone`/
    `formatKenyanPhoneDisplay`, covering all accepted input shapes (9-digit
    national, leading-zero local, `+254`/`254` international, spaced input)
    and rejection cases (wrong prefix, wrong length, non-Kenyan country
    code, non-digit input). This is the parser for the phone-OTP
    auth-identifier path.
  - `src/lib/safe-redirect.test.ts` (9 tests) — `safeNext`, the
    authorization boundary preventing an open-redirect via a
    fully-attacker-controlled `next` form field/query param (protocol-
    relative `//`, absolute external URL, `javascript:` pseudo-protocol,
    missing leading slash all correctly rejected to the fallback).
- **Tier 2 (DB-level invariant checks — no TS-side pure-function
  equivalent exists for these; the invariants themselves live in
  SQL/plpgsql, per this codebase's established "RPCs are the only
  mutation path" architecture). Executed live this pass, each inside a
  `begin; ... rollback;` transaction via the Supabase MCP `execute_sql`
  tool so nothing persisted — genuinely run, not reasoned about, but not
  wired into `npm test`/CI, since this sandbox has no verified network
  path to the live Supabase project from a `vitest`/Node process (see
  `money.ts`'s own header comment, which independently documents this same
  sandbox limitation from an earlier session) and there is no local
  Postgres/Supabase-CLI stack available here either:**
  - **Idempotent webhook ingestion (Verified by test):** called
    `rpc_ingest_payment_event('manual','other',null,'regtest-dedupe-key-001',0,'KES',false,'{}'::jsonb)`
    twice with an identical `(provider_key, external_reference,
    event_type)` inside one transaction; `count(*) for that key = 1`
    afterward, proving the `payment_provider_events_dedupe_idx` unique
    partial index + `on conflict ... do nothing` genuinely prevents a
    duplicate row on a vendor retry. Code-read confirms funding
    (`_fund_transaction`) is only reached on the branch where a *new* row
    was actually inserted, so a retried delivery can never double-fund.
  - **Payment/booking state-transition guard (Verified by test):**
    attempted a direct `update service_transactions set state = 'settled'`
    against a real existing row inside a rolled-back transaction; the
    guard trigger (`trg_guard_transaction_financial_write`) fired with the
    exact expected error ("service_transactions.state cannot be set to
    settled directly. Use rpc_confirm_manual_payment or
    rpc_approve_and_release.") rather than allowing the write. Zero data
    changed (rolled back).
  - **Ledger balance invariant:** already covered by PAY-006
    (`rpc_check_ledger_balance`), itself the daily regression check —
    see that item; not re-duplicated here.
  - **Cancellation behavior (Confirmed by code inspection only — not
    executed live this pass):** `rpc_cancel_booking` re-read; confirmed
    row-locked (`for update`), authorization-bound to the transaction's
    own customer (`auth.uid()`), state-guarded (rejects once past
    `en_route`), and self-guarding against a double-refund (a second call
    on an already-`refunded`/`cancelled_by_customer` transaction fails the
    same state check, since that state is no longer in the allowed set —
    traced, not executed).
  - **Authorization boundaries:** `safeNext` unit-tested (Tier 1, above);
    RPC-level authorization (`is_admin()`/`auth.uid()` ownership checks,
    service-role-only grants on financial functions) previously confirmed
    by code inspection and grant queries under PAY-006 and TXN-003/005 —
    not re-verified as a distinct Tier-2 exercise this pass.
- **What this explicitly is not:** a CI pipeline (none exists — no
  `.github/workflows/`), a mocked integration test against Supabase (none
  written — would only test the mock, not real behavior, so deliberately
  not fabricated), or coverage of every RPC (`rpc_request_revision`,
  `rpc_open_dispute`, `rpc_approve_and_release`'s lock behavior, and the
  full cancellation-fee-tiering gap remain outside this pass's scope —
  see TXN-003, TXN-005).
- **Definition of done (original):** not yet met — this is a first
  milestone (framework selected + wired + real passing tests for 2 of the
  6 named risk categories fully, a 3rd partially by code inspection), not
  the full suite described in the original recommended solution (RLS role-
  simulation tests, mocked route-handler tests, CI wiring all remain
  undone).
- **Status:** In progress (upgraded from Not started).

---

## DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL

### RESOLVED 2026-09-14 — founder decisions (all 16 pending items answered)

All items below (the original 12-item list further down this section, plus
GOV-P1–P4 from `MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md`, plus the two new
findings this pass) were brought to the founder as explicit questions and
answered directly. Recorded verbatim/paraphrased here as the founder's own
decision — the original numbered list below is left intact underneath as
historical context (options considered, recommended defaults, risk
analysis) but is **superseded by this block** wherever the two disagree.

1. **Admin roles (GOV-P1–P4):** Build the full role/permission matrix now
   — not deferred, not a lightweight single-role add. Scope: granular
   roles, a role-assignment UI, per-action permissions beyond `is_admin()`,
   and dual control (see #4 below). This is the largest single item in
   this list — was previously sequenced last (Phase C) in the capability
   matrix's own plan; founder has now moved it earlier.
2. **Payment aggregator:** **Pesapal** (not IntaSend, which had the
   scaffolded adapter — a new adapter needs to be written for Pesapal
   following the same `PaymentProviderAdapter` interface/pattern).
3. **Email vendor for the support system:** **Mailgun** (not Resend, which
   already has a working, unit-tested adapter — a new
   `EmailProviderAdapter` implementation needs to be written for Mailgun
   following the exact same interface; the interface itself was
   deliberately built provider-agnostic for exactly this situation).
4. **Refund/payout/ban/pause authorization:** **Two-person approval for
   everything**, no single-admin threshold. This is a stricter posture
   than the register's own recommended default (single admin under a
   threshold) — every privileged financial/moderation RPC will need a
   propose/approve (or equivalent dual-sign) pattern, not just an
   `is_admin()` check.
5. **Launch vertical/corridor:** Follow `docs/09`'s recommendation as-is.
6. **Platform fee model:** **Build the full differentiated-by-vertical
   model now** (not deferred) — needs a fee-schedule table keyed by
   category and pair-history per `docs/10`, not a hardcoded constant.
7. **Verification tiers:** Adopt `docs/06`'s Tier 0–3 table verbatim.
8. **Legal budget:** Founder's own position (paraphrased): *"As long as a
   third party is holding the documents and the money, the docs/14
   estimate (KSh 1.2–2.0M) is out of touch"* — i.e., using a licensed
   third-party aggregator (Pesapal, per #2) to actually hold funds/manage
   KYC materially reduces the platform's own PSP-status and
   money-transmission exposure relative to what docs/14 assumed, so that
   budget is considered overscoped. **No replacement figure given yet.**
   Flagging honestly: this is a legal judgment call, not an engineering
   one — the reduced-scope assumption should still be confirmed with an
   actual lawyer before any LEGAL-00x item is treated as closed on this
   basis; nothing here should be read as legal advice or a substitute for
   that confirmation.
9. **Staging environment:** Approved — set up a second Supabase project +
   preview deployment now.
10. **Support hours/on-call:** Define severity tiers (P0/P1/P2 etc.) now;
    owner-per-tier still TBD (no dedicated support hire yet).
11. **Recurring-service bookings + milestone payments:** **Build both
    now** (not deferred) — two separate, real schema commitments: booking
    series/scheduling rules/per-occurrence state, and partial-release
    payments tied to defined milestones instead of one lump sum.
12. **SMS/WhatsApp support channel:** Not yet — stay email-only (Mailgun,
    per #3) until that's proven end-to-end first.
13. **Dual-coverage (second-inspector) sampling:** Not yet — deferred
    entirely until a real Tier 3 transaction exists to protect.
14. **Data retention periods:** Founder wants **longer retention (roughly
    1–7 years, for compliance/dispute purposes)** rather than short
    (~30–90 day) retention. Exact figure within that range not yet
    pinned down; a real deletion job still needs to be built once it is.
15. **ODPC registration:** **Not registered yet** — this is a real,
    confirmed open action item, not just an unknown. Likely belongs
    inside whatever legal engagement scope replaces the docs/14 estimate
    (#8).
16. **Production QA/test fixture data:** Leave everything as-is for now
    (including the ambiguous `"kelvin Muthomi kimathi"` row) — no purge.
    Revisit before any real user sees the admin dashboard, provider
    lists, or any trusted analytics/metrics query, since this data will
    otherwise appear indistinguishable from real activity.

**What this block does not do:** none of the engineering implied by
decisions 1, 2, 3, 6, and 11 has been built yet — this is the record of
*what was decided*, not a changelog of work done. See the founder's own
next input for how these should be sequenced; attempting all five in
parallel is not recommended given their combined size.

---

Every decision below blocks at least one register item above (cross-referenced).
Format: Decision · Why it matters · Options · Recommended default · Risks ·
Information needed · Owner · Deadline/dependency.

1. **Which service categories/verticals launch first, in which corridor.**
   Why: gates LIQ-004, LIQ-006, every provider-recruitment task. Options:
   follow `docs/09`'s recommended launch vertical, or a different one.
   Recommended default: `docs/09`'s own recommendation (not re-litigated
   here). Risks: horizontal over-expansion (`docs/14` risk #1). Owner:
   Founder. Deadline: blocks all supply-side work.

2. **Platform fee model and exact percentages by vertical.** Why: blocks
   PAY-007. Options: ship `docs/10`'s full differentiated model now, or keep
   the current flat 12% and revisit later. Recommended default: ratify
   `docs/10`'s model in writing even if implementation is deferred, so the
   gap between strategy and code is a known, tracked decision rather than an
   accidental drift. Owner: Founder. Deadline: before real transaction
   volume makes changing the fee structure disruptive to existing users.

3. **What qualifies as "verified" at each tier, exact evidence required per
   category.** Why: blocks PROV-001/002. Options: adopt `docs/06`'s Tier 0–3
   table verbatim, or modify. Recommended default: adopt verbatim; it is
   detailed, cited, and internally consistent. Owner: Founder + trust & safety
   lead. Deadline: before onboarding any real Tier 2/3 provider.

4. **Cancellation/refund/dispute policy numbers.** Why: blocks TXN-005,
   PAY-009, the published customer/provider-facing policy pages (LEGAL-005).
   Recommended default: `docs/07`'s failure matrix. Owner: Founder +
   legal review. Deadline: before publishing terms.

5. **Payment aggregator selection and go-live timeline.** Why: blocks
   PAY-001 and everything downstream of it. Options: IntaSend (adapter
   already scaffolded in code), Kora, Paystack, Pesapal, Flutterwave.
   Recommended default: IntaSend, since it already has a scaffolded adapter
   — switching later is a registry-config change, not a rewrite
   (`src/lib/payments/registry.ts`). Owner: Founder. Deadline: before any
   real payment.

6. **Legal engagement scope and budget.** Why: blocks LEGAL-001..008 and,
   transitively, PAY-001, TSF-012/013, LEGAL-004/005/006. Recommended
   default: `docs/14`'s suggested KSh 1.2–2.0M budget and item list. Owner:
   Founder. Deadline: before accepting the first real payment.

7. **Support hours, on-call ownership, incident severity definitions.** Why:
   blocks TSF-013, DR-002/003, OPS-004. Owner: Founder/operations lead.
   Deadline: before any physical/on-site transaction.

8. **Who is authorized to trigger a refund, payout override, ban, or
   emergency pause — and whether/when dual control is required.** Why:
   blocks PAY-004, OPS-004/005, TSF-014. Recommended default: any single
   admin for actions under a threshold; two-person approval above it and for
   all bans/pauses. Owner: Founder. Deadline: Phase 0 exit criterion.

9. **Staging-environment budget (a second Supabase project + preview
   deployment).** Why: blocks REL-002, LOADTEST-001, and by extension every
   future migration's safety margin. Owner: Founder (cost approval). Deadline:
   before Phase 2.

10. **Whether to build the recurring-series (TXN-011) and milestone-payment
    (TXN-012) features in the current phase or defer them.** Why: both are
    large schema commitments described in strategy docs but not yet
    scoped as near-term work. Owner: Founder/product. Deadline: Phase 1/2
    planning.

11. **Email/SMS/WhatsApp notification vendor and budget.** Why: blocks
    NOTIF-001/002. Owner: Founder. Deadline: Phase 1.

12. **Dual-coverage (second-inspector) sampling rate and cost absorption.**
    Why: blocks TSF-005, the strategy docs' own highest-rated anti-fraud
    control. Owner: Founder. Deadline: before the first Tier 3 (remote-
    principal/representation) transaction.

---

### SEC-001 — CI wired this pass

- **Update:** `.github/workflows/ci.yml` added — runs `tsc --noEmit`, `npm
  test` (vitest), and `npm run build` on every push/PR. **Verified by
  test:** ran the exact same three commands locally under a scrubbed
  environment (`env -i`, only placeholder `NEXT_PUBLIC_SUPABASE_URL`/
  `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` set, matching what a real CI
  runner has — no `.env.local`) to confirm the workflow will actually pass
  once pushed, not just that it looks right. All three succeeded.
- **Not done:** the workflow hasn't run on GitHub's infrastructure itself
  yet (only locally simulated) — that will be confirmed the first time
  this branch's commits reach GitHub. No branch-protection rule requires
  it to pass yet — see below.
- **Status:** In progress (CI added; branch protection still manual).

---

### SEC-001 — Tier 1 DB harness + tier 2 server-action tests added 2026-09-15

- **Update:** a prior pass's own SEC-001 entry already identified that
  this sandbox has no verified network path from a `vitest`/Node process
  to the live Supabase project (no `DATABASE_URL`/service-role-equivalent
  credential exposed by any tool available here, and outbound network
  goes through an HTTPS-only proxy a raw Postgres connection likely
  wouldn't route through) and no local Postgres/Supabase-CLI stack — and
  worked around it by running DB-level checks live via the Supabase MCP's
  `execute_sql` tool, verified but never turned into committed test
  files. This pass turns that pattern into real, permanent,
  `SUPABASE_DB_URL`-gated test files for the first time: `tests/db/`
  (new directory) — `client.ts` (a `withRolledBackTransaction` helper
  wrapping the `postgres` npm package, new devDependency, plus the same
  `asUser`/role-simulation pattern used throughout this project's manual
  verification) and two real suites, `dual-control.test.ts` (PAY-004's
  propose/decide/self-block/distinct-admin flow, plus a regression guard
  for SEC-013's exact bug class — the `_execute_*` functions staying
  un-callable directly by `anon`/`authenticated`) and
  `cancellation-fees.test.ts` (all four of TXN-005's fee tiers). Every
  test `describe.skipIf(!SUPABASE_DB_URL)`s itself — `npm test` still
  exits 0 without the credential, reported as skipped, not silently
  passing or breaking the suite. The SQL each test runs was validated the
  same way the prior pass's checks were (live, via `execute_sql`, rolled
  back) before being transcribed — real verification of the logic, but
  not the same claim as this exact file having been executed by `vitest`
  itself; see `TESTING.md` for the honest distinction and what a repo
  secret would need to turn this on for real in CI.
- **Also fixed, tier 2:** two real, previously-blocking bugs in the test
  setup itself, not just "no tests existed yet" — `vitest.config.ts`
  didn't resolve the `@/*` alias Next's own `tsconfig.json` defines (Vite
  doesn't read `tsconfig.json` paths automatically), and nothing mocked
  the `server-only` package, which throws unconditionally outside Next's
  bundler. Both meant **no test file could import any server action
  module at all** until this pass — confirmed by reproducing the exact
  failure with the first action test file added. Fixed once,
  `vitest.setup.ts` + `vitest.config.ts`, benefiting every future test in
  this tier, not just the ones added here. Four new suites: `cancelBooking`/
  `openDispute`/`approveBooking`, the three TXN-010 repair actions, and
  `confirmPayment` — each asserting the exact RPC name/params sent and
  that a database error is surfaced rather than thrown or swallowed.
- **Verified:** `npm test` — 69 passed, 8 skipped (the DB tier), 0
  failed; `npx tsc --noEmit` clean; `npm run build` clean.
- **Not done, stated rather than silently assumed solved:** full closure
  needs every RPC listed under "financial/authorization logic" in
  `SECURITY.md` to have a tier-1 test for both the authorized and
  unauthorized path — genuinely multi-week given the number of RPCs in
  this schema, unchanged from the original estimate. No negative-RLS
  suite yet (a customer directly reading/writing another customer's row,
  etc.) beyond what's incidentally covered. `TESTING.md` written as the
  actual next-steps document, including the template these two suites
  set for adding more.
- **Status:** In progress — real tier 1 + tier 2 infrastructure and
  first suites in place; full RPC coverage remains open.

---

### PAY-006 — Ledger reconciliation alerting added this pass

- **Update:** the daily reconciliation job previously only wrote to
  `scheduler_runs`/`console.log` with no notification path — a real
  imbalance or a job that failed to run would sit unseen unless someone
  checked logs. `src/lib/alerts.ts` (`sendOpsAlert`) added and wired into
  `/api/cron/ledger-reconciliation` for both failure modes (execution
  error, and `imbalance_count > 0`). Gated entirely behind
  `RESEND_API_KEY`/`ALERT_EMAIL_TO`/`ALERT_EMAIL_FROM` — logs and no-ops
  cleanly if any are unset, and can never throw or block the response the
  route gives Vercel (**Verified by test** — 5 unit tests in
  `src/lib/alerts.test.ts`, including a mocked-network-failure case).
- **Blocker, real and unresolved:** actually delivering an alert requires
  a Resend account with a **verified sending domain** — this session's
  connected Resend MCP account has zero domains configured
  (`list-domains` returned none), and the tool's own `send-email` action
  explicitly requires a human-supplied `from` address, so this cannot be
  wired end-to-end from inside a session even with a domain. **Requires
  founder action:** create/connect a Resend account, verify a sending
  domain, set the three env vars in the real Vercel project. Until then
  this is `Implemented but unverified in production` — the no-op path is
  Verified by test; the actual-delivery path is not.
- **Status:** Implemented but unverified in production (delivery path
  blocked on external account setup).

---

### PAY-004 / LEGAL-001,002,005,006,008 — Payment-provider legal-signoff gate added this pass

- **New control, additive migration applied live
  (`20260913140512_payment_provider_legal_signoff_gate.sql`):**
  `rpc_set_active_payment_provider` previously let any single admin
  activate `intasend` (a real money-moving aggregator) with no check
  beyond `is_admin()` — meaning it could be flipped live before any of
  LEGAL-001/002/005/006/008 were resolved, by accident or otherwise. This
  does **not** resolve any of those legal questions — that remains a
  founder/legal decision, unchanged. It adds `payment_providers.
  legal_signoff_confirmed_at/_by/_note` (all nullable, default null) and a
  new `rpc_confirm_payment_provider_legal_signoff(key, note)` admin RPC
  that must be called — with a non-empty note — before
  `rpc_set_active_payment_provider` will activate any `kind = 'aggregator'`
  provider; `kind = 'manual'` (the currently-active provider) is exempt.
- **Verified this pass:** migration applied cleanly; `payment_providers`
  state unchanged after (`manual` still `is_active=true`, `intasend` still
  `false`, both new-column values `null` as expected); grants on both RPCs
  confirmed identical in shape to every other admin RPC (`authenticated` +
  `postgres` + `service_role`, no `anon`) via `information_schema.
  routine_privileges`. **Not verified:** the `is_admin()`-gated logic
  branch itself could not be exercised live from this session — `execute_
  sql` runs outside any real user session, so `auth.uid()` is null and
  every call hits "Only an admin..." before reaching the sign-off check;
  exercising the actual gate requires a real authenticated admin session
  (browser or a test harness with a real JWT), not attempted this pass.
- **Status:** Implemented but unverified (schema/grants: Verified by test;
  guard logic itself: Confirmed by code inspection only).

---

### New finding this pass — production database holds only QA/test fixture data, no purge plan exists

- **Problem:** despite LIQ-006 stating "zero published providers on
  production," the live database has real rows: 13 `profiles` (all with
  matching real `auth.users` entries — confirmed via a join, so a purge
  needs the Supabase Admin API, not a table `DELETE`), 5 `providers`, 6
  `service_transactions`, 4 `ledger_entries`. All 13 profiles are
  identifiable: 8 are literally named `"QA fixture (unpublished, do not
  use)"` (created 2026-09-10, roles customer/admin), 4 more are named `"QA
  Customer One"`, `"QA Seller One"`, `"QA Location Test"`, `"UX Audit
  Tester"`, `"UX Audit Provider"` — all clearly artifacts of prior
  sessions' live browser-based QA (Kernel click-throughs) against this
  same production project, not synthetic inserts. **One row is ambiguous
  and was not assumed either way:** `"kelvin Muthomi kimathi"` (created
  2026-09-10 13:38) — could be the founder's own manual test account or a
  real early signup; flagged for the founder to identify, not guessed at.
- **Why it matters:** these transactions/ledger entries are real rows in
  the exact tables `rpc_check_ledger_balance` (PAY-006) reconciles — they
  don't cause a *false* imbalance (double-entry still holds for test data),
  but they will appear in the admin dashboard, provider lists, and any
  future analytics query as if they were real activity, and would need
  deliberate exclusion or removal before real users see them or before any
  metrics are trusted.
- **What was deliberately not done:** no row was deleted or altered. This
  session's standing instruction throughout — never delete or alter
  production data without explicit authorization — applies squarely here;
  a purge is also irreversible for the `auth.users` half of it.
- **Recommended action:** founder reviews the exact list above (available
  via the `profiles`/`service_transactions`/`ledger_entries`/`providers`
  queries in this entry's evidence), confirms which rows are safe to
  remove, and either purges before any real user/provider is onboarded, or
  explicitly accepts them as known seed/demo content and documents that
  decision so it isn't mistaken for a data-integrity bug later.
- **Severity:** P2 (no financial or security risk today — zero real users
  exist yet — but becomes confusing/embarrassing the moment a real admin
  or provider looks at these lists).
- **Status:** Not started. Requires founder review before execution (no
  code change proposed here — this is a data decision, not a code gap).

---

### New finding this pass — no branch protection, no code-review gate exists

- **Problem:** the entire repository has exactly one branch
  (`claude/african-creator-marketplace-wy6d7s`, confirmed via `git branch
  -a` and `list_branches` returning a single row) — everything, including
  every financial/authorization change made across this whole remediation
  program, has been pushed straight to it with no required status check
  and no human review gate. No GitHub branch-protection API is exposed
  through the tools available in this session, so this could not be
  configured directly.
- **Recommended action (founder, ~2 minutes in GitHub's UI):** Settings →
  Branches → add a protection rule for this branch requiring the new `CI`
  check (see SEC-001 above) to pass before merging, and optionally
  requiring a pull-request review once there is more than one contributor.
- **Severity:** P1 — process risk, not a code defect; compounds with every
  future change until addressed.
- **Status:** Not started. Requires founder action (tool access
  unavailable).

---

### New finding this pass — standing AI-agent access to production has no defined end state

- **Problem:** this and prior sessions have held direct, unscoped access
  to the live Supabase project (schema changes, direct SQL, service-role-
  equivalent queries) via MCP tooling, and attempted the same for Vercel.
  No decision has been recorded on whether/when that access narrows once
  initial buildout is done.
- **Recommended action:** founder decides — e.g., rotate the Supabase
  access token/API key used by this tooling once the current remediation
  program is complete, or keep it but require explicit per-session scope
  review. This is a credential/access-governance decision, not something
  a session can resolve about its own access.
- **Severity:** P2 (no incident occurred; this is a standing-risk note).
- **Status:** Not started. Requires founder decision.

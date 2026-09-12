# Marketplace Scale-Readiness Audit — 5,000 Users

Audit only. No code, schema, or production data was changed while producing
this report. Every claim below is either a direct reading of the current
repository/migrations, a direct query against the live database
(`famdxoardiibonghxepl`), Supabase's own advisor output, or is explicitly
labeled as an assumption/unknown. Nothing here was inferred from prior
session summaries without re-checking the actual current code.

---

## 1. Executive summary

**Verdict: Not ready for scale, with the gap being infrastructure and
process (caching, background jobs, rate limiting, monitoring, load
testing), not the core transactional data model, which is unusually solid
for a project this size.**

This is not a "the code is bad" verdict. The `service_transactions` state
machine, the concurrency-critical guards (double-booking, duplicate
quotes, duplicate conversations, payment funding), and RLS coverage are
genuinely well-built and independently verified throughout this project's
history — see §5. What's missing is everything *around* that core: there
is no caching layer at all (every route is fully dynamic per request), no
background job runner (a documented auto-release function exists in the
database and is never invoked by anything), no application-level rate
limiting, no error/performance monitoring, no automated test suite, and
the live database currently holds single-digit-to-low-double-digit rows
in every table that matters (§8) — meaning **nothing about this system's
behavior under real load has ever been observed**, only reasoned about
from the code.

5,000 *registered* users is very plausibly fine as stated — Supabase
Auth and Postgres handle far more than that trivially. 5,000
*concurrently active* users, or a *sudden spike* to that level, is not
something this build has any evidence of surviving, and several concrete
mechanisms (§4, §12) would degrade or fail before reaching it.

---

## 2. Architecture summary

Confirmed by reading `package.json`, `next.config.ts`, `src/proxy.ts`,
the `supabase/migrations/` directory, `.env.example`/`.env.local`, and
the live Supabase project directly.

| Layer | What's actually there |
|---|---|
| Frontend framework | Next.js **16.3.4**, App Router, React **19.2.8** |
| Rendering strategy | **100% dynamic server rendering.** `npm run build`'s route table marks every single route `ƒ` (server-rendered on demand) — none are static or ISR. No `export const revalidate`, no `unstable_cache` anywhere in `src/` (confirmed by grep). Every page load re-runs its Supabase queries. |
| Hosting/deployment | Vercel, per `DEPLOYMENT.md` — production domain `flerwa-xsbu.vercel.app`. No `vercel.json` in the repo → whatever Vercel's account defaults are (function memory/duration/concurrency unconfirmed — see §9). |
| Database | Supabase-managed Postgres, project `famdxoardiibonghxepl`. Accessed via PostgREST (`@supabase/supabase-js` `2.116.0`, `@supabase/ssr` `0.12.7`) from Server Components/Actions, plus direct `SECURITY DEFINER` RPC calls. RLS enabled and default-deny on every table. |
| Auth provider | Supabase Auth. Two paths: phone OTP (**no SMS vendor configured** — confirmed again this session; `signInWithOtp` fails for any real user) and email/password (working). |
| Storage | Supabase Storage — `avatars` (public), `provider-documents` (private), `provider-portfolio` (public), `transaction-evidence` (private). |
| Realtime | Supabase Realtime, `postgres_changes` on the `messages` table only — one channel per open conversation/transaction thread (`src/app/messages/message-thread.tsx`). No other table has a realtime subscription. |
| API/serverless architecture | No separate API layer — Next.js Server Actions (`"use server"` functions in ~20 `actions.ts` files) are the primary write path, each becoming its own serverless function invocation on Vercel. Two real Route Handlers exist: `src/app/api/webhooks/payments/route.ts` and `.../verification/route.ts` (both built this session). |
| Background jobs / cron / queue | **None.** No queue package in `package.json` (no BullMQ, no Inngest, no Trigger.dev), no `supabase/functions/` directory (no Supabase Edge Functions), no `vercel.json` cron config. `pg_cron` is confirmed **not installed** on the database (`select extname from pg_extension` returns no `pg_cron` row; `cron.job` does not exist). A real consequence: `rpc_run_auto_approve_sweep` — the function that's supposed to auto-release payment after 5 days of customer silence (`docs/06-trust-architecture.md`) — exists in the database but **nothing ever calls it**. See §4 Critical Finding #1. |
| Email/SMS/WhatsApp | No provider configured for any of them. No `resend`, `sendgrid`, `twilio`, or similar package in `package.json`. Notifications are in-app only (`notifications` table). |
| Payments | Manual (admin-confirmed M-Pesa Till/Paybill) by default; a generic, registry-driven aggregator seam was built this session (`src/lib/payments/`) with an IntaSend adapter — **not activated** (`payment_providers.is_active` for `manual` is still `true`; `intasend` is present but inactive, no `INTASEND_SECRET_KEY` configured). Webhook signature verification for IntaSend is a deliberate fail-closed stub, not implemented. |
| Identity verification | Manual (admin reviews uploaded documents) by default; a Kora adapter was built this session, same inactive/stub-signature state as payments. |
| Search/filtering | Plain PostgREST `ilike`/`eq` filters via Supabase-js (`src/app/page.tsx` for the home/search page) — no search index (no Postgres full-text `tsvector`, no Algolia/Typesense/Meilisearch). Fine at the current catalog size (15 services); would need attention only if the catalog itself grows to hundreds/thousands of rows, which is a separate, non-user-count scaling axis. |
| Caching | **None**, anywhere in the stack — no Redis, no `unstable_cache`, no CDN-cacheable static generation, no HTTP cache headers set by the app. Every request is a live round trip to Postgres. |
| Rate limiting / abuse protection | **None** in application code (no `@upstash/ratelimit` or equivalent in `package.json`, no rate-limit logic found by grep). The only rate limiting encountered this session was Supabase Auth's own built-in signup rate limit, which is Supabase's, not this app's. No protection exists against a scripted flood of bookings, quotes, messages, or task posts. |
| Logging/monitoring/alerting | **None.** No Sentry, Datadog, LogRocket, or similar in `package.json`. No custom structured logging beyond `console.error` in a couple of new webhook/payment code paths written this session. No dashboards, no alerting, no uptime monitoring found in the repo. |
| Environment config | `.env.example` documents `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, and the (currently-unused) `INTASEND_*`/`KORA_SECRET_KEY` vars. `.env.local` exists with 3 lines (confirmed present, contents not reproduced here). |
| Domains/branches | Single production domain (`flerwa-xsbu.vercel.app`), single Supabase project. No staging environment, no branch-based preview database strategy confirmed. |
| External quota/cost surfaces | Supabase (DB + Auth + Storage + Realtime, plan tier unconfirmed — §9), Vercel (function execution, plan tier unconfirmed — §9), and, once activated, IntaSend/Kora (currently inactive, so zero quota exposure today). |

### Architecture uncertainty / what prevents a fuller assessment

- **Supabase project plan/tier is not confirmed.** This determines the real connection-pool size, compute allocation, and Realtime concurrent-connection cap. Requires Supabase dashboard access (Project Settings → Billing/Infrastructure) — not obtainable from this session's tool access.
- **Vercel project plan/tier is not confirmed** — determines serverless function concurrency, execution duration limit, and whether Vercel's default DoS/rate-limit heuristics apply. `mcp__Vercel__get_project`-class access was not exercised this pass; per `LAUNCH_READINESS.md` this has been a repeated, reproduced gap in prior sessions too (`list_projects`/`get_project` 404 on this project).
- **No staging environment exists**, so nothing in this report could be verified against a safe, isolated load-bearing copy of the system — every live check this session was necessarily read-only against production or used disposable, clearly-labeled fixture rows immediately reverted (see §8, §10).

---

## 3. Capacity interpretation

None of the figures below come from a load test — no load test was run (§10). They are read off the actual architecture and are labeled by confidence.

| Dimension | Assessment | Basis |
|---|---|---|
| **Registered users** (5,000 total accounts, mostly idle) | **Likely fine, low risk.** | Postgres/Supabase Auth handle millions of user rows trivially; nothing in the schema scales with total registered-user count except storage, which is negligible at this size. |
| **Daily active users** (5,000 spread across a day) | **Plausible, but unverified — the caching gap matters here.** | With no caching, "daily active" traffic is still N live DB round-trips per page view, all day, every day. At low request rates (a handful of requests/second averaged) this is very likely fine on Supabase's smallest paid compute tier; the risk is entirely in whether daily traffic clusters into bursts (evenings, lunch hours) rather than spreading evenly — bursty load behaves like the concurrent-user case below, not the average. |
| **Concurrent active users — 100–500** | **Probably fine as-is.** | Current query patterns are mostly indexed single-row/small-set lookups (§5). This range is unlikely to expose the RLS-initplan or multiple-permissive-policy overhead (§5) meaningfully, or exhaust a typical Supabase connection pool. **Not verified by a test — estimate from code shape only.** |
| **Concurrent active users — 1,000** | **Uncertain — first point real attention is warranted.** | This is roughly where: (a) the zero-caching architecture starts mattering (every nav is a fresh DB round trip, no CDN edge caching anywhere), (b) the unbounded messages queries (§5, §7) start returning meaningfully larger payloads if real conversations have accumulated history, and (c) Supabase's direct-connection pool (vs. a pooler) could start queuing under Server-Action-heavy write bursts, depending on plan tier (§9, unconfirmed). |
| **Concurrent active users — 2,500–5,000** | **Not credible without fixes.** | At this level the missing pieces compound: no rate limiting means a single misbehaving client or retry storm can consume a disproportionate share of capacity; no caching means read load scales linearly with users with zero mitigation; no background job runner means the auto-approve sweep (§2, §4) has never run even once in this system's life, so a large `evidence_submitted` backlog would be entirely unprocessed; RLS policy overhead (§5) compounds per-row on the tables most central to this load (`messages`, `service_transactions`, `providers`). |
| **A sudden spike to thousands of users** (e.g. a promotion or press mention) | **High risk of a bad first impression, low risk of data corruption.** | The concurrency-safety guards that actually protect money and bookings (exclusion constraints, unique constraints, `for update` locks — §5) are structurally sound and will hold under a spike; what's likely to visibly fail first is *responsiveness* (every page is a live DB hit with no caching or rate limiting to shed load) and *support load* (no monitoring/alerting means degradation would be discovered by users complaining, not by an alert). |
| **High-contention scenarios** (many users on the same provider/task/booking) | **Structurally handled correctly, but never tested under real concurrency.** | See §5's concurrency table — the specific guards exist and were verified via role-simulated single-transaction tests throughout this project's history, which proves *correctness* of the locking logic but not *throughput* under genuine simultaneous load (a real k6/Artillery run hitting the same row from many workers has never been executed — §10). |

**Bottom line for the capacity question specifically asked:** the honest range this build can defend today, on its current (unconfirmed-tier) infrastructure, with zero caching and zero rate limiting, is **on the order of a few hundred genuinely concurrent users before something (most likely response latency, not correctness) visibly degrades.** Getting to a defensible 1,000 requires the P1 items in §11; getting to a defensible 5,000 requires the P1 and P2 items and, critically, an actual load test — no report can respectably state a number for 2,500–5,000 concurrent users without one.

---

## 4. Critical failure risks

Ranked by the combination of severity, likelihood, and how directly each maps to money or trust — this product's own stated purpose.

### Critical

**#1 — The payment auto-release safety net has never run, ever, in this system's life.**
`rpc_run_auto_approve_sweep` exists (referenced in `_release_transaction`'s sibling logic and `docs/06-trust-architecture.md`'s "customer silent 5 days → auto-release" rule) but no cron, no Supabase Edge Function, no Vercel cron, and no `pg_cron` job invokes it — confirmed directly: `pg_cron` is not installed on the database at all. **This means every transaction that reaches `evidence_submitted` and whose customer never explicitly approves will sit there forever unless an admin manually intervenes.** At low volume with an attentive admin this is invisible; at 5,000 users' worth of transaction volume, this becomes a real, compounding backlog of un-releasable provider payments — a direct, provider-facing trust failure in a product whose entire thesis is payment reliability.
*Trigger:* any volume of real transactions, immediately — this isn't a scale-triggered failure, it's already true today at n=6 transactions.
*Fix:* wire a real scheduler (Vercel Cron hitting a protected Route Handler that calls the RPC via the service-role client, or `pg_cron` calling the RPC directly if the extension is enabled) to run at least daily.
*Required before launch:* **Yes — P0.**

**#2 — Zero caching means every user, every request, is a live database round trip, with no rate limiting to protect the database from itself.**
Confirmed: no `unstable_cache`, no ISR, no CDN caching, no rate-limit library anywhere in the codebase. A traffic spike (promotion, press, or simply 5,000 concurrent users browsing) has no mitigation layer between the user and Postgres at all — every home-page load, every search, every provider profile view re-runs its full query set. Combined with unconfirmed connection-pool limits (§9), this is the single largest unknown standing between "works today at near-zero load" and "works at meaningful load."
*Trigger:* any sustained concurrent load above roughly a few hundred, or any spike.
*Fix:* cache genuinely static/slow-changing reads (categories, services, published-provider listings) with a short revalidation window; add basic per-IP/per-user rate limiting on write-heavy actions (booking, quote submission, messaging, task posting) at minimum.
*Required before launch:* **P1 — not a day-one blocker at low volume, but required before advertising availability broadly.**

### High

**#3 — Unbounded message-history queries.**
Both `src/app/messages/[transactionId]/page.tsx` and `src/app/messages/c/[conversationId]/page.tsx` run `.from("messages").select("*")...order("created_at")` with **no `.limit()`**. The `messages` inbox page (`src/app/messages/page.tsx`) similarly fetches every message across every thread the user has ever participated in, unbounded, to group client-side. These queries are correctly indexed (`messages_transaction_id_created_at_idx`, `messages_conversation_id_created_at_idx` both exist), so they won't be *slow to execute* at today's volume — but the payload size and client-side render cost grow without bound as real conversations accumulate history, with no pagination anywhere in the messaging UI to cap it.
*Trigger:* any individual thread or user inbox that accumulates hundreds+ of messages over the product's real lifetime — a time-and-usage function, not strictly a concurrent-user-count function, but it compounds with more users generating more message volume.
*Fix:* paginate (`.range()` or keyset pagination on `created_at`) both the thread view and the inbox grouping query.
*Required before launch:* **P2** — not urgent at today's near-zero message volume, genuinely important before the product has real usage history.

**#4 — RLS policy overhead on the busiest tables, confirmed by Supabase's own advisor, not guessed.**
Running Supabase's performance advisor against the live project right now returns:
- **33** `auth_rls_initplan` findings — RLS policies that re-evaluate `auth.uid()`/`current_setting()` per row instead of once per query (the fix is wrapping the call as `(select auth.uid())`, which lets Postgres treat it as a stable sub-plan rather than re-executing per row). `messages` (4), `providers` (3), `profiles`/`provider_verifications`/`notifications`/`service_transactions`/`quotes` (2 each) are the most affected.
- **105** `multiple_permissive_policies` findings — tables where more than one permissive RLS policy applies to the same role/action, meaning Postgres must evaluate and OR together every one of them per row. `messages` alone accounts for 15 of these.
- **7** `unindexed_foreign_keys` — `conversations.service_id`, `conversations.transaction_id`, `identity_verification_checks.provider_key`, `payment_provider_events.provider_key`, `payment_providers.connected_by`, `service_requests.transaction_id`, `verification_providers.connected_by`.
At current data volumes (§8) none of this is observable as slowness. At 5,000 concurrent users generating real row counts in `messages` and `service_transactions` specifically, this is exactly the kind of per-row RLS overhead that turns into measurable query latency — it's the textbook Supabase scaling pitfall, and it's real and present here, not hypothetical.
*Fix:* Supabase's own linked remediation docs cover the initplan fix mechanically (wrap auth function calls); the multiple-permissive-policies findings need a case-by-case look at whether policies can be consolidated (some multiplicity is intentional — e.g., a public-read policy plus an owner-write policy — but 15 on one table warrants review); add the 7 missing FK indexes.
*Required before launch:* **P2** — genuine at 5,000 concurrent, not urgent below that.

**#5 — Duplicate webhook delivery is not hard-blocked at the database level.**
`payment_provider_events` has no unique constraint on `(provider_key, external_reference)`. The funding guard inside `rpc_ingest_payment_event` (built this session) does prevent **double-funding** — a second identical webhook for an already-funded transaction correctly fails the `state not in ('requested','quote_accepted')` check and is recorded as unprocessed with a clear reason, not silently re-applied. So the money-safety property holds. What isn't prevented is **duplicate audit rows** for the same real event (a vendor's retried webhook creates a second `payment_provider_events` row) — functionally safe, but noisy, and worth a proper idempotency key before this path is ever activated with a real vendor.
*Trigger:* real webhook traffic, which doesn't exist yet — `payment_providers.is_active` is still `manual` (§2). Not a live risk today.
*Fix:* add `unique(provider_key, external_reference)` (or a dedicated idempotency-key column) before activating a real aggregator.
*Required before launch:* **N/A today** (payments aren't automated yet) — **required before activating IntaSend/Kora.**

### Medium / Low

- `service_requests`'s hot query (`/provider/requests/page.tsx`: `state='open' AND expires_at > now() AND category_id in (...)`) has individual indexes on `category_id`/`customer_id`/`location_id` but no composite/partial index covering the actual filter combination — fine at today's row counts (2 rows), a real consideration once task-request volume grows into the thousands. **Low today, Medium at scale.**
- `providers_verification_status_idx` is a **partial** index (`WHERE is_published`) that, by construction, excludes the exact rows (`is_published = false`, pending/submitted) the admin verification queue (`/admin/verifications`) actually filters for — the index doesn't serve its apparent purpose. Harmless at 5 providers; worth fixing for correctness of intent, not urgency. **Low.**
- 11 unused indexes flagged by the advisor — pure write-amplification cost, no read-path risk. **Low, P3.**

---

## 5. Database findings

### Concurrency-critical guards — verified present and structurally sound

These were checked against the actual current migrations/RPC definitions, not assumed from memory of earlier work in this project:

| Scenario | Mechanism | Verified |
|---|---|---|
| Two customers booking the same provider slot | `provider_booked_slots` has a **`gist` exclusion index on `(provider_id, slot_range)`** (`provider_booked_slots_provider_id_slot_range_excl`) plus a unique index on `transaction_id` — a real Postgres-level concurrency guard, not an application-level check-then-insert race. | Confirmed via live index listing this session. |
| Two providers submitting a quote on the same request | `quotes_request_id_provider_id_key` unique index on `(request_id, provider_id)`; `rpc_accept_quote` additionally re-checks `quotes.state='pending'`/`service_requests.state='open'` **`for update`** before writing, and declines every other pending quote in the same transaction on accept. | Confirmed via live index + this session's reading of `rpc_submit_quote`/`rpc_accept_quote`. |
| Duplicate payment/funding | `_fund_transaction` (shared by manual confirm and the new webhook path) locks the transaction row `for update`, re-checks state is exactly `requested`/`quote_accepted` before writing — a second concurrent call sees the already-transitioned state and is rejected, not double-applied. | Confirmed by reading the function body this session and by live role-simulated tests earlier this session (amount-mismatch and re-fund rejection both verified). |
| Duplicate conversation threads | `conversations_customer_id_provider_id_key` unique index. | Confirmed via live index listing. |
| A provider accepting a booking while another user modifies it | State-machine transitions are all gated through `SECURITY DEFINER` RPCs that re-check current state under lock before writing (the general pattern across `rpc_book_service`, `rpc_provider_check_in`, `rpc_submit_completion`, `rpc_approve_and_release`) — not verified individually for every single RPC in this pass, but the pattern is consistent everywhere it was checked. |
| Repeated/duplicate form submissions (double-click) | No explicit client-side submit-guard found beyond React's `useTransition`-driven `disabled={isPending}` on submit buttons (present in every actions-backed form checked this session) — this prevents a *second click before the first request resolves* but does **not** prevent a genuine network-retry from creating a duplicate row on tables without a uniqueness constraint (e.g., nothing stops two near-simultaneous `rpc_book_service` calls for a *non-scheduled* service, since the double-booking exclusion constraint only applies where `scheduled_for`/slot data exists — a `request`-mode service booking has no equivalent uniqueness guard against a genuine double-submit). **Medium finding**, not previously documented: a `request`-mode service (the majority of the catalog — see §2's service table) has no server-side idempotency key protecting against a duplicate `rpc_book_service` call from, e.g., a slow network retry. |

### Queries and indexing — confirmed via live `pg_indexes`/advisor output, not assumption

- Every table's primary key and every foreign-key-shaped filter used by this session's read of the actual page/action code **has** a supporting index, with the 7 exceptions listed in §4 #4 (all on tables added or extended this session, i.e., a real regression introduced during this session's own work, not a pre-existing gap).
- No N+1 query pattern was found in the page/action files read this pass — the established pattern throughout this codebase is a single `select` with PostgREST embedding (`.select("*, providers(...), services(...)")`) rather than per-row follow-up queries. This is a genuine strength; it was not re-verified against every one of the ~40 route files, only the ones read this session (home/search, service detail, booking, messages, provider requests, admin queues, storefront).
- **No full-table scans identified** in the queries read this session — every filtered query has a matching index, aside from the composite-index gap noted for `service_requests` above.
- **Missing `.limit()`** confirmed on the two message-thread queries and the messages-inbox query (§4 #3) — the only unbounded-query pattern found this pass.
- RLS policy cost (initplan re-evaluation, multiple permissive policies) is real and advisor-confirmed (§4 #4), not something this pass had to infer from reading policy SQL by eye.

### Transactions, constraints, cascade behavior

- Money-moving operations use explicit ledger entries with `check`-style invariants documented in `docs/07-payments.md` (`Σ escrow_held + Σ materials_held + Σ provider_payable == aggregator settlement balance`) — this pass did not re-derive that invariant from a fresh audit of every ledger-writing function, only confirmed the pattern is consistently applied in `_fund_transaction`/`_release_transaction`.
- `payments`, `ledger_entries`, and `transaction_events` are effectively append-only in practice (confirmed by this project's own repeated experience needing to work around it during QA-fixture cleanup, documented in `SECURITY.md`) — correct for an audit trail, but means there is no soft-delete/archival strategy yet for what will eventually be a large table; not a 5,000-user-scale concern specifically, a longer-horizon one.
- Cascade behavior: spot-checked this session — `conversations.customer_id` and `conversations.provider_id` both `on delete cascade`; `messages.conversation_id`/`messages.transaction_id` both `on delete cascade`. Not exhaustively re-verified for every foreign key in the schema this pass.

---

## 6. Payments and external integrations

Covers the actual code in `src/lib/payments/`, `src/lib/verification/`, and the two webhook Route Handlers — all built earlier this session, so this is a direct re-read, not a recollection.

| Check | Finding |
|---|---|
| **Current live payment path** | Fully manual: `payments.provider_key = 'manual'`, admin confirms via `/admin/payments` → `rpc_confirm_manual_payment`. No external payment API is called by production traffic today. |
| **Secret handling** | `INTASEND_SECRET_KEY`/`INTASEND_PUBLIC_KEY`/`INTASEND_WEBHOOK_CHALLENGE`/`KORA_SECRET_KEY` are read from `process.env` server-side only, never referenced in any client component — confirmed by the `"server-only"` import guard on `src/lib/supabase/admin.ts` and the fact that the payment/verification adapter files are only imported from Server Actions/Route Handlers. None are currently set (confirmed: `.env.example` lists them, `.env.local` has 3 lines total = the 3 pre-existing Supabase vars only). |
| **Idempotency (funding)** | Real and DB-enforced — see §5's concurrency table. A retried/duplicate "funded" webhook cannot double-fund a transaction. |
| **Idempotency (audit trail)** | Not enforced — see §4 #5. Duplicate webhook delivery creates duplicate `payment_provider_events` rows (harmless to money, adds noise). |
| **Webhook signature validation** | **Deliberately not implemented for either vendor** — both `verifyWebhookSignature` implementations fail closed (`return false`) rather than guess at IntaSend's "challenge" mechanism or Kora's HMAC scheme without a real account to test against. This is documented plainly in the code and in `docs/16-payment-verification-integrations.md` from earlier this session — not a hidden gap. |
| **Replay protection** | Not applicable yet — no real webhook traffic exists (inactive integration). Once activated, the funding-guard's state check (§5) provides replay safety for the *funding* action specifically; there is no broader replay-window/nonce check for the webhook endpoint itself. |
| **Timeouts / retries on outbound calls** | `createIntasendCollection` and `verifyKenyaNationalId` use plain `fetch` with no explicit timeout and no retry logic — a slow or hanging vendor response would hold the Server Action open for as long as the platform's own function-timeout allows (Vercel default is typically 10s on Hobby / up to 60s+ on Pro, unconfirmed for this project — §9). No exponential backoff or retry-on-5xx exists for either integration. |
| **Rate limits / quotas (IntaSend, Kora)** | Not applicable — zero calls have ever been made to either (both integrations are inactive, no account connected). Nothing to measure. |
| **STK Push timing out after the customer actually paid** | Structurally, the design is correct for this failure mode *by construction*: funding only ever happens via the webhook (`rpc_ingest_payment_event`), never via the client-side "initiate payment" call succeeding — so even if `createIntasendCollection`'s HTTP response times out or errors, a real STK push the customer completed would still arrive via its own webhook later and fund correctly. This was a deliberate design choice this session, not an accident, but it has **never been tested against a real IntaSend sandbox**, since none is connected. |
| **A booking marked paid more than once** | Prevented by the state-guard in `_fund_transaction` (§5). |
| **A payment attached to the wrong booking** | The webhook path resolves the target transaction from `api_ref`/`metadata`, which must be set correctly when the *outbound* collection request is created — this half of the integration (attaching the real transaction ID as `api_ref` when calling IntaSend) **was built this session** (`createIntasendCollection` does set `api_ref: transactionId`), so the mechanism is correct, but again, never exercised against a live vendor. |
| **Logging of sensitive information** | No API keys, tokens, or full card/phone numbers found logged in the payment/verification code paths read this session — errors are logged with `console.error` at a summary level (e.g., `"initiatePayment: createIntasendCollection failed", result.error`), not raw request/response bodies. Not exhaustively audited for every log call in the codebase this pass. |
| **Email/SMS/WhatsApp integrations** | None exist to audit — confirmed absent from `package.json` and no provider-specific code found. |

**Overall payments/webhooks verdict:** the *shape* of the integration is safe-by-design (webhook-only funding, server-side secrets, fail-closed unverified signatures) precisely because it was built with these scale/safety questions already in mind — but "safe by design, untested against a real vendor" is not the same claim as "verified safe under load," and this report does not claim the latter.

---

## 7. Realtime and messaging findings

Direct re-read of `src/app/messages/message-thread.tsx` and the two thread-loading pages this session.

| Check | Finding |
|---|---|
| Subscription created per render? | **No** — the `useEffect` creating the channel has a correct `[column, id]` dependency array; it does not recreate the subscription on every render. |
| Subscription cleaned up on unmount? | **Yes** — `supabase.removeChannel(channel)` in the effect's cleanup function. |
| Duplicate event listeners | Not observed — one channel per mounted thread component, correctly scoped by `column`/`id` in the channel name. |
| Incoming-message dedup | Present — `setMessages((prev) => prev.some(m => m.id === incoming.id) ? prev : [...prev, incoming])` guards against a message the client already has (e.g. its own just-sent message) being added twice. |
| Unbounded message history / missing pagination | **Confirmed present** — see §4 #3, §5. This is the one real finding in this area. |
| Cross-user/cross-conversation data exposure | Each realtime filter is scoped to a specific `transaction_id`/`conversation_id` server-side (`filter: \`${column}=eq.${id}\``), and RLS still applies to what a client can actually read even if a filter were somehow bypassed — not independently re-verified via an adversarial realtime test this pass, but the pattern matches the RLS-scoped design used everywhere else in this codebase. |
| Ordering | Messages are appended in event-arrival order (`[...prev, incoming]`) rather than re-sorted by `created_at` — under normal conditions arrival order matches send order, but this **could show messages out of order** if the realtime event for an earlier message arrives after a later one (possible under real network jitter, not something a low-latency local test would surface). **Low-severity finding, not previously documented.** |
| Reconnect behavior | Supabase Realtime's client handles reconnection internally; this codebase adds no custom reconnect/backoff logic and no user-visible "reconnecting…" state — if the socket drops, the thread silently falls back to whatever was last fetched, with no indication to the user that live updates have stopped (documented in the code's own comment as an intentional simplification, not a bug: "Falls back to whatever was fetched server-side... the thread still works, just without live updates"). |
| Realtime provider quotas | Not confirmed — depends on Supabase plan tier (§9). Free-tier Supabase Realtime caps concurrent connections in the low hundreds; a paid tier raises this substantially. **This is a real, concrete ceiling for "thousands of active realtime users" that cannot be assessed without dashboard access.** |
| Notification storms / duplicate notifications | `trg_notify_new_message` (a trigger, not application code) creates one `notifications` row per message — not observed to duplicate; not stress-tested. |

**Is the current design appropriate for hundreds of realtime users?** Likely yes — one channel per open thread, correctly cleaned up, is a standard, reasonable pattern at that scale.

**For thousands?** Uncertain, and gated entirely on the unconfirmed Supabase Realtime connection quota (§9) — the application code itself doesn't introduce an obvious multiplier problem (it's not opening extra channels per message or leaking listeners), so the ceiling, whatever it is, is Supabase's plan limit, not an application bug.

---

## 8. Frontend and mobile performance findings

No performance profiling tool was run this pass (no Lighthouse, no bundle analyzer, no real network trace) — everything below is **code-based risk assessment**, explicitly not measurement, per this task's own instruction not to invent numbers.

| Area | Finding |
|---|---|
| Rendering strategy | 100% SSR per request (§2) — no static generation anywhere, so **every navigation, on every device, on every network condition, waits on a live Supabase round trip** before the server can even start rendering. On a slow Kenyan mobile connection (the product's own stated target market, per `docs/` framing), this is the single biggest, most certain performance risk in the whole stack, and it's structural, not a bug to patch. |
| Bundle size | **Not measured** — the build output captured this session lists routes but not per-route JS size (this Next.js version's default build log doesn't print it in the form captured). A real number would require `next build` with bundle analysis enabled or reading `.next/`'s build manifest directly — not done this pass. |
| Client components / hydration | The codebase makes disciplined use of `"use client"` only where interactivity is genuinely needed (forms, the message thread, wizards) — most read-only pages (home, service detail, provider storefront) are Server Components with small client islands (buttons, forms). This is a reasonable pattern; not independently measured for actual hydration cost. |
| Images | `next/image` is used with `remotePatterns` scoped to the project's own Supabase Storage buckets (§2) — standard Next.js image optimization applies (responsive `srcset`, lazy loading by default). Portfolio/hero images are user-uploaded photos with no confirmed size/dimension cap found in the upload code this pass — worth checking upload-side validation before real photo volume arrives. |
| Pagination/virtualization | Missing on message threads (§4, §7). Not checked for the admin transaction/dispute/deal-desk list pages this pass — worth a follow-up look given they have no `.limit()` confirmed absent or present in this audit. |
| Memory leaks | None found in the one realtime subscription pattern that exists (§7 — correctly cleaned up). Not exhaustively profiled. |
| Duplicate form submissions | `useTransition`'s `isPending` correctly disables submit buttons during an in-flight request in every form checked this session — this prevents a same-tab double-click duplicate, not a genuine network-level retry duplicate (§5). |
| Request cancellation | No `AbortController` usage found in any client-side fetch/action-invocation code — a user navigating away mid-request doesn't explicitly cancel it, though React's own transition/navigation lifecycle limits the practical impact of this for Server Actions specifically. |
| Slowest routes | Not measured. |
| Client-side errors | Not measured (no error-monitoring tool installed — see §2, §12). |

**Honest summary for this section:** the frontend architecture has no glaring anti-patterns (no obvious over-fetching, no memory-leaking subscriptions, disciplined client/server component split) but the complete absence of caching and static generation means **frontend performance at scale is fundamentally gated on backend/database response time**, not on anything client-side — so the fixes that matter most for perceived speed at 5,000 users are the caching and query items in §4–§5, not frontend refactoring.

---

## 9. Infrastructure and quota findings

Every line below is explicitly labeled by source.

| Limit | Status | Basis |
|---|---|---|
| Vercel serverless function concurrency | **Unknown** | Requires Vercel dashboard/account-tier access; `vercel.json` absent means no custom override, so whatever the account's plan default is applies. Not obtainable from this session's tool access — confirmed by attempting it (same reproduced gap documented in `LAUNCH_READINESS.md` from an earlier session). |
| Vercel function duration limit | **Unknown** | Same as above. Official Vercel docs (not project-specific) state Hobby plans cap around 10s and Pro plans allow up to 60s+ (configurable) as of general current documentation — **this is general provider documentation, not confirmed against this specific project's actual plan/settings.** |
| Vercel function memory | **Unknown** | Same as above — dashboard-only. |
| Supabase database connections / pooling | **Unknown** | Determined by Supabase project plan tier (free vs. paid, and compute add-on size) — not visible from the MCP tool access available this session. This is the single most important unconfirmed number for the "1,000–5,000 concurrent" question, since Server Actions on Vercel can each open their own DB connection and a small pool exhausts quickly under concurrent write bursts. |
| Supabase compute tier | **Unknown** | Dashboard-only (Project Settings → Infrastructure). |
| Supabase Realtime concurrent connections | **Unknown**, plan-dependent | Supabase's published general documentation states free-tier Realtime caps concurrent connections in the low hundreds, with materially higher caps on paid tiers — **general provider documentation, not confirmed against this project's actual tier.** |
| Storage bandwidth | **Unknown**, plan-dependent | Dashboard-only. |
| Supabase Auth request limits | **Confirmed present, exact threshold not confirmed** — this session's own signup testing hit a real "email rate limit exceeded" response from Supabase Auth more than once, proving the limit exists and is low enough to hit with a handful of test signups in short succession. The exact numeric threshold is not published in a way this session could confirm as the *current* value; Supabase's general auth-rate-limit documentation describes this as a configurable, plan-dependent setting. |
| Email/SMS sending limits | **Not applicable** — no provider connected (§2). |
| Payment/identity-verification request limits | **Not applicable** — both integrations inactive (§6). |
| Cron/background job limits | **Not applicable** — none exist to have a limit (§2, §4 #1). |
| Logging volume limits | **Unknown** — no logging provider is connected, so there is currently no volume to be limited, and no confirmed ceiling for whatever the eventual choice would be. |
| API rate limits (this app's own) | **None exist** (§2, §4 #2) — this is a fact about the app, not an unconfirmed provider quota. |
| Build/deployment limits | **Unknown**, dashboard-only. |

**What must be checked manually before this report's numeric estimates in §3 can be tightened:** Supabase project plan/compute tier and connection-pool configuration; Vercel project plan and function concurrency/duration limits. Both require dashboard login this session's tooling does not have.

---

## 10. Load-test plan (proposed, not executed)

No load test was run against production or any other environment this pass — there is no staging environment to run one against safely, and running one against production would violate this task's own explicit safety rules (and basic care for the very small number of real early users/rows that do exist — §8's own data shows this is a live, if tiny, production database, not a sandbox).

### Recommended tool

**k6** — fits this stack well: scriptable in JavaScript (matches the team's existing language), has first-class support for scenario-based staged load (ramp/spike/soak), and integrates cleanly with a CI step if one is ever added. Artillery is a reasonable alternative with a lower authoring curve; k6 is preferred here specifically because several scenarios below need custom logic (extracting a session cookie after login, reusing it across a scripted user session) that k6's JS runtime handles more naturally than Artillery's YAML-first flow definitions.

### Scenarios to script

1. **Public browsing** — home, category browse, search with varied queries, service detail, provider storefront. No auth required; this is the highest-volume, lowest-cost-per-request path and the first thing to test since it has zero write risk.
2. **Signup/login** — email/password only (phone OTP is non-functional — §2); must run at low VU count given Supabase Auth's own rate limiting (confirmed this session — see §9) will otherwise dominate the results rather than the app's own behavior.
3. **Customer task creation** (`/tasks/new`) — authenticated write path.
4. **Provider request browsing + quote submission** (`/provider/requests`, `rpc_submit_quote`) — the concurrency scenario from §5 (many quotes on one request) belongs here specifically, scripted as a deliberate high-contention burst against a single fixture request, not spread randomly.
5. **Messaging** — authenticated, paired virtual users exchanging messages on a shared thread; this is also where the realtime-connection-count question (§7, §9) actually gets exercised, not just the HTTP path.
6. **Booking creation** — `rpc_book_service`; must include a deliberate "many VUs book the same scheduled slot" sub-scenario to genuinely exercise the exclusion-constraint guard (§5) under real concurrent load, not just the role-simulated single-transaction tests this project has relied on so far.
7. **Payment initiation** — **only ever against a sandbox/mocked endpoint**, never real IntaSend/Kora (per this task's explicit rule, and because neither is even activated today — §6).
8. **Dashboard refresh / polling behavior** — repeated navigation to `/account/bookings`, `/provider`, `/admin` pages to measure the real cost of the zero-caching architecture (§4 #2) under repeat-visit load.
9. **Admin operations** — lower VU count, but should include the verification-queue and payments-confirmation pages given their currently-unindexed-for-purpose query (§4).

### Load levels

| Stage | Purpose |
|---|---|
| 100 concurrent | Baseline — confirms nothing is broken before scaling the test itself. |
| 500 concurrent | First stage likely to surface anything real, per §3's estimate. |
| 1,000 concurrent | The stage this report explicitly cannot currently vouch for. |
| 2,500 concurrent | Only attempt after 1,000 passes cleanly and P1 fixes (§11) are in place. |
| 5,000 concurrent | Only attempt after 2,500 passes cleanly and P2 fixes are in place. |
| Sudden spike to 5,000 | A separate scenario shape from sustained 5,000 — ramp-up time of seconds, not minutes, specifically to test the caching/rate-limiting gap (§4 #2) under a step function rather than a ramp. |
| Sustained high load (soak) | 30–60+ minutes at a stage the system passed cleanly, to catch slow leaks (connection-pool exhaustion, memory growth) that a short burst test wouldn't reveal. |
| High-contention | Not a VU-count stage at all — a targeted script hammering one provider/task/booking row from many simultaneous workers, independent of overall system load. |

### Safety controls required before running any of this for real

- A genuinely isolated environment — either a Supabase branch/staging project or a full second project, **not the current production project**, given it already holds real (if minimal) user data (§8).
- Payment and identity-verification calls mocked or pointed at vendor sandboxes only — never real IntaSend/Kora, and given neither is even connected today, this is automatically satisfied as long as no one sets real credentials before the test.
- All test-created accounts/rows tagged unambiguously (e.g., a dedicated email domain or a `is_load_test` marker) so they can never be confused with real users, and a documented, tested procedure to wipe them afterward — this project's own established convention this session (temporary QA-fixture rows, explicitly labeled, fully reverted, verified back to zero — see §8 of `SECURITY.md`'s history and this session's own webhook/RPC test cleanup) is a reasonable template to extend.
- Explicit sign-off from whoever owns the Supabase/Vercel billing relationship before running anything at the 2,500–5,000 stage, since sustained load at that level has real infrastructure cost implications even on a paid tier.
- A rollback/reset plan for the database (branch reset, or a pre-test snapshot) agreed before the test starts, not improvised after.

**None of these controls are currently in place**, which is precisely why no load test was executed this pass.

---

## 11. Required fixes before scale

### P0 — must fix before meaningful traffic (independent of user count — these are true today)
1. Wire a real scheduler to `rpc_run_auto_approve_sweep` (§4 #1) — the payment auto-release safety net does not currently exist in practice.
2. Confirm Supabase and Vercel plan tiers and their actual connection/concurrency limits (§9) — every capacity estimate in this report is soft until this is known.

### P1 — fix before 1,000 concurrent users
3. Add basic caching for genuinely static/slow-changing reads (categories, service catalog, published-provider listings) — §4 #2.
4. Add application-level rate limiting on write-heavy actions (booking, quoting, messaging, task posting, signup) — §4 #2.
5. Add the 7 missing foreign-key indexes flagged by Supabase's advisor (§4 #4) — cheap, mechanical, no reason to defer.
6. Add a server-side idempotency guard for `request`-mode service bookings (§5) — currently only scheduled-service bookings have a hard uniqueness guard against a duplicate submit.
7. Add basic error/performance monitoring (§2, §12) — currently zero visibility into production errors or slow queries.

### P2 — fix before 5,000 concurrent users
8. Paginate message threads and the messages inbox query (§4 #3, §7).
9. Address the RLS `auth_rls_initplan` (33) and `multiple_permissive_policies` (105) advisor findings, starting with `messages`, `providers`, `profiles` (§4 #4).
10. Add a composite/partial index for `service_requests`' actual hot-query shape (`state`, `expires_at`, `category_id`) once task-request volume justifies it (§4).
11. Fix `providers_verification_status_idx`'s predicate so it actually covers the admin verification queue's real query (§4).
12. Add an idempotency key / unique constraint on `payment_provider_events` before activating any real payment aggregator (§4 #5, §6).
13. Run the staged load test in §10, in a real isolated environment, before making any public capacity claim beyond what this report already states.

### P3 — optimization or future improvement
14. Drop the 11 unused indexes flagged by the advisor (§4) — write-path cost reduction, not a scale blocker.
15. Fix realtime message ordering to sort by `created_at` rather than trust arrival order (§7).
16. Add request cancellation (`AbortController`) for long-running client-initiated fetches (§8).
17. Add explicit timeout/retry logic to the IntaSend/Kora outbound calls before they carry real traffic (§6).
18. Establish a staging environment — most of the above is far cheaper to validate there than to keep reasoning about from code alone.

---

## 12. Observability requirements

None of the following currently exist (§2). Listed in the order that would catch the failure modes in §4 fastest:

- **Error rate and client-side errors** — nothing today; first priority, since it's also the cheapest to add (a hosted error-tracking SDK).
- **Request latency**, per-route — needed to see the caching gap (§4 #2) actually manifest before users complain about it.
- **Database CPU and active connections** — the single most important metric given the unconfirmed connection-pool ceiling (§9); this is Supabase-dashboard-native and should be the first thing watched once plan tier is confirmed.
- **Slow query log / `pg_stat_statements`** — would have caught the unbounded-message-query pattern (§4 #3) empirically rather than by code reading.
- **Lock waits** — directly relevant given how much of this system's correctness leans on `for update` row locks (§5); worth watching specifically during any high-contention load-test scenario.
- **Function duration** (Vercel) — needed to know how close the outbound payment/verification calls (§6) are running to whatever the actual function timeout turns out to be (§9).
- **Realtime connection count** — the only way to know, in practice, how close the system is to Supabase's Realtime connection ceiling (§7, §9) before it's hit.
- **Payment/webhook state distribution** — once any real aggregator is activated, `payment_provider_events.processed = false` counts (already surfaced on `/admin/integrations`, built this session) should be alerted on, not just displayed.
- **Webhook signature failures** — a spike here post-activation would indicate either an attack or a vendor-side scheme change; currently these are recorded (`processing_error`) but not alerted on.
- **Authentication failures** — including Supabase Auth's own rate-limit rejections (§9), which are currently invisible outside of manually hitting them, as this session did.
- **Queue depth** — not applicable until a background job runner exists (§4 #1, P0).
- **Memory usage** — not measured or monitored anywhere today (§8).
- **Third-party API failure rate** — not applicable until a real payment/verification vendor is connected (§6).

---

## 13. Evidence and limitations

### Files and configuration actually inspected this pass
`package.json`, `next.config.ts`, `src/proxy.ts`, `.env.example`, `.env.local` (line count only, not contents disclosed), `supabase/migrations/` (directory listing, 37 files), `src/app/messages/message-thread.tsx`, `src/app/messages/[transactionId]/page.tsx`, `src/app/messages/c/[conversationId]/page.tsx`, `src/lib/payments/` and `src/lib/verification/` (adapters, registries, provider interfaces — re-read from this session's own earlier work), `src/app/api/webhooks/payments/route.ts`, `src/app/api/webhooks/verification/route.ts`, `src/app/provider/requests/page.tsx` and `actions.ts` (re-read from earlier this session).

### Commands run
`npx tsc --noEmit` and `npm run build` were run repeatedly earlier in this session for unrelated feature work (both passing) but **not re-run specifically for this audit pass** — no code was changed during this audit, so there was nothing new to typecheck or build. Grep searches across `src/` for: realtime/channel usage, caching directives (`revalidate`, `unstable_cache`, `export const dynamic`), rate-limiting libraries, cron/pg_cron references, test/seed/fixture files.

### Database queries run (read-only, live project `famdxoardiibonghxepl`)
Full `pg_indexes` listing for the `public` schema; `pg_proc` volatility/parallel-safety check on `is_admin`/`is_txn_participant`/`log_event`; `pg_extension` check for `pg_cron`/`pg_net` (neither installed) and the resulting confirmation that `cron.job` doesn't exist; row counts across 14 core tables; Supabase's own `get_advisors` (performance and security) run fresh against the current live schema.

### Routes/flows checked
The specific flows named in §4–§7's findings (messaging, provider requests, payments/webhooks, realtime). **Not** individually re-traced this pass: the full customer booking flow end-to-end, the full provider onboarding wizard, the admin dispute/deal-desk flows, or the public browsing/search pages — these were extensively built and verified earlier in this project's history (documented across `SECURITY.md`, `PRE_DEPLOYMENT_QA.md`, `LAUNCH_READINESS.md`, `MARKETPLACE_UX_AUDIT.md`) and this pass did not re-derive that work from scratch; where this report relies on that prior verification rather than a fresh re-check this pass, it says so explicitly (§5's concurrency table, in particular).

### Dashboards unavailable this session
Supabase project billing/infrastructure settings (plan tier, compute size, connection pool configuration, Realtime connection cap). Vercel project settings (plan tier, function concurrency/duration/memory limits) — `mcp__Vercel__get_project`-class tools were not exercised this pass; prior sessions recorded this same access gap as reproduced, not assumed.

### Provider limits not confirmed
Exact Supabase Auth rate-limit thresholds (existence confirmed live; exact numbers not). Exact Vercel function duration/concurrency limits for this project's actual plan. IntaSend/Kora rate limits — not applicable, zero real traffic has ever been sent to either.

### Tests not executed, and why
No load test at any stage (100 through 5,000 concurrent, or the spike/soak/high-contention scenarios in §10) — no safe, isolated environment exists to run one against, and running one against the current production project would risk the small number of real rows it already holds and would violate this task's own explicit safety rules. No automated test suite exists in this repository to run (`package.json` has no test runner dependency — confirmed, not assumed) — this is a pre-existing, previously-documented gap (`SECURITY.md`, multiple prior sessions), not something newly discovered or something this pass attempted to add, per the instruction to inspect and report rather than implement unless asked.

### Assumptions made explicit
That Vercel's general published function-duration figures (10s Hobby / up to 60s+ Pro, as of general current documentation) are representative absent project-specific confirmation — flagged inline in §9 as general provider documentation, not project-confirmed. That Supabase's general published Realtime connection-cap ranges are representative absent project-specific confirmation — same flag, §7/§9.

### Unknowns carried forward, unresolved by this pass
Real Supabase/Vercel plan tiers and their concrete limits (§9) — the single biggest open question this report could not close, and the one every numeric estimate in §3 is most sensitive to.


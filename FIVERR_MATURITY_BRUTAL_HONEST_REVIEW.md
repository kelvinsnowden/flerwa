# Trusted Service — Brutally Honest Product Maturity Review

**Method:** Live testing against `https://flerwa-xsbu.vercel.app` as an
anonymous visitor, a real customer (fresh signup, real booking through to
"payment"), and via the site's own attempted admin gate — plus direct
inspection of production data (Supabase) and two existing internal
self-audits this codebase already produced
(`MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md`,
`MARKETPLACE_REMEDIATION_REGISTER.md`), which are unusually candid and are
cited directly rather than re-derived. Every claim below is either
something I clicked/typed/saw myself, a row in production data, or a
quoted line from those documents — not a guess.

---

## EXECUTIVE VERDICT

**Trusted Service is a Stage 2 (Functional MVP), not close to Fiverr-like
quality yet, and further away than the code's sophistication suggests.**
The engineering underneath — ledger double-entry, webhook signature
verification, RLS on every table, a real Bayesian-shrinkage provider
ranking algorithm, an audited admin action log — is genuinely more
rigorous than most MVPs. But none of that is what a customer experiences.
What a customer experiences today is: a homepage that looks clean, a
"buy" button that doesn't buy anything (checkout ends in "our team will
contact you to arrange payment" — no card, no STK push, no instant
anything), a marketplace with exactly one real, live-eligible provider
account, and that one account is publicly, visibly named **"QA Audit
Provider"** with a bio that reads *"Audit test bio for the production
parity audit. 5 years, audit testing."* — live, on the internet, right
now. A mature marketplace is judged on the experience, not the ledger
schema. On experience, this is early-MVP, not "close to Fiverr."

---

## WHAT WE HAVE DONE WELL

- **The transaction/money data model is real engineering, not a demo.**
  Double-entry ledger with a daily reconciliation job and imbalance
  alerting, idempotent webhook ingestion with a dedupe index, signature
  verification per payment adapter, an append-only audit log
  (`admin_actions`) that a direct grep confirmed has no client-writable
  INSERT policy anywhere.
- **RLS and role-escalation guards hold up under direct attack, not just
  code review.** I tried to promote a test account to admin with a raw
  SQL `UPDATE profiles SET role='admin'` using full database credentials
  — a Postgres trigger (`trg_profiles_guard_role`) rejected it outright,
  same for provider/customer suspension. That's real defense-in-depth,
  verified live, not assumed from reading the function.
- **The provider ranking algorithm is legitimately sophisticated** for
  this stage: Bayesian-shrunk reliability score, deterministic
  tie-breaking, and a reserved "exploration slot" so a new but qualified
  provider gets rotating visibility instead of being buried forever by
  cold-start zero history. Most MVP marketplaces don't have this at all.
- **The homepage and bottom-nav mobile shell look genuinely competent** —
  clean typography, real card imagery, sensible two-column layout, a
  proper tab bar. This is not amateur mobile work; screenshotted and
  visually inspected, not just measured for overflow.
- **Booking → messaging is properly linked**, not bolted on: the message
  thread created by a real booking carries the service name and a "View
  booking" link back to the order, which is exactly the kind of context a
  mature marketplace's messaging needs and many MVPs skip.
- **The admin capability matrix and remediation register are themselves
  a sign of maturity in process**, even where the underlying capability is
  missing — this team already knows, in writing, exactly what's not built
  and why, rather than being surprised by it now.

---

## WHERE WE ARE CLEARLY BEHIND

### 1. There is no self-service checkout. At all.
I created a real account, booked a real service against the one real
provider, and completed it end to end. The result: *"Booking confirmed!
We'll be in touch on 0712345678 to arrange payment."* The order detail
page shows **"Payment Pending — our team will contact you to arrange
payment."** No card form. No M-Pesa STK prompt. No instant anything. The
"payment held in escrow" trust promise shown everywhere in the copy is,
today, a phone call. This is the single biggest gap between this product
and any mature marketplace — Fiverr, Upwork, Jumia, all of them — because
instant, self-service payment *is* the marketplace transaction, not a
feature of it.

### 2. The one real storefront on the platform undermines trust by existing.
Production has 8 provider rows. All 8 are QA/test fixtures created during
this project's own testing — three are literally named *"QA fixture
(unpublished, do not use)."* Only one is actually published + verified +
cleared for a category: **"QA Audit Provider,"** cleared only for
Business & Creator Services. Visit its storefront today and you see:
headline **"Audit Test Headline,"** bio **"Audit test bio for the
production parity audit. 5 years, audit testing,"** no cover photo (a bare
camera-icon placeholder), an avatar that's just the letters "QA" in a
circle, "New professional," and a price-display rendering glitch on
mobile (`Ksh 3, 3 3 3`). This is worse than an empty marketplace — an
empty marketplace reads as "early," this reads as "broken."

### 3. Discovery collapses the moment you leave the one populated category.
5 of 6 categories return zero or near-zero real results. "Personal"
returns 3 seeded catalog services with **no eligible provider on any of
them**, so the booking form silently drops the "choose a professional"
section and becomes a bare request form. A customer in any category but
one is functionally posting a task into the void, with no signal that
that's what's happening.

### 4. Zero reviews, anywhere, for anyone.
Not "reviews are weak" — there are no reviews in the system at all. The
review UI, the reliability-score display, the "what previous customers
say" trust signal Fiverr is built around — none of it has real content to
show yet, because zero jobs have ever completed on this platform.

### 5. There is no SEO or public-discovery infrastructure.
Confirmed by direct inspection: no `sitemap.ts`, no `robots.ts`, no
`generateMetadata`/Open Graph anywhere in the App Router tree. A provider
storefront shared on WhatsApp or Twitter today renders as a bare link with
no preview image, no title, no description. This isn't a missing
nice-to-have — it's the entire "become discoverable outside paid ads"
growth channel being unbuilt.

### 6. Admin is a single flat role with no dual control on money-moving actions.
Quoting the project's own capability matrix directly: *"There are no
admin sub-roles today — every function below that says 'Admin' therefore
means any admin, full stop, which is itself the single biggest gap."*
Refunds outside a dispute don't exist as a path. Partial refunds don't
exist. There is no risk/fraud schema of any kind — not a stub, not a flag
column, nothing (`RISK-J1`: *"no risk_flags/fraud-signal table exists
anywhere in the schema."*) No platform-wide "pause new bookings" switch.
No SLA or overdue-action tracking. These aren't oversights the team missed
— they're documented, in the team's own words, as unbuilt.

### 7. Notifications barely function.
SMS has zero vendor connected — the registry is empty by design, so
nothing texts anyone, ever, today. Email has one adapter registered
(Resend) but per the remediation register, no verified sending domain —
meaning even the "we'll email you" promise is currently unreliable.
Account confirmation/password-reset emails run through Supabase's own
default SMTP (not this app's notification system at all), which is fine
for now but is not a production email setup.

### 8. Legal and compliance groundwork is at zero.
Direct from the remediation register: no privacy notice or terms of
service published, ODPC (Kenya's data-protection regulator) registration
status unknown, PSP-status legal opinion not commissioned, no public
liability/professional-indemnity insurance confirmed, tax treatment
unresolved. None of this is a code problem, and none of it should be
guessed at by an engineer — but it means real money and real personal
data (ID documents) cannot responsibly move through this platform yet,
independent of anything technical.

---

## FALSE CONFIDENCE — where code exists but the product doesn't

This is the section that matters most for calibrating how far along you
actually are, because a codebase this large creates a strong illusion of
completeness.

- **"We have payments."** No — you have two well-written, webhook-verified
  payment *adapters* with zero real credentials configured. The live
  payment experience is 100% manual. A developer reading
  `src/lib/payments/` would reasonably conclude payments are built; a
  customer who just tried to pay would tell you they aren't.
- **"We have a verification/trust system."** The mechanics are real
  (document upload, admin approval, category clearance, a portable
  reliability score) but the one live storefront it produces says "Audit
  Test Headline" to the public. Trust infrastructure that produces an
  untrustworthy-looking result isn't done.
- **"We have marketplace discovery/ranking."** The ranking algorithm is
  the most sophisticated single piece of code in the product — and it is
  currently ranking a data set of one. Sophistication with no liquidity to
  operate on is invisible to every real user.
- **"We have an admin console."** 25 nav items, and per the project's own
  matrix, real audited actions across bookings, payments, providers,
  customers, disputes, categories. But there is no way to create the
  *first* admin account without direct database access (confirmed live —
  even a raw SQL role change is rejected without an existing admin
  session), no roles beyond "admin can do everything," and zero fraud/risk
  tooling. An ops team of one person today; not an ops team that scales.
- **"We have notifications."** A clean provider-agnostic architecture
  exists specifically so a vendor can be swapped without touching a route
  or RPC. It currently routes to nothing — SMS has no vendor, email has no
  verified domain. The abstraction is real; the delivery is not.
- **"We fixed mobile."** The homepage genuinely looks good on mobile. The
  one real storefront, on the exact same mobile viewport, shows a broken
  price string (`Ksh 3, 3 3 3`) and an empty gray placeholder where a
  cover photo should be. "No overflow" and "looks finished" are different
  claims, and this session's own prior mobile sweep only ever tested the
  first one.

---

## SCORES (out of 10, evidence-based, not feature-count-based)

| Area | Score | Why |
|---|---|---|
| Customer UX | 4 | Clean homepage and browse flow; collapses hard once you leave the one populated category; checkout doesn't checkout. |
| Provider UX | 5 | Apply wizard, custom services, dashboard status are all genuinely well built; nothing to actually operate a business on yet (no real leads, no payouts). |
| Marketplace discovery | 2 | Real ranking algorithm, but 1 real eligible provider total and no SEO — nothing to discover and no way to be found externally. |
| Trust & safety | 3 | Verification/RLS/audit-log mechanics are solid; zero risk/fraud schema, zero reports mechanism visibility beyond what the register lists, the one live proof-point (the storefront) actively damages trust. |
| Service presentation | 5 | Included/not-included, pricing, turnaround are all clear and well-structured where a service exists; nothing about *providers* on that page inspires confidence yet. |
| Checkout | 2 | No self-service payment step exists in the live product. |
| Order management | 6 | Booking detail, status timeline, messaging link, cancel control — this is the most complete real customer-facing flow in the product. |
| Payments (infra) | 4 | Ledger/webhook/idempotency engineering is strong; zero real money has ever moved through it; no reconciliation-against-aggregator job exists. |
| Notifications | 2 | SMS unconnected, email unverified-domain, in-app-only realistically works today. |
| Admin operations | 5 | Broad, audited, real per the internal matrix; single flat role, no dual control, no fraud tooling, no self-serve first-admin bootstrap. |
| Mobile | 6 | Shell/homepage genuinely well done; content-dependent pages (storefront) expose real polish and formatting bugs. |
| Desktop | 6 | Grid/container work from this session is real and applied consistently; nothing structurally wrong found. |
| Performance | 6 | No live perf problem observed in testing; unverified at any real load (no caching/rate-limit/monitoring maturity check was in scope for this pass, but nothing scary found either). |
| Security | 7 | Genuinely the strongest area — RLS, trigger-level guards (verified by direct bypass attempt), append-only audit log, signed webhooks. Best-scored area for a real reason. |
| Scalability | 3 | Free-tier Supabase, no payout feature, no queue/background-job maturity beyond a few daily crons, single flat admin role — would need real infra work before 10,000 users. |
| **Overall product maturity** | **3** | Strong bones, essentially no live marketplace experience yet. |

---

## MATURITY STAGE: **Stage 2 — Functional MVP**

Core transactions technically execute end-to-end (a real booking was
created, a real transaction row, a real message thread), which is what
separates this from Stage 1 (prototype). But it is not Stage 3
(production-ready MVP) because the core journey isn't reliable enough for
a real stranger to trust with money today — there's no self-service
payment, the one real storefront reads as fake, and discovery has nothing
to discover. Stage 3 requires: a real connected payment aggregator, real
providers (not QA fixtures) in more than one category, and the storefront
someone actually lands on not reading as a test fixture. None of that is
architecture work — it's connecting already-built adapters to real
credentials and onboarding real people, which is exactly why this is
closer than the raw score makes it feel, but it is not done.

---

## HOW FAR FROM FIVERR-LIKE QUALITY?

**Already comparable:** the transactional data model (escrow, ledger,
dispute resolution, evidence capture), RLS/security posture, the booking
detail/status experience, and the mobile app shell.

**Approaching maturity:** provider ranking (algorithm is there, data
isn't), admin operations breadth (functions exist, governance doesn't),
service presentation copy (included/excluded/pricing is genuinely clear).

**Clearly behind:** checkout (doesn't exist as self-service), reviews
(zero), notifications (effectively non-functional), discovery outside one
category, storefront trust presentation (photos, real bios, real
reputation).

**Fundamentally missing:** SEO/public discoverability, any fraud/risk
signal, admin role granularity, a payout mechanism for providers, legal
groundwork (ToS/privacy/regulatory).

**Merely polish:** the mobile price-formatting glitch, the dead "Nairobi"
location pill, the generic 404 page, empty-state copy tone.

**Requires architectural work:** payout feature (schema doesn't exist),
admin role/permission model, risk-signal pipeline, SLA/overdue tracking,
generic emergency-controls table.

**Requires product/business decisions, not engineering:** refund policy
and thresholds, dual-control thresholds, data retention periods, which
notification vendor to commit to, whether/how to launch category-by-
category.

**Should NOT be built yet:** anything in Phase D of the admin matrix
(cohort retention, unit-economics dashboards, financial exports) — there
is no real transaction volume for these to be meaningful; a granular
roles/permissions system before there's more than one real admin; a
"platform-wide pause" emergency control before there's a founder-approved
policy for when it's used.

---

## CRITICAL GAP ANALYSIS

### MUST FIX BEFORE REAL USERS
1. Connect a real payment aggregator (IntaSend or Pesapal) with real
   credentials, and make the actual checkout step self-service — no
   "we'll call you," a real STK push or hosted checkout.
2. Remove or clearly relabel the QA/test provider fixtures — at minimum,
   flip `is_test_fixture = true` on them so they stop being the public
   face of the marketplace to real visitors.
3. Onboard at least a handful of real providers across more than one
   category before inviting real customers — right now 5 of 6 categories
   are functionally empty.
4. Fix the storefront's broken/empty visual states (missing cover photo,
   mobile price-formatting bug) — this is the #1 trust surface for
   spending money and it currently looks unfinished even with real
   content.
5. Get a working notification channel (at least email with a verified
   domain) — a marketplace that can't reliably tell someone their booking
   status isn't operational.
6. Publish a privacy notice and terms of service before collecting ID
   documents and payment information from real people.

### SHOULD FIX BEFORE MARKETPLACE LAUNCH
7. Basic SEO — a sitemap, robots.txt, and Open Graph metadata on public
   storefronts/services so shared links render properly.
8. A documented, tested first-admin bootstrap process (today it requires
   ad hoc database access).
9. At least a minimal refund path independent of opening a formal
   dispute.
10. Make the homepage location control (currently a dead "Nairobi" pill)
    either real or remove it.

### IMPORTANT AFTER LAUNCH
11. Admin roles beyond a single flat "admin" — at minimum separating
    finance-sensitive actions from general operations.
12. A risk/fraud signal pipeline — currently zero schema exists for this.
13. SMS notifications, once volume justifies the vendor cost.
14. A real payout mechanism for providers (schema not even applied yet).
15. Dual-control / approval thresholds on refunds and manual payment
    confirmation.

### POLISH
16. Branded 404/error pages.
17. Empty-state copy pass across notifications/bookings/messages.
18. Mobile-tap-target and scroll-then-tap audit on the location combobox
    (reported but not reproduced live in this pass — worth a dedicated,
    device-based check).

### DO NOT BUILD YET
19. Cohort retention / unit-economics dashboards — no real volume to
    measure.
20. Granular multi-role admin permission matrix — premature with one
    real admin.
21. A platform-wide emergency "pause all bookings" switch — needs a
    founder-approved policy first, not a UI.
22. Geographic/corridor-level controls — premature before there's real
    geographic coverage to control.

---

## TOP 10 GAPS (ranked by impact on readiness, not coding effort)

1. No self-service checkout — the core transaction doesn't actually
   transact.
2. The only real storefront is visibly test data.
3. Discovery works in exactly one category.
4. Zero reviews / zero completed jobs — no real reputation exists yet.
5. Notifications don't reliably reach anyone.
6. No legal/compliance groundwork for handling money and ID documents.
7. Admin has no dual control on money-moving actions.
8. Zero fraud/risk detection of any kind.
9. No SEO — the product is invisible to anyone not directly sent a link.
10. No payout mechanism for providers to ever get paid out.

---

## DEBT BY CATEGORY

**Technical debt:** the payment/verification adapters are written against
docs, not tested against live vendor accounts — several files explicitly
say "not independently verified against a live account." That's a
reasonable MVP shortcut today; it becomes expensive if real credentials
go live and an endpoint assumption turns out wrong during real customer
payments.

**Product debt:** the entire experience assumes a populated marketplace
(ranking, filters, category browse) while actually operating with
single-digit real supply. The product wasn't designed with an honest
"zero-to-one liquidity" onboarding path — no waitlist, no "we don't have
anyone here yet, but here's what happens next" honesty layer.

**Trust debt:** the storefront is the single highest-leverage trust
surface in a services marketplace, and today it's the weakest link — a
customer's very first "should I pay this stranger" decision is currently
being made by looking at test data.

**Operational debt:** one flat admin role, no bootstrap process for
additional admins, no fraud tooling — an ops team of more than one person
cannot cleanly operate this today.

**Scale debt:** free-tier Supabase, no queue infrastructure beyond a few
daily cron jobs, no payout system, no reconciliation-against-aggregator
job. None of this breaks at current volume; all of it needs attention
before real growth.

---

## LAUNCH BLOCKERS

Real payment connected · real providers in more than one category ·
QA/test data removed or flagged from production · storefront visual
states fixed · at least one working notification channel · published
privacy notice/terms.

---

## NEXT 30 PRIORITIES

**P0 — Blocking**
1. Connect a real payment aggregator with real credentials.
2. Make checkout self-service (no manual "we'll call you").
3. Flag/remove QA provider fixtures from production.
4. Onboard real providers in at least 3 categories.
5. Fix storefront empty cover-photo state + mobile price-formatting bug.
6. Verify a real sending domain for email notifications.
7. Publish privacy notice + terms of service.
8. Document + test a first-admin bootstrap process.

**P1 — Important**
9. Sitemap + robots.txt + Open Graph metadata.
10. Minimal refund path outside formal disputes.
11. Fix or remove the dead homepage location pill.
12. Admin role separation for finance-sensitive actions.
13. Basic risk/fraud signal schema (even just a flags table).
14. SMS notification channel, once justified by volume.
15. Reconciliation job against the live payment aggregator.
16. A real payout mechanism (schema + admin flow).
17. Dual control on manual payment confirmation and refunds.
18. "Requires attention" unified admin queue (overdue actions, stuck
    evidence, unreconciled payments).
19. Branded error pages (404/500).
20. Empty-state and error-state copy audit across the app.

**P2 — Later**
21. Granular admin role/permission matrix.
22. Cohort retention / unit-economics reporting.
23. Provider payout-detail change hold (24h re-verification).
24. Geographic/corridor-level emergency controls.
25. Platform-wide "pause bookings" switch (needs policy decision first).
26. Verification appeal/re-verification workflow.
27. Document expiry tracking on verification records.
28. Webhook delivery-history admin view.
29. Financial exports / daily reconciliation reports.
30. Multi-provider support for SMS/email (only one vendor each needed at
    launch).

---

## IF WE INVITED 1,000 REAL USERS TOMORROW, WHAT WOULD THEY COMPLAIN ABOUT FIRST?

**"I tried to book something and nobody's actually there."** — outside
one category, there's nothing to buy. Immediately followed by: **"I
booked something and it just says someone will call me — that's it?
Where's the payment?"** Both would happen inside the first five minutes
for the overwhelming majority of the 1,000, before they ever reach a
review, a dispute, or anything deeper in the product.

## WHAT WOULD THEY ACTUALLY LOVE?

The parts that already feel like a real product: the mobile app shell
(clean, fast-feeling, proper tab navigation), the clarity of what's
included/not-included and pricing on a service page once one exists, and
— for the few who got far enough to book — the booking status timeline
and the fact that messaging carries real order context instead of feeling
bolted on. The bones of something good are genuinely there. They're just
not connected to a real marketplace yet.

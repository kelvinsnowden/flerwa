# Marketplace Trust, Safety, Fraud, and Abuse Prevention Plan

Companion to the register's `TSF-*` and `PROV-*` items. This is the domain
with the largest gap between what `docs/06` (already-decided strategy) says
must exist and what is actually implemented — nearly everything below is
**Missing**, not **Implemented-but-unverified**. That is stated plainly
rather than softened, per the founding brief's instruction against vague
conclusions.

## 1. The governing principle, restated

`docs/06`'s correction governs this entire plan and is treated here as
settled, not open for re-litigation: **reliability/integrity is portable
across categories; competence is not.** A provider with a high Reliability
score has never been vetted for whether they can do a *specific* job well.
The engineering consequence: every trust surface in the product must show
components, never a single blended score, and access to a category must
require category-specific clearance regardless of reputation elsewhere
(`provider_categories.is_cleared` already enforces the *access* half of
this correctly — Confirmed, code — but no *scoring* half exists yet).

## 2. What controls are automated, human-reviewed, or escalated

| Control | Automated | Human-reviewed | Escalated |
|---|---|---|---|
| Provider identity verification | ID/liveness match (once Kora is connected — not yet, `PAY`-adjacent gap) | Admin approves final status | — |
| Category clearance | — | Admin (`rpc_set_category_clearance`) | — |
| Evidence in-app-capture enforcement | Should be (TSF-001, not yet built) | — | Flagged evidence → admin |
| Duplicate/reused evidence | Should be (perceptual hash, TSF-003, not yet built) | Admin reviews flags | — |
| Reports/flags on content | — | Admin moderation queue (TSF-007/008, not yet built) | Repeat/severe → founder |
| Dispute resolution | Auto-release only (5-day silence, existing sweep) | Everything else, via admin | Unresolved past deadline → escalate (TXN-004, not yet built) |
| Safety incidents | — | — | Always, immediately, founder-level per `docs/06` (no in-app path yet — TSF-012) |
| Rate-limit abuse (volume) | Yes (5 actions, prior session) | — | — |
| Fraud pattern detection | Not yet (TSF-009) | Would be admin | — |

## 3. Fraud threat model, current control status

Reproducing `docs/06`'s own ranked threat table with current implementation
status added (this is the single most important table in this document —
it is the actual gap analysis the founding brief's §7 asked for):

| # | Threat (from `docs/06`) | Primary control (strategy) | Implementation status |
|---|---|---|---|
| 1 | Disintermediation | Value-based retention (descending repeat fees, Deal Desk) | **Not implemented** — flat fee only (PAY-007) |
| 2 | Agency fraud (bribed inspector) | Structured evidence, dual coverage, outcome follow-up | **Not implemented** (TSF-001, 002, 005, 006) |
| 3 | Fabricated evidence | In-app capture, geotag, hashing, duplicate detection | **Not implemented** (TSF-001, 002, 003) |
| 4 | Fake providers / stolen identity | ID + liveness + M-Pesa name match | **Partially** — ID capture exists in schema (`national_id_number`), liveness/name-match requires Kora connection (not live) |
| 5 | Materials-money theft | Escrowed, receipted materials milestone | **Not implemented** — materials milestone concept doesn't exist in schema (TXN-012 dependency) |
| 6 | Customer refuses to pay for completed work | Escrow + 5-day auto-release | **Implemented and verified** (the auto-approve sweep, fixed and scheduled in the prior session) |
| 7 | Theft from a customer's home | Tier verification, insurance, incident protocol | **Not implemented** (PROV-001 tiers don't exist; TSF-013 protocol not written) |
| 8 | Review manipulation / collusion | Settled-transaction gating, graph analysis | **Partially** — settled-transaction gating is implemented and verified (`SECURITY.md` §6); graph/collusion analysis does not exist |
| 9 | Account takeover / SIM swap | 24h hold on payout-detail change | **Not implemented** — no payout-detail concept exists yet (PAY-010) |
| 10 | Fake customers wasting provider time | Customer verification + funding-before-dispatch | **Partially** — funding-before-dispatch is architecturally true (address is masked pre-funding per `SECURITY.md`'s RLS notes — **not independently re-verified this exact claim this pass**, flagged); customer verification tiers don't exist |

**Reading this table plainly:** of 10 named threats, 1 has a fully
implemented and verified control (#6), 3 have partial coverage, and 6 have
no control at all. This is the headline finding of the entire remediation
program and should be treated as such in any founder-facing summary.

## 4. Reputation integrity — what's real today

**Confirmed, verified (`SECURITY.md` §6):**
- A review can only be inserted by a real transaction participant, about the
  other party, on a `settled`/`reviewed`/`closed` transaction — enforced by
  RLS, not just UI. A gaming attempt fails at the database.
- Reviews are write-once (no update/delete policy).

**Missing entirely, relative to `docs/06`'s Trust Score design:**
- No Bayesian cold-start blending (new providers currently show whatever
  raw average they have, likely nothing, rather than entering at a category
  median with appropriate uncertainty).
- No Wilson lower-bound ranking (three 5-star jobs would currently outrank
  sixty 4.7-star jobs if any ranking exists at all — and per LIQ-002, no
  explicit ranking query was even confirmed this pass).
- No 180-day half-life decay.
- No value-weighting of ratings by job size.
- No customer-side reputation (`docs/06`'s two-sided reputation section) —
  `reviews.reviewee_id` can technically be a customer being reviewed by a
  provider (RLS allows either direction — **Confirmed, code**: the policy
  doesn't restrict which side is reviewer vs reviewee), but no UI surfaces a
  customer's own trust profile anywhere (**Not confirmed** — needs a direct
  UI check).

**Recommended remediation sequence (dependency-ordered):**
1. PROV-001 (tiered verification schema) — everything else in this section
   depends on having a real place to attach scores and tiers.
2. TSF-007/008 (report/flag + moderation queue) — the cheapest, highest
   -leverage trust-and-safety primitive currently missing entirely.
3. TSF-001/002 (in-app capture + geotag enforcement) — the specific control
   named as most likely to end the company if absent, per `docs/14`.
4. The Trust Score computation itself (Bayesian/Wilson/decay/value-weight) —
   deliberately sequenced *after* the above, since a sophisticated score
   computed over garbage/unenforced inputs is worse than no score.

## 5. Safety architecture — customer and provider

Reproducing `docs/06`'s two safety lists with implementation status:

**Customer safety**

| Control | Status |
|---|---|
| Provider identity/photo shown before arrival | Partially — `Avatar` component exists and renders real photos where uploaded (Confirmed, code) |
| Live job status, check-in/check-out with geotag | Check-in exists (`rpc_provider_check_in`); geotag capture **not independently re-verified** whether lat/lng are actually required vs. optional in that RPC |
| In-app emergency button | **Missing** (TSF-012) |
| Address masked until funded/assigned | **Confirmed, code** (per `SECURITY.md`'s existing RLS notes on `service_transactions.address_text` — masking logic not re-read line-by-line this pass, flagged Not confirmed for the exact mechanism) |
| Prominent post-job report channel | **Missing** (TSF-007) |

**Provider safety**

| Control | Status |
|---|---|
| See customer verification/history before accepting | **Missing** — customer-side reputation not surfaced (see §4) |
| Decline any job, no ranking penalty | **Not independently verified** whether `recompute_reliability()` currently penalizes declines (TSF-011, Investigating) |
| Share-my-trip to a trusted contact | **Missing** |
| Missed-check-out escalation | **Missing** — no timeout/escalation job on `checked_in` state |
| Right to leave and be paid in full if unsafe | Financially possible via `rpc_resolve_dispute`'s free-form split (a human process today, not automated) — **Not a product-level guarantee stated anywhere in the UI** |
| No lone female provider without opt-in | **Missing** — no provider safety-preference field exists |

## 6. Prohibited and restricted categories

`docs/06` names an explicit prohibited list (minors unsupervised,
medical/clinical, legal advice, security services, firearms, third-party
money handling, unverified-licence-required work) and a
`[LEGAL — COUNSEL REQUIRED]` restricted list (childcare, elder care,
health-adjacent, domestic-worker placement, property representation,
financial/tax services). **No enforcement mechanism exists in the category
taxonomy** — `categories`/`services` have no `restricted`/`prohibited` flag;
this is currently enforced only by nobody having built a UI path to create
such a listing, not by any explicit guard. Recommended: add a
`categories.risk_tier` or explicit prohibited-keyword review step in the
(not-yet-built) provider-proposed-service workflow referenced in
`MARKETPLACE_UX_AUDIT.md` §12's Option A, so this is enforced structurally
before that workflow is ever built, not after.

## 7. Escalation and emergency handling

See register TSF-012/013/014 and `MARKETPLACE_DISASTER_RECOVERY_PLAN.md`
for the operational-continuity half of incident handling. The trust-and-
safety-specific requirement `docs/06` states plainly: **"treat any safety
incident as a company-level event with founder involvement... a decision
made within hours — not a support ticket."** Nothing in the current product
operationalizes this; it is entirely a written-protocol-and-staffing gap
(TSF-013), not a code gap, and is listed as a Phase 0 blocker in the master
plan precisely because it cannot wait for engineering capacity — it needs a
document and a decision, not a sprint.

## 8. Recommended sequencing (this document's own priority order)

1. TSF-013 (written incident protocol) — zero engineering cost, must exist
   before any real physical-service transaction.
2. TSF-012, TSF-014 (emergency button destination + pause control) —
   depends on #1 deciding who's on the other end.
3. TSF-007/008 (report + moderation queue) — cheapest structural primitive
   with the broadest coverage across every abuse type in §7 of the founding
   brief.
4. PROV-001 (tiered verification) — unlocks TSF-004/005, PROV-002/003.
5. TSF-001/002/003 (evidence integrity) — the specific, named
   company-ending risk; sequenced after #4 because tiering determines which
   jobs require which evidence rigor.

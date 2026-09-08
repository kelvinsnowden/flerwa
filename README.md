# Flerwa — Creator Collaboration Marketplace

A strategy, product and technical blueprint for a creator–brand collaboration marketplace launching in Kenya, built on M-Pesa, and designed to expand across East Africa.

**Research conducted 8 September 2026.** Every claim is tagged **[FACT]** (verified, cited), **[REC]** (recommendation), or **[ASSUMPTION]** (estimate, unverified). Sources in [`docs/sources.md`](docs/sources.md). Nothing here is legal, tax, or financial advice.

---

## Start here

**📄 [`Flerwa-Creator-Marketplace-Blueprint.pdf`](Flerwa-Creator-Marketplace-Blueprint.pdf)** — the complete document, 109 pages, with contents and PDF bookmarks. Regenerate with `python3 build/build_html.py && cd build && node render.js`.

**→ [`docs/00-executive-summary.md`](docs/00-executive-summary.md)** — the verdict, the five decisions that matter, and the one finding that should reshape the plan.

If you read nothing else, read that and the founder brief at the end of [`docs/16-blueprint-and-decisions.md`](docs/16-blueprint-and-decisions.md).

---

## The three things this research changed

1. **[FACT]** Kenya's measured influencer advertising market is **~US$2.1M (2024), forecast ~US$3.0M (2028)**. Capturing *all of it* at a 15% take rate yields ~US$315k/year. **A Kenya-only, influencer-only take-rate business cannot become large.** The plan must target content-production, SME marketing, regional and export budgets instead.

2. **[FACT]** **Zaumu launched in Nairobi in April 2025 with escrow, milestone payments, creator-protective contracts, two-sided reviews and in-platform messaging** — the core of the product as originally described. Differentiation cannot be escrow or contracts. It has to be category (physical/local collaborations), average order value, and operational reliability.

3. **[ASSUMPTION, load-bearing]** **Average order value matters more than take rate.** Doubling AOV from KSh 10,000 to KSh 20,000 more than triples gross profit, because ops and payout costs are per-*order*. Raising the take rate from 15% to 20% adds far less and costs competitive position.

---

## Contents

| Document | Covers |
|---|---|
| [00 — Executive Summary](docs/00-executive-summary.md) | The verdict, five key decisions, the core insight |
| [01 — Global Market](docs/01-global-market-research.md) | Part 1: TikTok TCM, Collabstr, Insense, GRIN, CreatorIQ, Aspire, Upfluence, Modash, Billo/Trend/Cohley + feature matrix |
| [02 — Africa & Kenya](docs/02-africa-kenya-landscape.md) | Part 2: Wowzi, AIfluence, Zaumu and others; the unmet need; what we must do differently |
| [03 — Marketplace Definition](docs/03-marketplace-definition.md) | Parts 3, 16, 20: the ten collaboration types, seeding logistics, the rights system |
| [04 — Economics](docs/04-economics-and-pricing.md) | Parts 4, 33, 34, 48: business model, fee psychology, GMV tables, three-scale simulation |
| [05 — Payments](docs/05-payments-mpesa.md) | Part 5: M-Pesa, escrow architecture, refunds, KYC, tax, reconciliation |
| [06 — Trust](docs/06-trust-reputation-fraud.md) | Parts 6, 13, 26, 35: reputation score, disputes, brand ratings, fraud |
| [07 — Product Spec](docs/07-product-spec.md) | Parts 7–9, 14–15, 17–19, 21, 25, 32, 39–40: profiles, discovery, storefronts, UX, positioning |
| [08 — AI Matching](docs/08-ai-matching.md) | Parts 10–11: matching algorithm, AI campaign builder |
| [09 — Workflow](docs/09-workflow-states.md) | Part 12: the complete state machine and its timers |
| [10 — Architecture](docs/10-technical-architecture.md) | Parts 22, 37, 38: stack, WhatsApp, database design |
| [11 — Metrics](docs/11-analytics-metrics.md) | Parts 23–24, 44–45: dashboards, formulas, North Star |
| [12 — Go-to-Market](docs/12-gtm-liquidity-growth.md) | Parts 27–31: liquidity, launch, growth loops, referrals |
| [13 — Legal](docs/13-legal-compliance.md) | Part 36: CBK, tax, ODPC, disclosure, contracts |
| [14 — MVP & Roadmap](docs/14-roadmap-mvp.md) | Parts 42–43, 49: MVP, V0–V5, ten launch campaign templates |
| [15 — Investors & Risk](docs/15-investor-case-and-risks.md) | Parts 46–47: the investor case, twenty failure modes |
| [16 — Blueprint](docs/16-blueprint-and-decisions.md) | Parts 41, 50: the wedge, full blueprint, build/don't-build lists, founder brief |
| [Sources](docs/sources.md) | All citations, with caveats on source quality |

---

## The core insight

> In a market where the median transaction is KSh 5,000 and the median buyer is an SME, no marketplace survives on the transaction. It survives on the **record** of the transaction.
>
> Whoever accumulates the verified, escrow-settled earnings history of African creators owns the only dataset capable of underwriting them — and underwriting is what makes leaving expensive.

Architect for it now. Do not build it yet.

---

## Build first

1. Escrow with M-Pesa STK collection and B2C payout
2. Creator storefronts with published prices
3. Four campaign types: Location Visit, Paid UGC, Product Seeding, Influencer Post
4. The workflow state machine with all timers — especially **5-day auto-approve**
5. Append-only event log and double-entry ledger
6. The ops/admin console
7. WhatsApp notifications with a shareable M-Pesa payout receipt
8. Two-sided reviews and the Brand Trust Score
9. The Deal Desk (5%, creator-originated)
10. Structured briefs with system-inserted disclosure

## Do not build yet

AI matching · AI campaign builder · affiliate tracking · native apps · milestones · standalone rights marketplace · event coverage · agency accounts · subscriptions · logistics · creator tiers · advanced analytics

---

## The number that decides everything

**Brand repeat rate at 60 days.** Below 25%, this is a services business, not a marketplace — and the right response is to stop building and find out why.

# Trusted Services Marketplace — Kenya

**Strategic blueprint following the pivot from a creator-collaboration marketplace to a trusted services marketplace.**

---

## The application

This repository now contains a working Next.js + Supabase application built
against the strategy below — not a prototype with fake data, a real
booking-to-payment-to-review flow with database-enforced authorization.
Start here:

- **[`BUILD_PLAN.md`](BUILD_PLAN.md)** — the phased build plan and its
  current status (most phases done; see the status table at the bottom for
  exactly what is and isn't finished)
- **[`ARCHITECTURE.md`](ARCHITECTURE.md)** — how the pieces fit together
- **[`DATABASE.md`](DATABASE.md)** — the schema, the migration history, the ledger
- **[`SECURITY.md`](SECURITY.md)** — what was verified, how, and the one
  real bug this build found and fixed along the way

```bash
npm install
cp .env.example .env.local   # fill in SUPABASE_SERVICE_ROLE_KEY if you need admin-side scripts
npm run dev
```

The Supabase project (`famdxoardiibonghxepl`) is already migrated and
seeded with the four-service Remote-Principal launch catalogue from
`docs/09-verticals.md`. No providers exist yet — that is real state, not a
bug: apply as a provider, get verified by an admin account, then book.


Research conducted 8 September 2026. Claims are tagged **[FACT]** (verified, cited), **[REC]** (recommendation), **[ASSUMPTION]** (unverified), **[LEGAL — COUNSEL REQUIRED]**. Sources in [`docs/sources.md`](docs/sources.md). Nothing here is legal, tax or financial advice.

---

## Start here

**📄 [`Trusted-Services-Marketplace-Blueprint.pdf`](Trusted-Services-Marketplace-Blueprint.pdf)** — the complete document with contents and bookmarks.

**→ [`docs/00-executive-thesis.md`](docs/00-executive-thesis.md)** — the verdict, which is not the one the brief asked for.

---

## The short version

**You asked me to challenge the pivot. Here is the challenge.**

**The diagnosis is right. The prescription — launch a horizontal trusted-services marketplace — is the most attempted and most failed model in African consumer tech, and two funded companies already ran this exact experiment in Nairobi.**

- **[FACT] Lynk** (2015–2022) connected households with verified domestic workers, fundis and artisans across dozens of Nairobi categories. It **pivoted operating models repeatedly**, abandoned its auction model for standardisation, had to build its own academy after training partnerships failed, and exited by acquisition.
- **[FACT] SweepSouth** raised **$15M+**, entered Kenya in 2019 and **exited Kenya and Nigeria in November 2022**.
- **[FACT]** The best-run African comparable, **Kandua**, raised $13M and was **acquired by an insurer** — value pooled in the verified-work relationship, not the take rate.
- **[FACT]** The one unambiguous global success, **Urban Company**, is **managed and vertical**, not horizontal and light.

**Three findings that reshape the plan:**

1. **The KSh 5,000 line.** No category with a median transaction below ~KSh 5,000 can support a transaction-fee marketplace that also performs human trust operations. **This eliminates mama fua, cleaning and errands by arithmetic** — most of the launch list in the brief.
2. **The frequency paradox.** High-frequency local services (cleaning) leak almost completely by job three. Low-frequency ones (plumbing) never build habit. Home services has no sweet spot.
3. **Reputation does not transfer across categories.** Integrity and reliability are properties of a person; competence is not. A single blended trust score across a horizontal marketplace produces unsafe hires.

**The recommended wedge — which the brief did not consider:**

> ### Be someone's trusted eyes, hands and judgement in Kenya, when they cannot be there themselves.

**[FACT]** Kenya received **US$5.04B in remittances in 2025**. Housing scams are surging in Nairobi's prime estates, and **diaspora buyers are targeted specifically because distance makes due diligence nearly impossible** — with press guidance concluding that a *"trusted, verifiable representative in Kenya"* is among the most effective protections available. That is a product specification written by a journalist.

It clears the KSh 5,000 line, resists disintermediation structurally (the customer's problem *is* the absence of a trusted relationship), serves a hard-currency buyer already paying for unverifiable outcomes, and has fungible supply — the escape from "every category is a different company."

**Sequence:** Remote-principal services → Business & creator services (the existing blueprint) → High-value fundi work. **Never** cleaning, mama fua or errands.

---

## Contents

| Document | Brief sections |
|---|---|
| [00 — Executive Thesis](docs/00-executive-thesis.md) | 1–5, 53, 69 |
| [01 — What Changed](docs/01-what-changed.md) | 2, 50 |
| [02 — Competitive Landscape](docs/02-competitive-landscape.md) | 41, 42 |
| [03 — Market and Personas](docs/03-market-and-personas.md) | 6, 7, 8 |
| [04 — Transaction Primitive](docs/04-transaction-primitive.md) | 10–14, 23, 38, 51 |
| [05 — Storefronts and UX](docs/05-storefronts-and-ux.md) | 15, 32, 45–47, 52 |
| [06 — Trust Architecture](docs/06-trust-architecture.md) | 5, 16–20, 25, 26, 28, 54 |
| [07 — Payments](docs/07-payments.md) | 21–24 |
| [08 — Liquidity and Growth](docs/08-liquidity-and-growth.md) | 27–35 |
| [09 — The Verticals](docs/09-verticals.md) | 36–40, 60 |
| [10 — Business Model](docs/10-business-model.md) | 9, 30, 43, 44, 57 |
| [11 — Roadmap](docs/11-roadmap.md) | 40, 41, 45–48, 61–63 |
| [12 — Technical Architecture](docs/12-technical-architecture.md) | 36, 37, 48–51, 53 |
| [13 — Metrics](docs/13-metrics.md) | 55, 56 |
| [14 — Risks and Regulatory](docs/14-risks-and-regulatory.md) | 64–66 |
| [15 — Brand and Investor Case](docs/15-brand-and-investor-case.md) | 44, 67–69 |
| [archive-creator-marketplace/](docs/archive-creator-marketplace/) | The original 109-page blueprint — now the Vertical 2 playbook |

---

## Before anything else

**A 30-day, ~KSh 150,000 validation with a written kill criterion** ([`docs/11-roadmap.md`](docs/11-roadmap.md)):

> Will a diaspora Kenyan pay ~KSh 6,000 for a verified stranger to inspect a property and produce an evidenced report before they send a deposit?

**Kill criterion:** fewer than 10 unsolicited payers in week two → the wedge is unvalidated; fall back to Vertical 2, where a complete blueprint and a proven buyer already exist.

**[FACT]** Lynk spent seven years and SweepSouth spent $15M+ learning things a month of real customer money would have surfaced.

---

## The number that decides everything

**Repeat rate at 90 days.** Below 25% at month six, this is a services agency with an app — and the right response is to stop building and find out why.

## Regenerating the PDF

```bash
python3 build/build_html.py && cd build && node render.js
```

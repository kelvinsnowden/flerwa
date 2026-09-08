# Executive Summary — The Verdict Before the Detail

**Status of this document:** strategy and product design, built on desk research conducted 8 September 2026. Every claim is tagged **[FACT]** (verifiable, sourced in `sources.md`), **[REC]** (my recommendation), or **[ASSUMPTION]** (my estimate, unverified). Nothing here is legal, tax, or financial advice.

---

## 1. The single most important finding

You asked me to challenge your assumptions. Here is the one that matters.

**[FACT]** Statista's market model puts Kenya's *influencer advertising* spend at **US$2.1M in 2024, forecast to reach US$3.0M by 2028**. Kenya's *entire digital advertising* market is modelled at **US$95.5M (2024) → US$119.4M (2028)**. ([Statista Kenya Influencer Advertising](https://www.statista.com/outlook/dmo/digital-advertising/influencer-advertising/kenya), [Statista Kenya Digital Advertising](https://www.statista.com/outlook/dmo/digital-advertising/kenya))

**[FACT]** Zaumu, a Kenyan competitor that launched in April 2025, publicly cites Kenyan influencer marketing spend of **$2.5M in 2024 against a "$25M potential."** ([Capital FM](https://capitalfm.africa/zaumu-unveils-africas-first-creator-first-digital-marketplace-in-nairobi/))

Run the arithmetic. If you captured **100% of the entire measured Kenyan influencer advertising market** at a **15% take rate**, you would earn roughly **US$315,000 per year** — about KSh 40M. That is not a venture-scale company. It is a good lifestyle agency.

**This is the fact that should reshape the entire plan.** A "creator marketplace for Kenya" monetised by a take rate on influencer campaigns is arithmetically incapable of becoming large. Three of your named competitors — Wowzi, AIfluence, Zaumu — are, in my reading, all fishing in this same undersized pond.

### The reframe that makes it a real company

The market is not influencer advertising. Three larger budgets are adjacent and reachable:

| Budget pool | Why it is bigger | Who holds it |
|---|---|---|
| **Content production / creative** | Every brand running Meta & TikTok ads needs 10–40 creatives a month, forever. This is a *production* line item, not an *influencer* line item, and it recurs. | Performance marketers, e-commerce, agencies |
| **SME marketing & trade/footfall** | ~Restaurants, salons, clinics, gyms, dealerships, retail. They have no marketing team and never appear in "influencer spend" statistics because the money moves informally via WhatsApp and M-Pesa. | SME owners |
| **Export / labour arbitrage** | **[FACT]** US UGC platforms price video at **$99–$200 (Billo)**, **$50+ (Trend)**, **$100–$500 (Cohley)**. **[FACT]** Kenyan micro-influencer rates run KSh 10,000–50,000 per post, and UGC-only rates sit well below that. A Kenyan creator producing at $30–60 is a 3–5x cost advantage for a global buyer. | Global DTC brands, agencies |

**[REC]** Design for pool 1 and 2 at launch, and architect so pool 3 is switched on in V3 without a rebuild. The influencer campaign is a *feature*, not the business.

---

## 2. The five decisions that matter most

Everything else in this pack is downstream of these.

### Decision 1 — Sell outcomes, not a search tool
**[REC]** The Kenyan buyer at launch is an SME owner with no marketing team. They do not want a creator database. They want *"I paid KSh 45,000 and got 12 videos and 5 creators visited my restaurant."* Ship a **productised campaign catalogue** ("Campaign-in-a-Box") with fixed prices and guaranteed outputs. Discovery filters are V2. Every marketplace that leads with search in a thin market dies of empty-result syndrome.

### Decision 2 — Creator keeps 100%; the brand pays the fee
**[REC]** Charge the **brand 15% on top** of a transparently displayed creator rate. Charge creators **0%** for the first 24 months.

Why: **[FACT]** Collabstr charges creators a **15% payout fee** *and* brands a 10% marketplace fee. **[FACT]** Fiverr takes a flat 20% from sellers. Kenyan creators' loudest grievance is opaque agency deductions. "You keep every shilling of your rate" is the single strongest supply-acquisition message available to you, and it is free to give away while GMV is small.

### Decision 3 — Solve cold-start with *existing* deals, not new demand ("Deal Desk")
**[REC]** This is the highest-leverage idea in the pack. Kenyan creators already have brand relationships — negotiated on WhatsApp, paid late or not at all. Do not try to originate all demand.

Let a creator bring their **own** existing client onto the platform for **escrow + contract + guaranteed M-Pesa payout, at a 5% creator-paid fee**. (Precedent: **[FACT]** Upwork Direct Contracts at 5%.)

This produces real GMV, real reviews, and a real reputation ledger **on day one, without solving the two-sided cold start**. It converts the informal WhatsApp economy — which is where the actual Kenyan money already is — into on-platform transactions. It is also the fastest way to discover which brands are already spending.

### Decision 4 — Raise average order value, not take rate
**[ASSUMPTION]** Modelled in `04-economics-and-pricing.md`: at a **KSh 10,000** average order, M-Pesa collection + payout costs consume **~14–21% of platform revenue**, and per-order human ops costs make the unit uneconomic below meaningful scale. At **KSh 40,000** average order (multi-creator campaigns, packages, retainers), the same take rate produces a viable business roughly 4x sooner. **AOV is the lever; take rate is not.**

### Decision 5 — Do not hold customer funds yourself
**[FACT]** In Kenya, processing retail payments, operating digital wallets, or acting as an aggregator requires a **Payment Service Provider licence from the Central Bank of Kenya** under the National Payment System Act 2011 and NPS Regulations 2014, with requirements to segregate client funds via trust/escrow structures. ([CBK](https://www.centralbank.go.ke/wp-content/uploads/2020/06/Payment-Service-Providers-Authorization-checklist.pdf), [CM Advocates](https://cmadvocates.com/blog/obtaining-a-psp-license-in-kenya-a-comprehensive-legal-and-regulatory-guide/))

**[REC]** Launch on a **licensed aggregator** (IntaSend / Paystack / Pesapal / Flutterwave) so the regulated float sits with a licensed party. Model escrow as a **short-duration, purpose-bound conditional payment**, not a stored-value wallet. Never let a creator "balance" idle indefinitely — auto-sweep to M-Pesa. **This must be reviewed by a Kenyan payments lawyer before launch.**

---

## 3. What the competition actually looks like

**[FACT]** Verified, funded, operating players in this exact market:

- **Wowzi** (Kenya) — raised **$3.2M total** ($1.2M pre-seed + $2M seed, Dec 2021, led by 4DX Ventures). Focused on nano/micro creators; reportedly ~90% of weekly payouts go to micro and nano creators.
- **AIfluence** (Kenya) — raised **$1M seed** (July 2021, led by EQ2 Ventures); AI matching; ran campaigns across 13 countries in Africa and Asia.
- **Zaumu** (Kenya) — launched April 2025. **Already ships escrow-funded milestone payments, creator-protective contracts, two-sided reviews and in-platform messaging.** This is close to the product you described to me.
- Others operating: Ushawishi, Vicomma, Diglancers, Influencer Africa (EchoHouse), Lit.africa, Aktivate, ViralGet (Nigeria).

**[FACT — negative result]** I could **not** verify the existence or find any substantive public information for **Oiqora, NingNang, EndaViral, Vumasasa, or a Kenyan platform named "InfluencerX."** I am not going to invent profiles for them. If these are real, they are small enough to leave no public footprint, which is itself informative.

**The honest competitive read:** the "creator marketplace with escrow for Kenya" idea is **taken, and executed, as of April 2025**. Your differentiation cannot be escrow, contracts, or reviews. It has to be one of: the non-influencer campaign types (visits, UGC-at-scale, seeding logistics), the Deal Desk wedge, AOV, or the underwriting layer below.

---

## 4. The one insight that could make this hard to displace

> **In a market where the median transaction is KSh 5,000 and the median buyer is an SME, no marketplace survives on the transaction. It survives on the _record_ of the transaction.**
>
> Whoever accumulates the **verified, escrow-settled earnings history of African creators** owns the only dataset that can underwrite them — and underwriting is what makes leaving expensive.

Concretely: after 18 months of settled collaborations you know, for thousands of creators, what they actually earn, how reliably they deliver, and who pays them. Nobody else can know this — not TikTok (no payment rail), not the banks (no work history), not the agencies (no structured data). That asset supports creator advances and earned-wage access, brand credit terms, and eventually insurance-style delivery guarantees.

A creator will leave a marketplace over a 15% fee. A creator will not leave the place that holds their income record and advances against it. **The take rate is the toll; the ledger is the moat.**

**[ASSUMPTION]** This is a V3+ thesis and should be *architected for* now (immutable settlement ledger, structured performance events) but not *built* now.

---

## 5. Why this could fail — the three most likely causes

1. **The Kenyan market is too small and too cheap to support a venture-scale take-rate business, and you discover this after 18 months.** Early warning: blended AOV stuck under KSh 15,000 at month 9. Mitigation: instrument AOV weekly from day one; treat export/regional as a scheduled experiment, not a someday.
2. **Disintermediation.** Both sides meet once, then move to WhatsApp and M-Pesa forever. Kenya makes this trivially easy — everyone already has the rails. Early warning: repeat-collaboration rate below ~25% by month 6. Mitigation: the fee must buy something that only exists on-platform (escrow, guaranteed replacement, rights contracts, dispute cover, and eventually advances). The Deal Desk turns this threat into a product.
3. **Ops cost per order exceeds gross profit per order and never crosses over.** A KSh 10,000 order that consumes 20 minutes of human ops is permanently unprofitable. Early warning: cost-to-serve per completed order not falling quarter on quarter. Mitigation: ruthless AOV growth and automation of approval/proof verification.

Seventeen more, with prevention and early-warning signals, are in `15-investor-case-and-risks.md`.

---

## 6. Where to go next in this pack

| Document | Covers your Parts |
|---|---|
| `01-global-market-research.md` | 1 — global platforms + feature matrix |
| `02-africa-kenya-landscape.md` | 2 — Kenya/Africa competitors, unmet need |
| `03-marketplace-definition.md` | 3 — the ten collaboration types |
| `04-economics-and-pricing.md` | 4, 33, 34, 48 — business model, fees, simulations |
| `05-payments-mpesa.md` | 5 — M-Pesa, escrow, refunds, compliance architecture |
| `06-trust-reputation-fraud.md` | 6, 13, 26, 35 — reputation, disputes, fraud |
| `07-product-spec.md` | 7–9, 14–21, 25, 26, 32, 39, 40 — profiles, discovery, UX, positioning |
| `08-ai-matching.md` | 10, 11 — matching algorithm and AI campaign builder |
| `09-workflow-states.md` | 12 — the full state machine |
| `10-technical-architecture.md` | 22, 37, 38 — stack, WhatsApp, data model |
| `11-analytics-metrics.md` | 23, 24, 44, 45 — dashboards, metrics, North Star |
| `12-gtm-liquidity-growth.md` | 27–31 — liquidity, launch, growth loops, referrals |
| `13-legal-compliance.md` | 36 — Kenyan regulatory surface |
| `14-roadmap-mvp.md` | 42, 43, 49 — MVP, roadmap, first 10 campaign templates |
| `15-investor-case-and-risks.md` | 46, 47 — investor case, 20 failure modes |
| `16-blueprint-and-decisions.md` | 41, 50 — blueprint, build/don't-build lists, founder brief |
| `sources.md` | All citations |

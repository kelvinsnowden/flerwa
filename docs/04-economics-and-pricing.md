# Parts 4, 33, 34, 48 — Marketplace Economics

**[ASSUMPTION]** All conversions at **KSh 129 = US$1**. Verify at time of use.

---

## Part 4 — Evaluating the thirteen models

| Option | Verdict | Reasoning |
|---|---|---|
| **A. % from brands** | **✅ CORE** | Brand is the party with budget, the party receiving the guarantee, and the party least fee-sensitive (they are used to 20–40% agency markups). |
| **B. % from creators** | ❌ Not at launch | Every competitor and agency does this. Refusing to is your loudest supply message. **[FACT]** Collabstr charges creators 15%; Fiverr 20%. |
| C. Both sides | ⚠️ Later, selectively | Only for creator-originated demand (Deal Desk). |
| D. Brand subscription | ❌ Not at launch | Requires proven, repeated value. Kills trial. Kenyan SMEs do not buy SaaS. |
| **E. Freemium + transaction fee** | **✅ CORE** | Free to browse and post; pay only when you transact. Zero-risk entry, aligned incentives. |
| **F. Managed campaign service** | **✅ YES — and larger than you think** | 15–25% premium over self-serve. At launch this *is* the product for most buyers. |
| G. Escrow fee | ❌ | Do not itemise. Escrow is the promise, not a line item — charging for it undermines it. |
| H. Payment processing fee | ⚠️ Absorb, don't charge | Absorb into take rate. An extra visible fee at checkout is the #1 conversion killer. |
| I. Creator verification fee | ❌ **Never** | Charging poor creators for the privilege of being trusted is predatory, invites fraud (people who pay expect access), and would be your worst PR moment. |
| J. Premium creator placement | ⚠️ V3 only | Corrupts ranking integrity, which is your product. Only after ranking quality is proven and defensible. |
| **K. Agency accounts** | **✅ V2** | High AOV, low CAC, repeat. See Part 32 in `07-product-spec.md`. |
| **L. Enterprise accounts** | **✅ V2–V3** | Where large GMV actually lives — telcos, banks, FMCG. |
| **M. Affiliate / performance rev** | ⚠️ V3 | Best long-term margin; requires attribution infrastructure you will not have for 18 months. |

### The recommendation

**[REC] Launch model: A + E + F.**

```
Brand pays:      creator rate  +  15% service fee
Creator receives: 100% of their listed rate
Platform keeps:   the 15%
Managed service:  +10% (total 25%) when the platform runs the campaign
Creator fee:      0% — guaranteed in writing for 24 months
```

**Two deliberate exceptions:**

1. **Deal Desk (creator-originated):** creator brings their own existing client → **creator pays 5%, brand pays 0%**. Precedent: **[FACT]** Upwork Direct Contracts at 5%. Rationale: the creator generated the demand, so the platform's contribution is escrow + contract + guaranteed payout, which is worth 5% and not 15%.
2. **Product-only seeding:** **flat listing fee** (e.g. KSh 500/creator slot) rather than a percentage, because there is no cash flow to take a percentage of.

**Why 15% and not 20%?** **[FACT]** Collabstr's effective blended take is ~25% (10% brand + 15% creator). **[FACT]** Fiverr's is ~25%. Both operate in markets with high switching friction. **Kenya has near-zero switching friction — both parties already have M-Pesa and WhatsApp.** A 25% blended take here is an invitation to disintermediate on transaction two. 15% single-sided is defensible; 25% two-sided is not.

**Why not 10%?** The economics below show that at KSh 10,000 AOV, payment costs alone consume 14–21% of revenue. At 10% take you cannot fund human ops, and human ops is what makes the marketplace work in year one.

---

## Part 34 — Fee psychology: on-top vs deducted

Your two framings:

**(a) On-top:** Brand pays KSh 10,000 + KSh 1,500 fee = **KSh 11,500**. Creator receives **KSh 10,000**.
**(b) Deducted:** Brand pays **KSh 10,000**. Creator receives **KSh 8,500**.

Identical economics. Very different behaviour.

| | (a) On-top | (b) Deducted |
|---|---|---|
| Creator perception | **"I keep 100%."** Recruiting weapon. | "They take a cut like everyone else." |
| Creator rate-setting | Honest — they list their true rate | **They inflate to compensate**, so listed prices drift upward and comparability breaks |
| Brand perception | Sees a fee, may resent it | Sees one clean number |
| Off-platform pressure | Brand tempted to skip the fee | **Creator** tempted to skip the fee |
| Price transparency | High — one rate, one fee | Low — rates are quietly padded |
| Precedent | Airbnb, Upwork client fee | Fiverr, Collabstr creator fee |

**[REC] Use (a), on-top, displayed transparently.**

Three reasons, in order of weight:

1. **It is the strongest supply-acquisition message available, and supply is your binding constraint in year one.** "You keep every shilling you charge" is unambiguous, verifiable, and directly attacks the grievance the entire Kenyan creator market has with agencies.
2. **It prevents rate inflation.** Under (b), every creator pads their listed price by the fee, which destroys the price comparability that makes a marketplace legible.
3. **It moves disintermediation pressure to the brand, where you can defend it.** The brand is the party receiving escrow protection, dispute cover, guaranteed replacement, and a rights contract. That is a defensible 15%. The creator, under (b), receives nothing they can point to — so their incentive to leave is unanswerable.

**[REC] Show the fee as a value line, never a naked deduction:**

```
Creator fee (Amina W.)                    KSh 10,000
Platform service fee (15%)                 KSh 1,500
  ↳ Escrow protection · Free replacement if she doesn't deliver
  ↳ Signed usage-rights contract · Dispute resolution
─────────────────────────────────────────────────────
Total                                     KSh 11,500
```

**[REC] Never itemise the M-Pesa cost separately.** Absorb it. A second fee line at checkout reads as nickel-and-diming and measurably reduces conversion.

---

## Part 4 (cont.) — Revenue at GMV scale

**Monthly platform revenue by monthly GMV and take rate (KSh):**

| Monthly GMV | 5% | 10% | 12.5% | **15%** | 20% |
|---|---|---|---|---|---|
| **1,000,000** | 50,000 | 100,000 | 125,000 | **150,000** | 200,000 |
| **5,000,000** | 250,000 | 500,000 | 625,000 | **750,000** | 1,000,000 |
| **10,000,000** | 500,000 | 1,000,000 | 1,250,000 | **1,500,000** | 2,000,000 |
| **50,000,000** | 2,500,000 | 5,000,000 | 6,250,000 | **7,500,000** | 10,000,000 |
| **100,000,000** | 5,000,000 | 10,000,000 | 12,500,000 | **15,000,000** | 20,000,000 |

**Annualised at 15% take:**

| Monthly GMV | Annual GMV | Annual revenue | ≈ USD |
|---|---|---|---|
| KSh 1M | KSh 12M | KSh 1.8M | ~$14,000 |
| KSh 5M | KSh 60M | KSh 9M | ~$70,000 |
| KSh 10M | KSh 120M | KSh 18M | ~$140,000 |
| KSh 50M | KSh 600M | KSh 90M | ~$698,000 |
| KSh 100M | KSh 1.2B | KSh 180M | ~$1,395,000 |

### Read this table against the market size

**[FACT]** Statista models Kenya's entire influencer advertising market at **~US$2.1M (2024), ~US$3.0M (2028)** — roughly **KSh 270M–390M per year**.

**KSh 100M GMV per month is KSh 1.2B per year — roughly 3–4x the entire modelled Kenyan influencer advertising market.**

**[REC] This is the arithmetic that must drive strategy.** To reach even $1.4M ARR you must be capturing budget that is *not* classified as influencer advertising:
- content **production** budgets (recurring, larger, and not in the statistic)
- SME **marketing** budgets (informal, invisible to Statista, potentially large in aggregate)
- **regional** GMV (Uganda, Tanzania, Rwanda, Ethiopia)
- **export** GMV (global brands buying African creators at a 3–5x cost advantage)

A Kenya-only, influencer-only take-rate business tops out somewhere around **$200k–$400k ARR.** That is the honest ceiling, and you should say it out loud in every strategy conversation.

---

## Part 48 — Full business simulation

**[ASSUMPTION]** All cost inputs below are my estimates for Nairobi in 2026 and must be replaced with real quotes. Payment-cost inputs are grounded in **[FACT]**: M-Pesa B2C offers a *Business Pays* tariff where the customer pays KSh 0 on amounts from KSh 1 to KSh 250,000, a 50/50 *Shared Cost* option, and a *Customer Pays* option; aggregator collection pricing in Kenya is commonly quoted in the 1.5–3.5% range and is negotiable with volume.

### Scenario 1 — 100 brands · 1,000 creators · 500 collaborations/month

| Line | Amount (KSh/mo) | Note |
|---|---|---|
| Collaborations | 500 | |
| Average order value | 10,000 | |
| **GMV** | **5,000,000** | |
| Platform revenue @15% | 750,000 | |
| Creator payouts | (5,000,000) | pass-through |
| Collection cost @1.5% of 5.75M | (86,250) | STK Push via aggregator |
| Payout cost @1% + KSh 45/txn | (72,500) | B2C, business absorbs |
| **Payment cost total** | **(158,750)** | **21.2% of revenue** |
| Ops & support (4 FTE @ 80,000) | (320,000) | manual campaign ops |
| **Gross profit** | **271,250** | **36% gross margin** |
| Engineering & product (4 FTE @ 250,000) | (1,000,000) | |
| Marketing | (500,000) | |
| Infrastructure & tools | (100,000) | |
| G&A | (300,000) | |
| **Net** | **(1,628,750)** | **≈ −$12,600/month** |

### Scenario 2 — 1,000 brands · 10,000 creators · 5,000 collaborations/month

| Line | Amount (KSh/mo) | Note |
|---|---|---|
| **GMV** | **50,000,000** | AOV still 10,000 |
| Platform revenue @15% | 7,500,000 | |
| Collection @1.0% of 57.5M | (575,000) | volume-negotiated |
| Payout @0.5% + KSh 45/txn | (475,000) | |
| **Payment cost total** | **(1,050,000)** | **14% of revenue** |
| Ops & support (15 FTE @ 80,000) | (1,200,000) | ~333 orders/person |
| **Gross profit** | **5,250,000** | **70% gross margin** |
| Engineering & product (12 @ 300,000) | (3,600,000) | |
| Marketing | (3,000,000) | |
| Infrastructure | (400,000) | |
| G&A | (1,500,000) | |
| **Net** | **(3,250,000)** | **≈ −$25,200/month** |

*Note: at this stage, cutting marketing to KSh 1M would bring it to roughly breakeven — the loss is a growth choice, not a structural one.*

### Scenario 3 — 10,000 brands · 100,000 creators · 50,000 collaborations/month

| Line | Amount (KSh/mo) | Note |
|---|---|---|
| **GMV** | **500,000,000** | **≈ $3.9M/month — pan-African + export only** |
| Platform revenue @15% | 75,000,000 | |
| Collection @1.0% | (5,750,000) | |
| Payout @0.5% + KSh 40/txn | (4,500,000) | |
| **Payment cost total** | **(10,250,000)** | **13.7% of revenue** |
| Ops & support (33 FTE @ 90,000) | (2,970,000) | ~1,500 orders/person via automation |
| **Gross profit** | **61,780,000** | **82% gross margin** |
| Engineering & product (40 @ 350,000) | (14,000,000) | |
| Marketing | (15,000,000) | |
| Infrastructure & AI | (3,000,000) | |
| Fraud, disputes, refunds | (2,000,000) | |
| G&A | (8,000,000) | |
| **Net** | **+19,780,000** | **≈ +$153,000/month · 26% net margin** |

### The four things these models actually tell you

**1. Payment cost is a structural tax that never disappears.**
14–21% of revenue, in every scenario. It improves with negotiation but not with scale beyond a point, because M-Pesa's cost floor is real. **[REC] Negotiate aggregator pricing from day one, batch payouts where creators consent, and build the business case for a direct Safaricom relationship at scale.**

**2. AOV matters far more than take rate.**

At 500 collaborations/month, holding everything else constant:

| AOV | GMV | Revenue @15% | Gross profit | Δ vs baseline |
|---|---|---|---|---|
| KSh 10,000 | 5.0M | 750,000 | 271,250 | baseline |
| KSh 20,000 | 10.0M | 1,500,000 | 862,500 | **+218%** |
| KSh 40,000 | 20.0M | 3,000,000 | 2,045,000 | **+654%** |

**Doubling AOV more than triples gross profit**, because ops cost is per-*order*, not per-shilling, and payout cost is largely per-transaction. Raising the take rate from 15% to 20% at KSh 10,000 AOV adds only KSh 250,000 of revenue and costs you competitive position.

> **[REC] Make average order value the primary commercial objective of the company. Not take rate. Not creator count.**
>
> The levers: multi-creator campaigns (10 creators × KSh 5,000 = one KSh 50,000 order), packages and add-ons, rights upgrades, retainers, managed service, and agency/enterprise accounts.

**3. Human ops cost per order must fall by roughly 4.5x between Scenario 1 and 3** (from ~125 to ~1,500 orders per ops FTE). If it does not, Scenario 3 is loss-making. **[REC] Instrument cost-to-serve per completed collaboration from the first month and hold it as a board metric.**

**4. Breakeven is roughly KSh 25–35M GMV/month** at 15% take with a lean team — call it **~2,500 collaborations at KSh 10,000, or ~700 at KSh 40,000.** The second path is dramatically more achievable, which is the whole argument for AOV.

---

## Part 33 — Subscriptions

**[REC] No subscriptions at launch. Introduce in V2, and only for brands.**

Why not at launch: **[FACT]** GRIN, Modash, Aspire, Upfluence and CreatorIQ all sell subscriptions to customers who *already* run creator programs and know the value. Kenyan SMEs are not that customer, do not buy SaaS, and will not pay before receiving value. A subscription at launch converts your funnel from "try it for free, pay when it works" to "pay to find out" — which in a low-trust market is fatal.

**V2 tiering, once repeat purchase is proven:**

| Plan | Price | Take rate | For |
|---|---|---|---|
| **Free** | KSh 0 | 15% | Everyone. Full marketplace access. |
| **Growth** | KSh 15,000/mo | 12% | 3 seats, saved creator lists, campaign templates, basic analytics |
| **Pro** | KSh 45,000/mo | 10% | 10 seats, API, rights library, ROI attribution, priority support |
| **Enterprise** | Custom | 7–8% | SSO, procurement, custom contracts, dedicated manager, invoicing terms |

**[REC] The pricing logic must be "subscription buys a lower take rate."** This is self-selecting: a brand only upgrades when its GMV makes the maths work, which means every upgrade is a brand that has already proven repeat purchase. Breakeven for Growth is ~KSh 500,000 monthly GMV; for Pro, ~KSh 900,000. Show that calculator in the product and let brands upgrade themselves.

**[REC] Never subscription-gate creators.** Ever. It is the fastest way to destroy supply and the reputation of the platform.

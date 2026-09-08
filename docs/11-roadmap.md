# 11 — MVP, Roadmap and Plan (Brief §40, §41, §45–48, §61–63)

## The test that comes before the MVP

**[REC] Before writing a line of code, resolve the one assumption the entire strategy rests on.**

> **Will a diaspora Kenyan pay ~KSh 6,000 (~US$46) for a verified stranger to inspect a property and produce an evidenced report before they send a deposit?**

**The 30-day validation, costing roughly KSh 150,000:**

| Week | Action | Decision gate |
|---|---|---|
| 1 | 20 structured interviews in diaspora Facebook/WhatsApp groups. Ask about a *past* transaction, never a hypothetical future one. | Do ≥8 report a specific near-miss, loss or unresolved fear? |
| 2 | Landing page + one product. Paid promotion into three diaspora groups. **Take real money.** | Do ≥10 people pay without speaking to a founder? |
| 3–4 | **Deliver 10 inspections by hand.** Founders recruit and accompany 3 inspectors. Produce real reports. | Do ≥7 customers say they would pay again and refer? |

**[REC] The kill criterion, written down in advance:** if fewer than 10 people pay in week 2, the diaspora wedge is not validated and you should reassess against Vertical 2 (business & creator services) — where you already have a complete blueprint and a proven willingness to pay — rather than proceeding on hope.

**[REC] Do not skip this because it feels small.** **[FACT]** Lynk spent years pivoting operating models to find one that worked in Nairobi, and SweepSouth spent $15M+ before exiting Kenya. Both would have been better served by cheaper, earlier disconfirmation.

---

## MVP — what it proves

Your brief lists ten proof points. **[REC] Only three of them can genuinely be tested in an MVP, and the rest follow from those:**

1. **Customers will pay before the work.** (Escrow is accepted.)
2. **Jobs complete to a standard that satisfies the customer.** (Supply and QC work.)
3. **Customers come back.** (It is a business, not a favour.)

Everything else — provider willingness, satisfaction, per-transaction margin — is either obvious or a consequence.

### MVP feature set

**Customer (mobile web):** phone OTP · "what do you need?" free-text + 4 productised services · browse providers or let ops assign · book and pay via STK Push · **see escrow status** · track job status · receive structured report / evidence · approve or dispute · rate provider · **rebook in one tap**.

**Provider (mobile web, offline-tolerant):** phone OTP · verification flow (ID + liveness + M-Pesa name match) · profile and storefront · accept/decline jobs · **see that funds are escrowed** · check-in with geotag · **in-app evidence capture** · submit · earnings view (pending / in escrow / paid).

**Platform:** escrow (fund → hold → release) · M-Pesa STK collection and B2C payout · **all timers, especially 5-day auto-approve** · structured job scope · structured evidence capture · two-sided reviews · **ops console** · double-entry ledger · WhatsApp notifications · manual dispute handling.

**Four productised services only:** Know Before You Pay (inspection) · Viewed For You · Landlord's Quarterly Check · Document Collection.

### NOT building — and why (Brief §41)

| Deferred | Why |
|---|---|
| **Native mobile apps** | App-store friction kills a low-trust funnel. Mobile web; PWA if needed. |
| **100+ categories** | The failure mode of the predecessors. Four services. |
| **AI matching / AI intake** | No transaction data to train on. Ops reads requests manually — that *is* the spec. |
| **"Just ask" free-text automation** | Same. Humans first, taxonomy second, model third. |
| Post-a-task bidding | **[FACT]** Lynk abandoned auction for standardisation. Don't rebuild what they discarded. |
| Quote-based work | MVP is fixed-price only. Quoting arrives with Vertical 3. |
| Materials escrow | Not needed until fundi work. Designed now, built later. |
| Recurring billing | Manual for the first 20 series. |
| Provider subscriptions / premium placement | Corrupts ranking before ranking is proven |
| Automated background checks | **[REC]** Manual, documented, defensible claims only |
| Insurance / lending / financial products | Regulatory work far beyond MVP; keep out of the pitch |
| Enterprise & agency accounts | Serve manually |
| Advanced analytics, loyalty, gamification | Feel like progress, move nothing |
| Multi-city, multi-currency | One corridor, KES |
| Complex logistics | Not the business |

### Manual by design

| Function | Manual method | Automate at |
|---|---|---|
| Provider recruitment & vetting | Founders interview every provider in person | Never fully |
| Matching | Ops assigns by hand | 300 jobs/mo |
| Intake of free-text requests | Ops reads and structures | 500 jobs/mo |
| Report QC | **Ops reviews every report before the customer sees it** | 400 jobs/mo |
| Disputes | Founder decides | Never fully |
| Recurring scheduling | Ops calendar | 20 active series |
| **Payouts** | **Automated from day one — never manual** | — |

**[REC] Report QC is the one manual step to protect longest.** In the launch vertical the report *is* the product, and a single bad report is a customer who loses money.

---

## 90-day plan (Brief §61)

| Weeks | Focus | Target |
|---|---|---|
| **1–4** | Validation sprint above. Incorporate. Start aggregator onboarding and legal opinions **in week 1**. | 10 paid inspections; go/no-go |
| **5–8** | 40 more jobs, still manual. Recruit to 12 verified providers. Write down every price, failure and dispute. Build the ops console. | 50 cumulative jobs; KSh 350k GMV |
| **9–12** | Ship MVP to existing users. Deal Desk live. First recurring series. | 120 jobs/mo; KSh 850k GMV; **≥30% repeat** |

**[REC] Judge the quarter on three numbers only:** completion rate (>90%), **repeat/referral rate (>30%)**, median time to payout (<2 hours). Nothing else matters yet.

---

## 12-month roadmap (Brief §62)

| Months | Milestone | Key additions | Gate to proceed |
|---|---|---|---|
| **1–3** | V0 — manual | Validation, 50 jobs | 30% repeat, >90% completion |
| **4–6** | V1 — MVP live | Escrow, storefronts, evidence capture, ops console, Deal Desk | 300 jobs/mo, contribution-positive per job |
| **7–9** | **Vertical 2 opens** | Business & creator services from the archive; business accounts; quote-based work | 700 jobs/mo, AOV ≥ KSh 9,000 |
| **10–12** | Depth, not breadth | Recurring engine, landlord accounts, workmanship guarantee, structured dispute automation | 1,200 jobs/mo, **≥40% repeat GMV** |

**[REC] Notice what is absent: no new geography and no fundi vertical in year one.** Both are month 12+ decisions, gated on the repeat rate.

---

## V2 (months 12–24)

Fundi vertical with materials escrow and workmanship guarantee · quote-based transactions · recurring at scale · agency/landlord/business accounts · LLM intake structuring (trained on real requests) · automated dispute rules · second corridor within Nairobi · insurance partnership exploration.
**KPI:** repeat GMV %. **Risk:** vertical dilution — adding fundis before verification ops are boring and reliable. **Gate to V3:** KSh 30M GMV/month with positive contribution per job.

## V3 (months 24–42)

Third city (Mombasa) · export corridor for Vertical 2 · learned matching on real outcome data · property service history as a durable record · **[ASSUMPTION]** embedded insurance attachment.
**KPI:** GMV and contribution margin. **Risk:** premature geography. **[REC] Rule: do not enter a second city until the first is contribution-positive** — the discipline SweepSouth did not apply.

---

## 3-year vision (Brief §63)

**[REC] Stated honestly, without the hockey stick:**

By year three the realistic good outcome is **KSh 150–200M GMV per month across two cities and three verticals, approaching breakeven, with a verified record of several hundred thousand completed real-world jobs.** That is a real company. It is not a unicorn, and any plan that says otherwise at this stage is a plan that has not met Nairobi.

What that record makes possible — insurance attachment, provider financial products, becoming the system of record for property maintenance — is genuinely valuable and genuinely uncertain. **[REC] Treat it as upside in the narrative, never as the plan.**

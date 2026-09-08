# Part 1 — The Global Market

**Method and honesty note.** Pricing, fee, and mechanic claims below are tagged **[FACT]** where I verified them in September 2026 desk research (sources in `sources.md`). Where you asked questions that vendors do not publish — internal fraud models, dispute adjudication rules, cancellation edge cases — I mark **[INFERRED]** and say so rather than inventing detail. Several of your 35 questions simply have no public answer for most platforms; pretending otherwise would poison the analysis.

**Structural observation before the detail.** The eight platforms you named are not one category. They are **four** categories with different customers, different economics, and different failure modes. Confusing them is the most common strategic error in this space.

| Archetype | Who pays | What is really sold | Examples |
|---|---|---|---|
| **A. Transactional marketplace** | Brand, per order | A completed collaboration | Collabstr |
| **B. Managed UGC factory** | Brand, per asset | A finished video | Billo, Trend, Insense (partly), Cohley |
| **C. SaaS workflow / CRM** | Brand, per seat/year | Control of a program you already run | GRIN, CreatorIQ, Aspire, Upfluence |
| **D. Data / discovery layer** | Brand, per year | A searchable index | Modash |
| **E. Platform-native marketplace** | Nobody (loss leader) | Ad-budget retention | TikTok Creator Marketplace |

**[REC]** You are building **A + B**, with a thin slice of D. You are explicitly *not* building C — the SaaS workflow model requires customers who already run large creator programs, and Kenya has almost none.

---

## 1. TikTok Creator Marketplace (TCM) / TikTok One

**Problem solved.** Keeps brand creator-spend inside TikTok's walls and makes TikTok ad campaigns easier to feed with creator content.
**Primary customer.** Brands and agencies already buying TikTok ads.
**How it works.** **[FACT]** TCM now lives inside **TikTok One**, TikTok's unified brand platform, accessed through a TikTok Ads Manager account. Brands filter creators by keyword, region, follower range and performance metrics, build lists, and send a campaign brief with deliverables, deadlines and payment terms. Creators accept or decline in their TCM dashboard.
**Creator discovery of opportunity.** Invite-driven — the creator receives the brief. Weak self-serve browse.
**Matching.** First-party data: TikTok owns real audience demographics and video performance, which no third party can match.
**Pricing.** **[FACT]** No set pricing; creator and brand negotiate rate directly.
**Payments & monetisation.** **[FACT]** Free to join and use for both sides; TikTok monetises the downstream ad spend, not the collaboration.
**Verification.** **[FACT]** Eligibility gate of **10,000 followers** (50,000 in South Korea).
**Rights / amplification.** Native Spark Ads integration is the structural advantage — content flows straight into paid media.
**Strongest feature.** Ground-truth first-party audience data plus zero fee.
**Biggest weakness.** **The follower gate excludes the entire UGC-creator population**, campaign management is thin, it is single-platform, payment rails are weak outside major markets, and the 10k floor is exactly wrong for African nano-creator economics.
**[INFERRED]** Dispute, cancellation and revision handling are minimal; TCM is a matching and briefing layer, not an escrow marketplace.

**Why this matters to you:** TCM is the "why won't the platform crush us" question. Answer: it structurally cannot serve sub-10k creators, cannot do location visits, product seeding logistics, cross-platform campaigns, or M-Pesa settlement — and has no incentive to.

---

## 2. Collabstr — the closest analogue to what you described

**Problem solved.** Removes negotiation and payment friction from small creator bookings. Buy a creator's service like an e-commerce product.
**Primary customer.** SMB / DTC brands buying one to ten creators at a time.
**How it works.** Creators publish packaged services with **fixed listed prices**; brands browse, order, and pay upfront. This is the "storefront" model you describe in Part 17 — and it is validated.
**Prices.** Creator-set, published on profile. No negotiation required.
**Payments.** **[FACT]** Payment is held **in escrow** and is not released until the brand approves the deliverable. Refund if the creator does not deliver. Payouts run through **Dots.dev**, supporting bank transfer, PayPal, mobile wallets and local rails; collection via Stripe.
**Revisions & disputes.** **[FACT]** The brand has **72 hours** after submission to request a revision or open a dispute.
**Monetisation.** **[FACT]** Basic plan free with a **10% marketplace fee**; **Pro $299/mo** (1 campaign, analytics for 5 posts); **Premium $399/mo** (unlimited campaigns, analytics for 15 posts, **5% marketplace fee**). Separately, **creators pay a 15% fee on their payout.**
**Strongest feature.** Instant transactability. Price is visible, ordering is one click, escrow is automatic. Liquidity comes from listing density, not sales effort.
**Biggest weakness.** **The fee stack.** Charging brands 10% *and* creators 15% means a ~25% blended take, which is a standing invitation to go off-platform once a relationship exists. Also: shallow campaign management, no location/visit primitives, no logistics, minimal ROI attribution.

**[REC]** Copy the storefront and the escrow-on-approval mechanic. **Do not copy the two-sided fee stack** — it is the seam a competitor pries open, and in Kenya it would be fatal.

---

## 3. Insense

**Problem solved.** Sourcing UGC creatives and wiring them into paid social, especially Meta Partnership Ads and TikTok Spark Ads.
**Primary customer.** **[FACT]** E-commerce brands and growth agencies — 1,400+ brands cited; 20,000+ vetted creators; delivery in 5–15 business days.
**Standout mechanic.** **[FACT]** One-click request for **Meta Partnership Ads account-level access** from eligible creators, and Spark Ad code collection through the platform workflow — no DMs, no manual whitelisting.
**Monetisation.** **[FACT]** Hybrid and expensive: self-serve from **~$500/month** (billed quarterly), managed service from **~$1,800/month**, **plus a 7–20% marketplace fee on every creator payment.** Reported plan points include UGC + Creator Ads at ~$450/mo quarterly ($350/mo annual) and Advanced at ~$1,300/mo quarterly.
**Strongest feature.** Whitelisting/Spark Ads plumbing. It is genuinely hard to build and removes the ugliest manual step in creator advertising.
**Biggest weakness.** Subscription + marketplace fee is a double toll; irrelevant to any brand not running significant paid social.

**[REC]** The **rights-and-amplification plumbing is the most copyable high-value idea on this list**, and almost nobody in Africa has it. Put Spark Ads code collection and Meta Partnership Ads access into your rights module by V2.

---

## 4. GRIN

**Problem solved.** Creator-relationship management (a CRM) for brands running programs at scale, with deep e-commerce integration for product seeding and affiliate tracking.
**Primary customer.** Mid-market to enterprise DTC brands with an in-house creator team.
**Monetisation.** **[FACT]** The only one of the enterprise three that publishes pricing: five self-serve tiers — Free (200 credits), **Starter $200/mo**, **Growth $500/mo**, **Scale $1,000/mo**, **Complete $1,500/mo** — roughly **$4,800–$21,600/year**.
**Strongest feature.** Seeding + e-commerce integration; product dispatch and affiliate attribution are first-class, not bolted on.
**Biggest weakness.** **It is not a marketplace.** GRIN does not supply creators — you bring your own. It is worthless to a brand with no existing creator relationships, which describes nearly every Kenyan SME.

---

## 5. CreatorIQ

**Problem solved.** Enterprise-grade measurement, governance, compliance and reporting across very large creator programs.
**Primary customer.** Global enterprises and large agencies.
**Monetisation.** **[FACT]** Custom-quoted; reported roughly **$2,500–$5,000+/month**, with entry implementations estimated around **$36,000+/year** and enterprise deployments higher.
**Strongest feature.** Data integrity and reporting that survives a CFO's scrutiny.
**Biggest weakness.** Cost, implementation weight, and total irrelevance below enterprise scale.

---

## 6. Aspire (AspireIQ)

**Problem solved.** Middle ground between marketplace and workflow — discovery, an opt-in creator marketplace, campaign management, and Shopify-centric commerce workflows.
**Primary customer.** Growing DTC brands.
**Monetisation.** **[FACT]** Custom-quoted; industry estimates **~$21,600–$54,000+/year** depending on scope.
**Strongest feature.** Brands can receive **inbound creator applications** — a genuine liquidity mechanic rather than pure outbound search.
**Biggest weakness.** Opaque pricing, annual commitment, and a feature surface that outruns most buyers' actual maturity.

---

## 7. Upfluence

**Problem solved.** Discovery at scale plus the distinctive trick of identifying influential people **inside your own customer base** via e-commerce/CRM integration.
**Monetisation.** **[FACT]** Does not publish pricing; reported from around **$995/month for a single seat**, modules from ~$478/month, real deployments commonly **$800–$3,000+/month**, on a **12-month minimum contract**.
**Strongest feature.** Customer-to-creator identification. Your best creator is often already a buyer.
**Biggest weakness.** Price, contract rigidity, and dated UX relative to newer entrants.

**[REC]** "Turn your customers into your creators" is a strong, cheap wedge for Kenyan e-commerce and restaurant brands. Worth stealing for V2.

---

## 8. Modash

**Problem solved.** The data layer — a very large searchable index with audience-quality analysis.
**Monetisation.** **[FACT]** Published, self-serve pricing: **Essentials from $199/mo annually** ($299 monthly), **Performance from $499/mo annually** ($599 monthly), **Enterprise from $14,700/year**. **[FACT]** 350M+ profile database; 14-day free trial, no card.
**Strongest feature.** Transparent pricing and audience-authenticity analysis — the fake-follower problem is its core value.
**Biggest weakness.** No transaction, no escrow, no payments. It tells you who to contact and then abandons you.

---

## 9. Others that are strategically relevant

- **Billo** — **[FACT]** UGC video **from $99/video**, no subscription, range ~$99–$200, **full perpetual paid-ads rights included by default.** The cleanest proof that *productised, fixed-price content* is a real business.
- **Trend.io** — **[FACT]** advertises from **$50/video** via a credit system spanning video and photo.
- **Cohley** — **[FACT]** roughly **$100–$500/video**, usually plus a platform fee; enterprise around **$2,000+/month**.
- **Upwork / Fiverr** — the labour-marketplace reference. **[FACT]** Fiverr takes a **flat 20% from sellers and ~5–5.5% from buyers**. **[FACT]** Upwork's fee is tiered — reported both as **0–15% by lifetime billings per client** and as **20% on the first $500, 10% from $500.01–$10,000, 5% above $10,000**; sources conflict on the current schedule, so treat the exact tiers as unverified. Client-side fees reported at **3–5%**, and **5% on Direct Contracts** originated off-platform.

**[REC]** Upwork's Direct Contracts at 5% is the precedent for the **Deal Desk** wedge in `12-gtm-liquidity-growth.md`. It is the single most transferable idea on this page.

---

## Competitive feature matrix

Legend: ● full / native · ◐ partial or limited · ○ absent · ? unverified

| | TikTok TCM | Collabstr | Insense | GRIN | CreatorIQ | Aspire | Upfluence | Modash | Billo/Trend |
|---|---|---|---|---|---|---|---|---|---|
| **Archetype** | Native mkt | Transactional | Managed UGC | SaaS CRM | Enterprise SaaS | Hybrid | SaaS+data | Data | UGC factory |
| Brands post campaigns | ● | ◐ | ● | ◐ | ◐ | ● | ◐ | ○ | ● |
| Brands directly hire (storefront) | ● | ● | ● | ○ | ○ | ◐ | ○ | ○ | ◐ |
| Creators browse/apply | ◐ | ○ | ● | ○ | ○ | ● | ○ | ○ | ● |
| Published creator prices | ○ | ● | ◐ | ○ | ○ | ○ | ○ | ○ | ● (platform-set) |
| Escrow | ? | ● | ● | ○ | ○ | ◐ | ○ | ○ | ● |
| Platform handles payouts | ● | ● | ● | ● | ◐ | ● | ● | ○ | ● |
| Local mobile-money rails | ○ | ◐ (via Dots) | ○ | ○ | ○ | ○ | ○ | n/a | ○ |
| **Paid UGC (no audience needed)** | ○ | ● | ● | ◐ | ◐ | ◐ | ○ | ○ | ● |
| Gifting / product seeding | ◐ | ◐ | ● | ● | ● | ● | ● | ◐ | ○ |
| **Location visits (geo-booked)** | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| **Event coverage** | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Affiliate / promo codes | ◐ | ○ | ◐ | ● | ● | ● | ● | ◐ | ○ |
| Performance-based pay | ◐ | ○ | ○ | ◐ | ◐ | ◐ | ◐ | ○ | ○ |
| **Hybrid fee + performance** | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ | ○ |
| Usage rights / licensing | ◐ | ◐ | ● | ◐ | ● | ◐ | ◐ | ○ | ● |
| Whitelisting / Spark Ads | ● | ○ | ● | ◐ | ● | ◐ | ◐ | ○ | ◐ |
| Revisions workflow | ○ | ● | ● | ◐ | ◐ | ● | ◐ | ○ | ● |
| Formal dispute process | ? | ● | ? | ○ | ○ | ? | ○ | ○ | ◐ |
| Two-sided ratings | ○ | ◐ | ◐ | ○ | ○ | ◐ | ○ | ○ | ◐ |
| Audience authenticity analysis | ● | ○ | ◐ | ◐ | ● | ◐ | ● | ● | ○ |
| ROI / conversion attribution | ◐ | ○ | ◐ | ● | ● | ● | ● | ○ | ○ |
| Agency / multi-client accounts | ● | ○ | ● | ● | ● | ● | ● | ● | ◐ |
| Recurring / retainer campaigns | ○ | ○ | ◐ | ● | ● | ● | ● | n/a | ◐ |
| Free for creators | ● | ○ (15%) | ● | ● | ● | ● | ● | n/a | ● |
| **Take rate on GMV** | 0% | ~10% + 15% | 7–20% + SaaS | 0% | 0% | ◐ | 0% | 0% | margin |

### The three empty columns

Read the matrix vertically. Three rows are **○ across essentially every player**:

1. **Location visits as a bookable, geo-matched primitive**
2. **Event coverage as a structured multi-deliverable product**
3. **Hybrid guaranteed-fee + performance compensation**

**[REC]** These are not accidental gaps — they are *unattractive* to US-centric platforms because US creator marketing is remote-first and asynchronous. In Kenya they are the opposite: **physical, local, and high-intent.** Restaurants, salons, gyms, dealerships and launches are exactly the SME buyers who have money and no marketing team.

**This is your wedge, and it is defensible precisely because the incumbents' customers do not want it.**

---

## What makes each hard to copy

| Platform | Real moat | Copyable? |
|---|---|---|
| TikTok TCM | First-party audience truth + ad-platform integration | **No** — but irrelevant below 10k followers |
| Collabstr | Listing density and SEO capture of long-tail search | Partly — beatable locally |
| Insense | Meta/TikTok ad-account plumbing + partner status | Hard, high value |
| GRIN | Deep e-commerce integrations + switching cost of a CRM | Hard, wrong customer for Kenya |
| CreatorIQ | Enterprise trust, procurement, data governance | Hard, wrong customer |
| Modash | Index scale and crawl infrastructure | Expensive, low defensibility |
| Billo | Operational reliability of a managed creator bench | **Genuinely hard** — this is an ops moat |

**[REC]** Note where the durable moats actually are: **ops reliability (Billo)** and **payment/ad-platform plumbing (Insense)**. Neither is a feature. Both are earned. Plan accordingly — your moat will be operational and financial, not functional.

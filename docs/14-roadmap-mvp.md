# Parts 42, 43, 49 — MVP, Roadmap, Launch Campaigns

## Part 42 — The MVP

### The seven things it must prove

| # | Hypothesis | Kill signal |
|---|---|---|
| 1 | Brands will hire creators through a platform | <30 funded campaigns in 90 days |
| 2 | Creators will find and complete paid work | <40% of onboarded creators earn in 60 days |
| 3 | Brands trust escrow enough to prepay | >50% of interested brands refuse to prefund |
| 4 | Creators trust the payout | Creators demand payment before delivery |
| 5 | Campaigns complete end-to-end | Completion rate <70% |
| 6 | We can generate GMV | <KSh 2M cumulative in 90 days |
| 7 | **Brands come back** | **<25% rebook within 60 days** |

**[REC] Hypothesis 7 is the only one that decides whether this is a company.** The first six are table stakes; any competent team can produce them with enough hustle. Repeat purchase is the one that cannot be faked, and it should be the headline of every investor update.

### MVP feature set — build exactly this

**Creator (mobile web, ~6 min onboarding):**
Phone OTP · profile (name, photo, ward, creator types, niches, bio, languages) · **portfolio upload (3–20 assets)** · **services with prices** (the storefront) · availability toggle · browse and filter campaigns · apply with a pitch · in-app messaging · deliverable upload · proof-of-post submission · **earnings dashboard** · M-Pesa payout details.

**Brand (responsive web):**
Signup with business verification · **campaign wizard for four types** (visit, UGC, seeding, influencer post) · browse and filter creators · **book directly from a storefront** · review applications with match ranking · accept and fund via STK Push · messaging · review deliverables, approve or request one revision · release payment · rate the creator · basic campaign summary.

**Platform:**
Escrow (fund → hold → release) · M-Pesa STK collection and B2C payout · **all workflow timers, especially 5-day auto-approve** · two-sided reviews (double-blind) · reputation components · WhatsApp notification templates · **admin/ops console** · double-entry ledger · dispute intake (human-resolved).

**Four campaign types only:** Location Visit · Paid UGC · Product Seeding · Influencer Post.

### What we deliberately do NOT build

| Not building | Why |
|---|---|
| **AI matching** | With <1,000 creators, filters plus a hand-tuned score beat a model, and you have no outcome data to train on |
| **AI campaign builder** | Needs real pricing data. Build it in V2 on real transactions. |
| Affiliate / performance tracking | Requires attribution infrastructure; creators distrust unverifiable conversion counts |
| Hybrid compensation | Depends on performance tracking |
| Standalone content licensing | Rights are bundled into UGC orders at V1; a rights marketplace comes later |
| Event coverage | Complex multi-deliverable; wait for operational maturity |
| Milestones / split payments | Single release covers most orders under KSh 50,000 |
| Native mobile apps | **[REC] Mobile web only.** App store friction kills a low-trust funnel. PWA if needed. |
| Agency accounts | Serve agencies manually at first |
| Subscriptions | Nothing to subscribe to yet |
| Creator tiers / gamification | Meaningless without volume |
| Advanced analytics / ROAS | Simple counts suffice |
| Logistics integration | Brands ship; you track state |
| Instagram/YouTube API integration | **[FACT]** App review is slow; manual verification is adequate at V1 |
| Automated fraud detection | Manual review at this volume |
| Multi-currency | KES only |
| Public API | No demand |

**[REC] The discipline here is the point.** Every item above is a real feature that a competitor has, and every one of them is a way to spend three months not learning whether brands rebook.

### Manual processes behind the scenes (deliberately)

**[REC] The MVP is a manually-operated marketplace wearing a product.** Do this openly and do not apologise for it.

| Function | Manual method | Automate at |
|---|---|---|
| Creator verification | Ops watches content, checks socials, approves | 500 creators |
| Campaign moderation | Human review of every campaign | 100 campaigns/mo |
| Creator shortlisting | Founder picks 10 by hand per brief | 300 campaigns/mo |
| Brief writing | Ops writes with the brand on a call | V2 (AI) |
| Quality control | Ops reviews every deliverable before the brand sees it | 500 collabs/mo |
| Proof verification | Ops opens the URL and checks | TikTok API in V2 |
| Disputes | Founder decides | Never fully |
| Payouts | **Automated from day one — never manual** | — |
| Customer support | Founders on WhatsApp | 1,000 collabs/mo |

**[REC] Payouts are the single exception to "do things manually."** Manual payouts introduce delay, error and favouritism into the exact process your entire trust proposition rests on. Automate payment on day one even if everything else is a spreadsheet.

### First 30 days

| Week | Focus | Target |
|---|---|---|
| 1 | Incorporate; **start M-Pesa go-live paperwork**; engage counsel; recruit 20 creators by hand | 20 creators |
| 2 | 20 more creators; build their storefronts with them; pitch 15 SME brands | 40 creators, 5 brands |
| 3 | **Run 5 campaigns manually** — WhatsApp + spreadsheet, no product | 5 completed |
| 4 | 10 more campaigns; capture every price, objection and failure | 15 completed, KSh 150k GMV |

**[REC] Ship no software in month one.** Everything above runs on WhatsApp, a spreadsheet, and a Safaricom line. You are buying the specification.

### First 90 days

| Month | Focus | Targets |
|---|---|---|
| 1 | Manual V0 | 40 creators · 15 collabs · KSh 150k GMV |
| 2 | V1 build + keep selling manually | 100 creators · 50 collabs · KSh 500k GMV |
| 3 | V1 launch to existing users; Deal Desk live | 250 creators · 150 collabs · KSh 1.5M GMV |

**Cumulative 90-day target: ~215 collaborations, ~KSh 2.15M GMV, ~KSh 320k revenue.**

**[REC] Judge the quarter on three numbers only:** completion rate (>80%), brand repeat rate (>25%), median time to payout (<2 hours). Everything else is noise at this stage.

---

## Part 43 — Version roadmap

### V0 — Manual marketplace · Months 1–3

**Features:** none. WhatsApp, a spreadsheet, a phone.
**Team:** 2 founders + 1 ops.
**Complexity:** ★☆☆☆☆
**Main KPI:** completed collaborations (target 50 cumulative).
**Main risk:** discovering brands will not prepay. **[REC] Test this in week two, before writing any code** — it invalidates the model if false.
**Gate to V1:** 50 completed collaborations, >70% completion, ≥10 brands who would rebook.

### V1 — MVP · Months 3–6

**Features:** the MVP set above. Four campaign types, storefronts, escrow, M-Pesa, reviews, ops console, Deal Desk.
**Team:** 2 founders + 3 engineers + 1 designer + 2 ops = 8.
**Complexity:** ★★★☆☆
**Main KPI:** monthly completed collaborations (300 by month 6).
**Main risk:** M-Pesa go-live delay. **[FACT]** 6–8 weeks is typical — start in week one.
**Gate to V2:** 300 collabs/month · >35% brand repeat · <5% dispute rate · payout median <2h.

### V2 — Automated marketplace · Months 6–14

**Features:** all ten campaign types · milestones and split payments · TikTok/Instagram OAuth and automated proof · rights module with the pricing slider · LLM brief parsing · affiliate promo codes · agency accounts · brand subscriptions · advanced discovery · creator tiers · analytics with attribution · Mombasa launch.
**Team:** 20–25 (8 eng, 2 design, 2 product, 6 ops, 3 sales, 2 finance/compliance).
**Complexity:** ★★★★☆
**Main KPI:** GMV, with AOV as the primary guardrail (target KSh 27M/month, KSh 18k AOV).
**Main risk:** **disintermediation as relationships mature.** Watch repeat rate and the ratio of second collaborations between the same pair.
**Gate to V3:** KSh 25M GMV/month · >45% repeat GMV · positive contribution margin per collaboration.

### V3 — AI marketplace · Months 14–24

**Features:** learned ranking on outcome data · portfolio optimisation · full AI campaign builder · predicted performance · Spark Ads and Meta Partnership Ads plumbing · TikTok Shop attribution · logistics integration · **export corridor (global brands buying African creators)** · multi-currency and cards · **earnings advances (the underwriting thesis begins)**.
**Team:** 45–60.
**Complexity:** ★★★★★
**Main KPI:** GMV and net revenue; **repeat GMV % as the health metric**.
**Main risk:** **that the Kenyan market caps out before the economics work.** Export and regional are the answers and must be tested by month 18, not assumed.
**Gate to V4:** KSh 100M GMV/month · proven export demand · unit economics positive.

### V4 — East Africa · Months 24–36

**Features:** Uganda, Tanzania, Rwanda · MTN MoMo and Airtel Money · multi-language · per-country compliance and entities · cross-border campaigns.
**Team:** 80–120.
**Complexity:** ★★★★★
**Main KPI:** GMV per market; time-to-liquidity in each new market.
**Main risk:** **premature expansion.** **[REC] The rule: do not enter a market until Kenya alone is contribution-positive.** Every marketplace that expanded to escape weak home economics has failed to escape them.
**Gate to V5:** two markets at KSh 30M+/month each.

### V5 — Africa · Months 36+

**Features:** Nigeria, Ghana, South Africa, Egypt · pan-African brand accounts · full financial services (advances, credit, insurance) · creator services marketplace.
**Team:** 200+.
**Complexity:** ★★★★★
**Main KPI:** net revenue and contribution margin.
**Main risk:** **Nigeria is a different market, not a bigger Kenya** — different payment rails, different creator culture, larger and better-funded local competitors. **[REC]** Treat each as a new company, not a rollout.

---

## Part 49 — The first ten campaign templates

**[ASSUMPTION]** All prices are my recommendations for launch, calibrated against **[FACT]** reported Kenyan rates (micro-influencers KSh 10,000–50,000/post; top-tier KSh 100,000+/video). **Validate every one in week one with real creators — do not treat these as market data.**

---

**1 · Restaurant Visit** — *the flagship launch template*
> "Visit our new Westlands restaurant this weekend, enjoy a meal on us, and create 1 TikTok + 3 Instagram Stories."

Creators: 10–15 food/lifestyle, Nairobi (Westlands/Kilimani/Parklands), nano–micro, 5,000+ TikTok followers, must post within 48h of visit.
Deliverables: 1 TikTok (30–60s) · 3 IG Stories with location tag and @mention · 1 Google review (optional, +KSh 500).
Price: **KSh 5,000–8,000/creator** + KSh 2,500 consumption allowance. Campaign total ≈ **KSh 112,500** for 12 creators (incl. 15% fee).
Timeline: 7 days. Payment: 100% escrow; travel stipend at check-in; balance on approval.
Approval: brand reviews within 48h; auto-approve at 5 days.
Metrics: views, reach, saves, location tags, **walk-ins mentioning the campaign**.

**2 · Product Seeding**
> "We're sending our new KSh 1,800 skincare serum to 30 creators. Free product + KSh 1,000. One honest review post required."

Creators: 30 beauty/skincare, women 20–35, Nairobi delivery, Kenyan audience >60%.
Deliverables: 1 TikTok or Reel · 2 Stories · honest review encouraged.
Price: product (KSh 1,800) + **KSh 1,000 cash**. Total ≈ **KSh 34,500** + product cost.
Timeline: 5 days dispatch, 10 days to content **from delivery**. Payment: cash escrowed at launch, released on approval.
Metrics: content pieces, aggregate reach, sentiment, cost per piece.

**3 · UGC Video Pack** — *the highest-margin, most repeatable template*
> "5 authentic TikTok-style videos of our product. We'll run them as ads. You don't need to post."

Creators: 5 UGC creators — **portfolio-ranked, follower count irrelevant**. Good lighting, clear audio, English/Swahili.
Deliverables: 5 × 30s vertical videos, 3 hook variants on 2 of them, raw files included.
Price: **KSh 4,000/video** + KSh 2,000 for 90-day paid-ads rights = **KSh 22,000** + 15% = **KSh 25,300**.
Timeline: 7 days. Payment: 30% on acceptance, 70% on approval. Revisions: 1 included.
Metrics: cost per asset, ad CTR/CPA when run, winning hook.

**4 · TikTok Paid Post**
> "One TikTok featuring our app, in your own style. Must include our download link in bio for 7 days."

Creators: 5 micro (10k–50k), Kenya-majority audience, ER >4%.
Deliverables: 1 TikTok (min 20s) · link in bio 7 days · **#Ad disclosure (system-inserted)** · live minimum 30 days.
Price: **KSh 8,000–15,000/creator**. Total ≈ **KSh 66,700** for 5 (incl. fee).
Payment: 100% on proof verification. Metrics: views, ER, link clicks, installs.

**5 · Beauty Product Review**
> "Try our product for 7 days and share your honest before/after."

Creators: 8 beauty creators with genuine skincare content history.
Deliverables: 1 detailed review video (60–90s) with before/after · 3 Stories across the week.
Price: product + **KSh 6,000/creator** ≈ **KSh 55,200** total.
Timeline: 14 days (7 trial + 7 content). **[REC] Do not require positive sentiment — require honesty.** It is more credible, and mandating praise is likely a disclosure and consumer-protection problem.

**6 · Hotel Stay**
> "One-night stay for two at our Diani resort. 1 recap TikTok + 5 Stories + 10 photos."

Creators: 3 travel/lifestyle, 20k+ followers, willing to travel.
Deliverables: 1 recap video (60s+) · 5 Stories · 10 edited photos with 12-month brand usage rights.
Price: stay (brand cost) + **KSh 15,000–25,000/creator** + transport. Total ≈ **KSh 86,250** for 3.
Payment: 30% pre-travel, 70% on approval. **[REC]** Advance the transport component — creators should never fund travel out of pocket.

**7 · Event Coverage**
> "Cover our product launch on Saturday, 6–10pm. Live Stories + recap + raw photos."

Creators: 3 event/lifestyle + 1 photographer.
Deliverables: 8 live Stories during the event · 1 recap TikTok within 48h · 30 raw photos (photographer) · 1 IG post.
Price: **KSh 12,000–20,000/creator**; photographer **KSh 25,000**. Total ≈ **KSh 74,750**.
Payment: 50% pre-event, 50% on delivery. Metrics: live reach, recap views, asset count.

**8 · Affiliate Campaign** — *V2, not launch*
> "Promote our online store. KSh 300 per sale with your unique code. KSh 3,000 guaranteed."

Creators: 20 with buying-intent audiences.
Structure: **KSh 3,000 guarantee** + KSh 300/sale, capped at KSh 15,000. Guarantee escrowed; commission settled monthly.
**[REC] The guarantee is mandatory.** A commission-only listing in Kenya will not fill, and should not.
Metrics: code redemptions, revenue, cost per acquisition, earnings per creator.

**9 · Product Photography**
> "20 lifestyle photos of our furniture in a real home setting."

Creators: 2 photographers (portfolio-ranked; audience irrelevant).
Deliverables: 20 edited high-res photos · 5 flat-lays · perpetual brand usage rights.
Price: **KSh 12,000–18,000/creator** ≈ **KSh 34,500** total.
Timeline: 10 days. Revisions: 1 round of re-edits. Metrics: cost per asset vs studio quote (typically 3–5x cheaper — a strong sales argument).

**10 · App Promotion**
> "Show how you use our app in daily life. 1 TikTok + 3 UGC videos we can run as ads."

Creators: 6 tech/lifestyle/student creators.
Deliverables: 1 organic TikTok posted by creator · 3 UGC videos for brand ads · 90-day paid-ads rights.
Price: **KSh 10,000/creator** (KSh 5,000 post + KSh 5,000 UGC pack) ≈ **KSh 69,000**.
Payment: 30/70. Metrics: views, installs, cost per install, best-performing creative.

---

### Why these ten

**[REC]** They are chosen to cover the four MVP campaign types, to span **KSh 25,000–115,000** in campaign value (proving AOV can exceed the KSh 10,000-order trap), to be sellable to the launch verticals in `12-gtm-liquidity-growth.md`, and — critically — **to be deliverable by hand in month one with no software at all.**

**[REC] Template 3 (UGC Video Pack) is the one to lean on hardest.** It is the most repeatable, the highest-margin, the most exportable, the least dependent on creator audience, and the only one on this list that a brand will buy again every single month.

# Parts 7–9, 14–15, 17–19, 21, 25, 32, 39–40 — Product Specification

## Part 7 — The creator profile

You described a blend of LinkedIn + TikTok + Upwork + Airbnb. **[REC] The weights should be: 60% Upwork (commercial credibility), 25% Airbnb (trust signals), 15% TikTok (work samples). Almost 0% LinkedIn** — CV-style profiles perform badly for creative hiring, because buyers judge from work, not from claims.

### The mobile profile, in priority order

```
┌─────────────────────────────────────────┐
│  [Photo]  Amina Wanjiru        ✅ Verified│
│           Food & Lifestyle · Westlands   │
│           ⭐ 4.8 (34 jobs) · 96% on-time  │
│           Replies in ~2h · Available now │
├─────────────────────────────────────────┤
│  ▶ PORTFOLIO — 6 autoplaying clips       │   ← the profile IS the portfolio
├─────────────────────────────────────────┤
│  SERVICES                                │
│  TikTok video (UGC)      from KSh 4,000 │
│  Restaurant visit + post from KSh 7,500 │
│  3-video UGC package        KSh 10,000  │   [Book now]
├─────────────────────────────────────────┤
│  TRACK RECORD                            │
│  34 jobs · 96% on-time · 88% first-pass │
│  11 repeat brands · 0 disputes           │
├─────────────────────────────────────────┤
│  AUDIENCE (verified)                     │
│  TikTok 24,300 · avg 41,200 views       │
│  IG 8,100 · 72% Kenya · 68% female 18-34│
├─────────────────────────────────────────┤
│  WORKED WITH  [logos]  ·  REVIEWS        │
└─────────────────────────────────────────┘
```

**[REC] Six design decisions, each of which is contested:**

1. **Portfolio above audience.** Always. This one ordering choice encodes the entire "creators, not influencers" thesis. If audience sits above portfolio, you have built an influencer platform regardless of what your marketing says.
2. **Follower count is never the headline.** It appears inside the audience block, below views. **For UGC-only creators it is hidden entirely** — not de-emphasised, absent.
3. **Price is visible and bookable without conversation.** This is the Collabstr mechanic and it is the highest-leverage liquidity feature available.
4. **Response time and availability are prominent.** Airbnb's insight: in a marketplace, *responsiveness* predicts a good experience better than *quality claims*.
5. **Verified audience data must be badged and distinguished from self-reported.** Self-reported numbers are marked as such. **[FACT]** Because Instagram's Graph API only returns audience demographics for the authenticated account owner and TikTok returns no audience demographic breakdown at all, verified data is only obtainable through creator OAuth — so the badge is both honest and an incentive to connect.
6. **Show "0 disputes" as a positive.** Absence of trouble is a trust signal and costs nothing to display.

**Full field inventory:** identity (name, photo, location to ward, languages, gender/age where declared, verification badges); commercial (categories, creator types, services, packages, rate card, minimum booking, turnaround, revision policy, rights defaults, availability); portfolio (up to 20 assets, tagged by type, with declared provenance, plus case studies with results); audience (per connected platform: followers, avg views, engagement rate, audience geography/age/gender where API permits, growth curve, authenticity score); reputation (jobs, on-time %, completion %, first-pass approval %, avg rating, repeat brands, response time, dispute count, tier); brand fit (industries worked, past collaborations, category exclusions, content boundaries).

**[REC] `content_boundaries` is not optional.** Creators must be able to declare what they will not promote — alcohol, betting, political content, specific categories. Kenya's betting-advertising environment makes this a real welfare and reputational issue, and letting a creator state it in advance prevents both awkward rejections and reputational harm.

---

## Part 8 — Creator types

**[REC] Your list of 25 conflates three orthogonal dimensions.** Modelling them as one flat list will make filtering incoherent. Split them:

```
CREATOR_TYPE     what they do          (the skill)
NICHE            what they cover       (the subject)
AUDIENCE_TIER    how many follow them  (the reach)
```

**Creator types (the skill) — 16:**
`influencer` · `ugc_creator` · `videographer` · `photographer` · `actor_talent` · `model` · `voiceover_artist` · `comedian_skit` · `podcaster` · `writer_blogger` · `animator_motion` · `designer` · `editor` · `livestreamer` · `event_host_mc` · `translator_localiser`

**Niches (the subject) — 24:**
`food_beverage` · `beauty_skincare` · `fashion` · `fitness_wellness` · `travel_tourism` · `tech_gadgets` · `finance_fintech` · `parenting_family` · `education_student` · `automotive` · `real_estate` · `home_interior` · `health_medical` · `agriculture` · `music_entertainment` · `sports` · `gaming` · `comedy` · `faith` · `business_entrepreneurship` · `pets` · `events_weddings` · `sustainability` · `news_commentary`

**[REC] Additions worth noting for Kenya specifically:** `agriculture` (agritech and agri-input brands are real advertisers and creators covering farming have highly engaged, commercially valuable audiences), `faith` (large audiences, significant brand caution needed), `translator_localiser` (Swahili/Sheng/vernacular localisation is a genuine paid service and a category no global platform offers), and `event_host_mc` (a live-talent category the incumbents entirely ignore).

**Why the separation matters:** a brand searching for "a videographer who covers food in Westlands" is filtering on all three axes independently. A flat 25-item list cannot express that query.

---

## Part 19 — Tiers

**[REC] Keep audience tiers for reach estimation and pricing guidance. Do not use them for ranking. And run two parallel supply pools.**

| Tier | Range | Use |
|---|---|---|
| Nano | 1K–10K | Highest engagement, cheapest, best for volume campaigns |
| Micro | 10K–50K | The workhorse of the Kenyan market |
| Mid | 50K–250K | |
| Macro | 250K–1M | |
| Mega | 1M+ | Rare in Kenya; usually agency-represented |
| **UGC Creator** | **N/A** | **Judged on portfolio and reliability only** |

**Advantages of tiers:** brands understand them; they make budget estimation tractable; they support campaign-mix recommendations ("5 nano + 7 micro + 3 mid"); they let you price-band the catalogue.

**Disadvantages:** they entrench follower count as the organising idea; they push brands toward reach when engagement or craft matters more; they create a status hierarchy that demoralises the nano creators who are the bulk of your supply and often your best performers.

**[REC] The resolution: tiers are a *filter and pricing aid*, never a *sort order*.** Default sort is always the match score. Tier appears as a small label, not a rank. And **the UGC pool is a separate browsing experience entirely** — different card layout (portfolio-first, no follower count), different ranking (quality + reliability + price), different filters (content type, turnaround, language). Two audiences, two products, one platform.

---

## Part 17 — Creator storefront

**[FACT]** This is Collabstr's core liquidity mechanic. **[REC] It is the single highest-leverage feature you can ship, because it makes the marketplace transactable without a single campaign being posted.**

Every creator gets `flerwa.co.ke/@aminaw` — a public, shareable, indexable storefront:

```
Amina Wanjiru · Food & Lifestyle Creator · Westlands
⭐ 4.8 (34) · 96% on-time · Responds ~2h

TikTok video (UGC)              KSh 4,000   2 days   [Book]
Restaurant visit + 1 TikTok     KSh 7,500   3 days   [Book]
3-video UGC package            KSh 10,000   5 days   [Book]
Product photography (10)        KSh 6,000   3 days   [Book]

Add-ons: Rush 24h +KSh 1,500 · Extra hook +KSh 800
         90-day ad rights +KSh 2,000
```

**[REC] Why this matters more than it appears:**

- **It inverts the cold-start problem.** A creator with a storefront markets *your platform* every time they share their link — in bios, WhatsApp statuses, DMs. Supply becomes a distribution channel. This is the cheapest demand acquisition available to you.
- **It captures the "brand already knows the creator" case**, which is the majority of Kenyan transactions. The brand does not need discovery; they need a safe way to pay. The storefront is that.
- **It is SEO surface.** Thousands of indexed creator pages capture "hire food creator Nairobi" long-tail search, which is exactly how **[FACT]** Collabstr built liquidity without a sales team.
- **Add-ons are the AOV lever.** Rush, extra hooks, rights upgrades routinely add 30–50% to order value — and per `04-economics-and-pricing.md`, AOV is the number that decides whether the business works.

**[REC] Seed the first 20 storefronts by hand, in a room, with the creators.** An empty storefront is worse than no storefront, and creators left alone will price badly and describe their services vaguely.

---

## Part 18 — Availability

**[REC] Keep it simple. Elaborate calendars go stale within a week and stale availability is worse than no availability.**

```
Status:  🟢 Available  |  🟡 Busy (until date)  |  🔴 Not accepting
Open to: ☑ Paid work  ☑ Gifted products  ☑ Location visits
         ☑ Urgent (<48h)  ☐ Unpaid/exposure
Capacity: max 3 concurrent orders
Blackout dates: [calendar]
```

**[REC] Auto-decay availability.** If a creator has not opened the app in 10 days, flip them to "Unconfirmed" and stop surfacing them in urgent matching. A stale "Available" that produces no response is the single most damaging experience for a brand's first booking.

**Should brands book specific dates?** **[REC] Yes — but only for location visits and events, where a datetime is intrinsic to the product.** For UGC and posts, sell *turnaround* (delivered within 3 days), not a calendar slot. Calendar booking for asynchronous work adds friction with no benefit.

---

## Part 9 — The brand experience

**[REC] The onboarding question set you proposed is too long.** A Kenyan SME owner will abandon it. Ask three questions, infer the rest, and collect the remainder inside the campaign flow where each field has obvious purpose.

```
1. What do you want to achieve?        [visual grid, 12 options]
2. Where are your customers?           [Nairobi / ward / national]
3. What's your budget?                 [KSh 5k / 15k / 50k / 150k+ / not sure]
        ↓
   Three recommended campaigns, priced, with expected outputs
```

**Objective → campaign type mapping** (this is the core of the recommendation engine):

| Objective | Campaign type | Creator profile | Typical structure |
|---|---|---|---|
| Awareness | Influencer posts | Micro/mid, niche-matched | 5–15 creators, 1 post each |
| **Content production** | **Paid UGC** | **UGC creators, portfolio-ranked** | **3–10 videos, rights included** |
| Sales | Affiliate + hybrid | Converting creators, promo codes | Guarantee + commission |
| App installs | UGC + paid amplification | Performance-style creators | Videos + Spark Ads rights |
| **Foot traffic** | **Location visits** | **Local creators, geo-matched** | **10–20 visits over a weekend** |
| Event attendance | Influencer + visits | Local, event-adjacent | Pre-event push + coverage |
| Product launch | Seeding + influencer | Category creators, mixed tiers | Seed 30, post 15 |
| Reviews | Seeding | Reviewers, honest-review positioning | Product + small fee |
| UGC library | UGC bulk | UGC creators | 20 videos, perpetual rights |
| Social proof | Seeding + UGC | Nano at volume | Many small |
| Lead generation | Affiliate (per lead) | Educational/explainer creators | Per qualified lead + guarantee |
| Foot traffic (retail) | Visits + affiliate | Local + promo codes | Visit + trackable code |

**[REC] Note that "content production" and "foot traffic" are bolded because they are the two objectives no incumbent serves well and the two most common real needs of a Kenyan SME.** Lead with them in the UI grid.

**Brand navigation:** `Home (campaigns) · Discover creators · Orders · Messages · Wallet · Insights`

---

## Parts 14 & 15 — Discovery

### Creator-side discovery (Part 14)

**[REC] Five surfaces, in order of expected value:**

1. **"For You" feed** — ranked by fit × payout × win probability. **[REC] Never show a creator opportunities they will not win.** Showing a nano creator a campaign requiring 100k followers is the fastest way to churn them. Filter on eligibility *before* ranking.
2. **"Near you"** — geo-ranked visits and events. The highest-conversion surface in Kenya because travel cost is real and proximity is decisive.
3. **Browse all** — filters: campaign type, category, compensation band (Free product / KSh 1k+ / 5k+ / 10k+ / 25k+), platform, location, deadline, tier eligibility.
4. **Invitations** — direct brand invites. Highest conversion of all; make the notification unmissable (WhatsApp).
5. **Instant book** — orders arriving through the storefront with no application needed.

**[REC] The critical UX rule: show expected payout in the card title, in shillings, always.** `"KSh 7,500 · Restaurant visit · Westlands · 3 slots left"`. Not "Exciting collaboration opportunity." Creators optimise for money and time; respect that.

### Brand-side discovery (Part 15)

**[REC] The default sort must never be follower count.** That single default determines whether you built an influencer platform or a creator platform.

```
DefaultRank = 0.30·CategoryMatch
            + 0.25·Reliability
            + 0.20·QualityScore
            + 0.15·PriceFit
            + 0.10·GeoProximity
```

Available filters: location (ward-level), niche, creator type, platform, follower range *(collapsed by default)*, avg views, engagement rate, audience geography/age/gender (where verified), price range, turnaround, availability, language, rating, on-time %, verification level, past brand categories, content boundaries.

**[REC] Three deliberate choices:**
- **Follower range is collapsed under "Advanced".** Available, not default.
- **Sort options offered:** Best match (default) · Most reliable · Highest rated · Lowest price · Fastest delivery · Most views. **Never a raw "most followers".**
- **Never return zero results.** If filters are too narrow, widen automatically and say so: *"No exact matches in Kilimani — showing 12 creators in nearby Nairobi areas."* An empty result set is where marketplaces lose brands permanently.

---

## Part 21 — Messaging

**[REC] Yes, allow direct messaging. Restricting it drives users to WhatsApp faster than any circumvention risk you are avoiding.**

Design: campaign-scoped threads (never a general inbox), file and voice-note support (**[REC]** voice notes are essential — they are how Kenyan business communication actually works), brief pinned to the thread top, templated quick replies, automated milestone and deadline reminders, and full message retention as dispute evidence.

**Anti-circumvention — calibrated, not aggressive:**

| Control | Recommendation |
|---|---|
| Contact detail masking | **[REC] Only before a contract is funded.** After funding, they need to coordinate — a creator must be able to phone a venue. |
| Phone/email detection | Detect and log pre-funding; soft warning, not a block |
| Hard blocking of contact info | **[REC] No.** It infuriates legitimate users and is trivially bypassed ("zero seven two zero…") |
| Pattern detection | Yes — flag repeated exchanges that die immediately after first contact |
| Terms enforcement | Yes, in terms; enforce only on egregious, repeated, evidenced cases |

**[REC] Say this plainly to the team: the answer to circumvention is the Deal Desk and descending repeat fees, not message policing.** Every hour spent building surveillance is an hour not spent making the platform worth staying on. See `06-trust-reputation-fraud.md`.

---

## Part 25 — Creator levels: useful or gimmicky?

**[REC] Both. It is gimmicky if the rewards are cosmetic; genuinely useful if the rewards are economic.**

Badges alone are gimmicky — Kenyan creators are not motivated by a bronze icon. But **tiers that gate real economic benefits are a legitimate quality-control and retention mechanism**, because they align creator incentives with marketplace health.

| Tier | Requirements | **Economic** benefits |
|---|---|---|
| **New** | Verified | Standard visibility |
| **Bronze** | 3 jobs, 4.0+, 80% on-time | Apply to 10 concurrent campaigns |
| **Silver** | 10 jobs, 4.3+, 90% on-time | 20 applications · 24h early access · same-day payout |
| **Gold** | 25 jobs, 4.5+, 95% on-time, 2+ repeat brands | Unlimited applications · 48h early access · **instant payout** · priority in matching |
| **Elite** | 50 jobs, 4.7+, 97% on-time, 5+ repeat brands, 0 disputes | All the above · **access to premium/enterprise campaigns** · profile featuring · **earnings advances** |

**[REC] Design rules:**
- **Tiers must be losable.** A rolling 180-day window, not lifetime accumulation. Otherwise the tier stops predicting current behaviour.
- **The most valuable rewards are payout speed and campaign access**, not badges. Both are cheap for you and highly valued.
- **Never discount your take rate by tier at launch.** You need the revenue, and fee discounting is hard to reverse. Revisit at scale.
- **Elite unlocks earnings advances** — this is the hook into the underwriting thesis in `00-executive-summary.md`. Tier progression becomes a credit-scoring proxy built on settled transaction history.

---

## Part 32 — Agencies: help or hurt?

**[REC] They help, substantially, and you should court them — with structural guardrails.**

**Why they help:** agencies bring existing brand relationships and budgets (solving demand cold-start), high AOV (a single agency may spend more than 50 SMEs), professional briefs and fast approvals, low CAC, and repeat volume. **[ASSUMPTION]** Agencies are likely to be your largest GMV source in year one, well ahead of direct SME demand.

**Why they can hurt:** they insert themselves between you and the brand relationship; they may pressure creator rates downward; they can become a concentration risk; and if they mark up opaquely they reproduce the exact problem creators resent.

**[REC] The guardrails, all of which are non-negotiable:**
1. **The creator's rate is the creator's rate.** Agency markup sits on top, visible to the brand's own client if the brand wishes. Agencies never take from the creator's side of the ledger.
2. **Creators always see the end brand.** No blind campaigns — a creator must know whose product they are endorsing, both for reputational and for disclosure-compliance reasons.
3. **Reviews attach to the agency and the end brand separately.**
4. **Concentration cap as a management metric:** if any single agency exceeds ~20% of GMV, treat it as a risk to be actively diversified.

**Agency account features (V2):** multi-brand workspaces, team seats with roles, consolidated invoicing, saved creator pools, campaign templates, white-labelled client reporting, bulk hiring, approval workflows.

---

## Part 39 — Navigation

**Creator (mobile-first, five tabs):** `Home (opportunities) · Explore · Orders · Messages · Earnings`
Onboarding: phone OTP → name + photo + location → **pick your creator types** → connect socials (skippable, with a visible ranking incentive) → upload 3 portfolio items → set 1 service and price → done. **[REC] Target under 6 minutes to a complete profile, and let them browse before completing it.**

**Brand (responsive web + mobile):** `Home (campaigns) · Discover · Orders · Messages · Wallet · Insights`
Onboarding: business email/phone → brand name + industry + location → objective → budget → **see recommended campaigns immediately**. **[REC] Show real creators before asking for payment details, always.** Value before commitment is the rule in a low-trust market.

---

## Part 40 — Positioning: 20 concepts

Grouped by the strategic claim each makes.

**Hiring / labour framing**
1. *Hire creators. Not influencers.*
2. *Kenya's marketplace for creative work.*
3. *The creator workforce, on demand.*
4. *Book a creator like you book a ride.*
5. *Where brands and creators do business.*

**Trust / payment framing**
6. *Paid on delivery. Every time.*
7. *Escrow for the creator economy.*
8. *The only place creators always get paid.*
9. *Money in escrow. Content in hand. M-Pesa in minutes.*
10. *Trust, built into every collaboration.*

**Speed / simplicity framing**
11. *From brief to content in 72 hours.*
12. *Your marketing team is 5,000 creators.*
13. *Describe what you need. We'll bring the creators.*
14. *Marketing content without a marketing team.*

**Breadth framing**
15. *Any brand. Any creator. Any collaboration.*
16. *From product seeding to paid UGC to influencer campaigns.*
17. *Every way a brand can work with a creator.*
18. *The operating system for creator-brand partnerships.*

**Africa framing**
19. *The commercial marketplace for African creators.*
20. *Africa's creators, open for business.*

### Evaluation of the ones you proposed

| Concept | Verdict |
|---|---|
| "Hire creators, not influencers" | **Strong.** Sharp, contrarian, encodes the strategy. Weakness: negative framing, and "influencer" still carries aspirational value for creators. **Better as an internal north star than a homepage headline.** |
| "Any brand. Any creator. Any collaboration." | Elegant but says nothing concrete. Vagueness is the enemy in a low-trust market. |
| "The commercial marketplace for African creators." | Accurate; investor-legible; emotionally flat; premature (you are Kenyan, not African, for two years). |
| "From product seeding to paid UGC to influencer campaigns." | Good **subhead**, poor headline — a list is not a promise. |
| "Upwork for creators." | Useful shorthand for investors, meaningless to a Nairobi restaurant owner. |
| "The operating system for creator-brand partnerships." | Investor-speak. Avoid. |

### The recommendation

**[REC] Primary:**

> # Marketing content without a marketing team.
> **Hire Kenya's creators for UGC, TikToks, store visits and campaigns. Money held safely. Creators paid by M-Pesa within the hour.**

Why this one: it names the **customer's actual problem** rather than your category (an SME owner does not wake up wanting "creator collaborations" — they wake up needing content and customers); the subhead carries breadth, trust and payment speed in one line; it is untethered to the influencer frame without arguing against it; and it works in translation.

**[REC] Per-audience variants** (same product, different door):
- **Creators:** *"Get hired. Get paid. Same day."*
- **Agencies:** *"Source, brief, pay and report on 50 creators from one dashboard."*
- **Investors:** *"The commercial infrastructure for Africa's creator economy."*

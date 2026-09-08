# Part 2 — Africa and Kenya

## Ground truth on the market

**[FACT]** Kenya's digital population, most recent available figures:
- **23.4 million** internet users at end-2025 (40.5% penetration)
- **18.4 million** social media user identities in October 2025 (31.8% of population)
- **23.1 million** Facebook users (May 2026, 37.5% of population)
- **5.1 million** Instagram users (May 2026, 8.3% of population)
- TikTok: reported **76.9% monthly use** among surveyed users and adult advertising reach of **18.4 million**
- **WhatsApp and TikTok** were the most frequently used platforms in a Q2 2025 survey
([DataReportal Digital 2026: Kenya](https://datareportal.com/reports/digital-2026-kenya), [NapoleonCat](https://stats.napoleoncat.com/social-media-users-in-kenya/2026/), [Statista](https://www.statista.com/statistics/1229091/most-popular-social-networks-in-kenya/))

**Three product consequences, immediately:**

1. **Instagram is a minority platform in Kenya (8.3%).** Every global creator platform is Instagram-first. **[REC]** Build **TikTok-first, Facebook-second**. An Instagram-led product is designed for a market that does not exist here at scale.
2. **WhatsApp is the actual communication layer.** Not a notification channel — the primary interface. See `10-technical-architecture.md`.
3. **Facebook's 23.1M reach dwarfs Instagram's 5.1M.** For FMCG and mass-market brands, Facebook creators are undervalued. Nobody is serving them because global tooling ignores Facebook.

### Market size — and why it should worry you

**[FACT]** Statista models Kenyan **influencer advertising** at **US$2.1M (2024) → US$3.0M (2028)**, inside a **US$95.5M → US$119.4M** total digital advertising market. Social media advertising is reported at **~$39.8M in 2026**, ~31.3% of digital ad spend.

**[ASSUMPTION]** These models almost certainly *undercount* real creator spend, because the majority of Kenyan brand–creator money moves informally: WhatsApp negotiation, M-Pesa settlement, no invoice, no media agency, no measurement. That spend does not appear in any advertising statistic. My estimate is that true creator-directed spend is some multiple of the modelled figure — but **I cannot verify the multiple, and neither can you.** Do not put a number you cannot defend in an investor deck.

**[REC]** Treat this as the **central strategic uncertainty of the company** and design a cheap experiment to resolve it in the first 90 days. The Deal Desk (below) is that experiment: it directly measures how much money is already moving informally, because creators bring their real deals to it.

---

## The competitors — what is actually there

### Verified and substantive

**Wowzi** — **[FACT]** Kenyan, raised **$3.2M total** ($1.2M pre-seed + $2M seed announced Dec 2021, led by 4DX Ventures, with To.org, Golden Palm, LoftyInc, Afropreneur Angels, Future Africa, and Andela co-founder Christina Sass). Strategy is **nano/micro at volume** — reportedly onboarding users with as few as 250 connections, and ~90% of weekly payouts going to micro and nano creators.
- *Doing well:* the volume-of-ordinary-people thesis is right for Africa, and enterprise/telco relationships are real.
- *What creators like:* low barrier to entry, frequent small payouts.
- *What brands may dislike:* **[ASSUMPTION]** nano-at-volume optimises for reach and cost, not creative quality. If you want one excellent video, a swarm of 250-connection posters is the wrong instrument.
- *Structural gap:* **[ASSUMPTION]** it is an activation/amplification engine, not a creative-services marketplace. Content *quality* is not the unit of value.

**AIfluence** — **[FACT]** Kenyan, **$1M seed** (July 2021, led by EQ2 Ventures with Antler East Africa, OUI Capital, ArabyAds); AI-driven audience-first matching; campaigns across 13 countries in Africa and Asia; oriented to onboarding hundreds-to-thousands of micro/nano influencers per campaign.
- *Doing well:* audience-first matching and multi-country reach.
- *Structural gap:* **[ASSUMPTION]** enterprise-campaign shaped — sold to advertisers, not self-serve. An SME restaurant cannot buy from it on a Tuesday afternoon.

**Zaumu** — **[FACT]** Launched in Nairobi **25 April 2025**, positioning as a creator-first, end-to-end campaign management platform. Publicly described features include: **transparent job listings with stated budgets**, **milestone-based payments with brands depositing funds before work begins**, **creator-protective contracts** explicitly rejecting hidden perpetual-rights clauses, **secure in-platform communication**, **automated reporting**, **built-in AI assistance**, and **two-sided reviews**. Co-founder Cedric Nzomo cites that "90% of projects targeting creators never reach execution."

> **This is the most important competitive fact in this pack.** Zaumu already ships escrow, milestones, contracts, two-sided reputation and in-platform messaging — the core of what you described to me as the product. **Your differentiation cannot be any of those things.** Assume they exist on day one at a competitor and design past them.

**Others verified as operating:** **Ushawishi** (Kenya, creator-facing campaign marketplace), **Vicomma** (hire creators in Kenya, 120+ categories), **Diglancers** (pan-African agency + UGC platform, claims 1,500+ verified creators across 10+ countries including Nigeria, South Africa, Kenya, Ghana, Zambia, Cameroon, Ethiopia; positions as Nigeria's first managed UGC creator platform), **Influencer Africa** (by EchoHouse; explicitly markets "local payment rails"), **Lit.africa** (South Africa), **Aktivate**, **ViralGet** (Nigeria, positioning as the influencer data layer). Global **Collabstr** already runs Kenya/Nairobi landing pages — it is present via SEO, not operations.

### Could not verify — stated plainly

**[FACT — negative result]** I found **no substantive public information** for **Oiqora**, **NingNang**, **EndaViral**, **Vumasasa**, or a Kenyan platform called **InfluencerX**. Searches returned unrelated results. I will not fabricate profiles. Either they are pre-launch, dormant, or too small to leave a footprint. **If you have direct knowledge of these, tell me and I will factor them in** — otherwise treat the competitive set as the verified list above.

### The informal market — your real competitor

**[ASSUMPTION, but high confidence]** The dominant way Kenyan brands hire creators today is not a platform at all:
- **WhatsApp groups** run by creator organisers who broker deals for a cut
- **Instagram/TikTok DMs** direct to the creator
- **Agencies and PR firms** bundling creators into retainers with undisclosed markups
- **Personal networks** — the brand manager's friend's cousin who makes food content

This informal channel wins on **speed and familiarity** and loses on **payment reliability, contracts, measurement, and scale**. Your competitor is not Zaumu. It is a WhatsApp group with 400 members and no escrow.

---

## Where the incumbents are weak — the systematic read

| Dimension | The weakness | Your opening |
|---|---|---|
| **UX** | Built for advertisers and campaign managers, not for a restaurant owner with a phone. Desktop-first, form-heavy, jargon-heavy. | Mobile-first, Swahili/Sheng-aware, outcome-priced, three taps to buy. |
| **Payments** | **[ASSUMPTION]** Late creator payment is the loudest, most consistent creator complaint in the Kenyan market — the whole Zaumu pitch is built on it. Payment is treated as back-office, not product. | **Payment speed as the headline feature.** Escrow funded before work; M-Pesa payout within hours of approval. Publish the median payout time. |
| **Discovery** | Follower-count-ranked lists, thin filters, no geographic granularity below "Kenya." | Ward-level geography (Westlands, Kilimani, Nyali), campaign-type-first browsing, quality-ranked defaults. |
| **Trust** | One-directional. Creators are rated; brands are not. Nobody underwrites delivery. | Two-sided reputation + a platform-backed delivery guarantee. |
| **Campaign mgmt** | Brief → post → screenshot. Little revision structure, weak proof-of-delivery, no logistics. | Structured deliverable state machine, automated proof capture, seeding logistics. |
| **Liquidity** | Supply-heavy and demand-poor. Creators sign up and find nothing. | Deal Desk seeds GMV from existing relationships; managed demand at launch. |
| **Influencer-not-creator bias** | Everything gates on follower count. A skilled videographer with 2,000 followers is invisible. | **Two parallel supply pools with different ranking logic** (see Part 19 in `07-product-spec.md`). |
| **Rights** | Usage rights are informal or absent; perpetual-rights abuse is common enough that Zaumu markets against it. | Priced, contractual, machine-readable rights module. |
| **Measurement** | Screenshots of views. Almost no conversion attribution. | Promo codes and tracked links as first-class, from V1. |

---

## The largest unmet need

Ranked by size of the gap, not by how interesting the feature is:

1. **Guaranteed, fast payment for creators.** Solved on paper by Zaumu; not yet solved at scale. Whoever *actually* pays fastest, consistently, and can prove it, wins supply.
2. **A way for an SME to buy marketing content without a marketing team.** No incumbent serves the restaurant/salon/gym/clinic buyer. They are numerous, they have cash, they have zero capability, and they are geographically dense in Nairobi.
3. **Location-based physical collaborations.** Structurally absent everywhere globally. Perfectly suited to Kenya.
4. **Content production at volume, decoupled from audience.** The UGC category barely exists locally as a purchasable product.
5. **Proof and measurement an SME actually believes.** "You got 41,000 views and 62 people used your code."

---

## If we launched in Kenya today, what must be different?

Seven things. Each is a direct response to a verified or high-confidence weakness.

1. **Sell campaigns, not access.** Fixed-price, outcome-named packages. Not a search tool. Not a SaaS seat.
2. **Be the fastest payer in the market, and make that the brand promise.** Publish median time-to-payout on the homepage. It is a supply magnet and it is verifiable.
3. **Creators pay zero.** Every competitor and every agency takes from the creator. Take from the brand instead, transparently. This is the cheapest supply-acquisition weapon you will ever have.
4. **Launch the Deal Desk on day one.** Let creators bring existing clients for escrow + contract at 5%. This produces GMV before you have solved demand, and it measures the informal market's true size.
5. **Own the physical collaboration.** Visits, events, seeding-with-logistics. This is the empty column in the global matrix and the dense opportunity in Nairobi.
6. **Build TikTok-first and Facebook-second.** Instagram is 8.3% of Kenya. Global tooling has this exactly backwards.
7. **Treat WhatsApp as the interface and the platform as the ledger.** Fighting WhatsApp loses. Wrapping it wins.

**[REC]** Notice what is *not* on this list: AI matching, creator tiers, gamification, agency accounts, analytics dashboards. Those are all real and all later. The seven above are the ones that decide whether the company exists in 18 months.

# Part 3 — Defining the Marketplace

## The organising abstraction

The mistake almost every platform in this space makes is modelling the world as *"a campaign has creators and creators make posts."* That model cannot express a restaurant visit, a licensed video the brand posts itself, or a commission-only affiliate deal. Bolting those on later produces the mess you see in the competitive matrix.

**[REC] Model one primitive: the COLLABORATION.**

```
COLLABORATION
├── who        Creator ←→ Brand
├── why        objective (awareness | content | footfall | sales | leads | proof)
├── what       Deliverable[]        ← 0..n content artefacts
├── where      Placement[]          ← 0..n publish targets (or none)
├── when       Schedule             ← deadlines, visit windows, milestones
├── how much   Compensation         ← cash | product | commission | hybrid
├── rights     RightsGrant          ← scope, channels, duration, exclusivity
└── proof      Verification[]       ← how completion is established
```

Every one of your ten types is a **preset** over this one structure. That is the whole architectural argument: **ten products, one state machine, one escrow, one dispute process, one reputation ledger.** A new collaboration type becomes a config row, not a release.

The three dimensions that actually vary:

| | Audience required? | Physical presence? | Creator publishes? |
|---|---|---|---|
| Seeding | Sometimes | Delivery only | Usually |
| **Paid UGC** | **No** | No | **No** |
| Influencer campaign | **Yes** | No | Yes |
| **Location visit** | Sometimes | **Yes** | Yes |
| **Event coverage** | Sometimes | **Yes** | Sometimes |
| Affiliate | Yes | No | Yes |
| Hybrid | Yes | Varies | Yes |
| **Licensing** | **No** | No | **No** |
| Packages | Varies | Varies | Varies |
| Custom | Varies | Varies | Varies |

The bolded cells are where every incumbent breaks. Design for those first and the easy cases fall out free.

---

## 1. Product seeding

**The hard part is not the campaign. It is the logistics and the honesty problem.**

Two failure modes dominate: the product never arrives (creator is blamed for non-delivery they did not cause), and the creator keeps the product and never posts. Both are solvable only with **delivery as a tracked state**.

```yaml
SeedingCampaign:
  product:
    name, description, retail_value_kes
    quantity_available
    is_creator_keeping: bool          # near-always true; be explicit
  delivery:
    method: courier | rider | pickup_point | brand_dropoff
    coverage_areas: [ward_ids]
    dispatch_sla_days
    address_collection: platform_masked   # never expose raw address to brand
  content_requirements:
    posting_mandatory: bool           # THE critical field
    deliverables: [{format, platform, count, min_duration}]
    content_deadline_days_after_delivery   # clock starts on DELIVERED, not accepted
  compensation:
    type: product_only | product_plus_cash
    cash_amount_kes
  rights: RightsGrant
```

**[REC] Design rules that matter:**

- **`posting_mandatory` is a legal and reputational fork, not a checkbox.** If posting is mandatory, this is paid work compensated in kind and the creator carries an obligation. If it is not, it is a gift and the brand has no claim. Render these as two visually distinct campaign types in the UI — "Gifted (no obligation)" vs "Product-for-Post" — because conflating them is the origin of most seeding disputes.
- **The content deadline starts at `DELIVERED`, never at acceptance.** Non-negotiable. Kenyan delivery is variable and creators must never be penalised for logistics.
- **Cap non-delivery liability at the creator's zero.** If the product does not arrive within the SLA, the collaboration auto-cancels with no reputational damage to the creator and no charge to the brand.
- **Product-only seeding still needs escrow.** Escrow the *retail value* as a bond, or run it as a zero-value contract with reputation-only consequences. **[REC]** Start with the latter — bonding gifted product is over-engineering for launch.
- **Address privacy.** The brand never sees the raw address; the courier does. This is a Data Protection Act consideration as well as a safety one, particularly for female creators. Treat it as a hard requirement.

**On logistics integration (your Part 16 question).** **[REC] Do not build or own logistics.** Sequence it:
- **V1** — brand ships; creator confirms receipt with a photo; platform tracks state only.
- **V2** — integrate a rider/courier API; platform generates labels and holds the address; delivery status flows in by webhook.
- **V3** — optional consolidated dispatch from a brand's single drop to many creators (this is where real margin and real defensibility live, and where you become genuinely hard to leave).

**[ASSUMPTION]** Logistics is a plausible second revenue line and a large operational trap. It is a V3 decision with real evidence behind it, not a launch feature.

---

## 2. Paid UGC — treat this as the flagship, not a category

**[REC] This should be your single largest GMV line by month 12, and the product should be visibly biased toward it.**

The reasoning: UGC decouples value from audience, which means **supply is nearly unlimited** (any skilled phone videographer qualifies), **demand is recurring** (a brand running paid ads needs new creatives every month, permanently), **quality is objectively assessable** (you can watch the video), and **it exports** (a Kenyan-made UGC video is sellable to a global buyer at a 3–5x cost advantage). Compare: an influencer campaign is one-off, subjective, and non-exportable.

```yaml
UGCOrder:
  content_type: enum(38)      # see catalogue below
  specs:
    duration_seconds, aspect_ratio, resolution_min
    language: [en, sw, sheng, luo, kikuyu, ...]
    hooks_required: int       # e.g. 3 hook variants for ad testing
    raw_footage_included: bool
  talent_requirements:
    on_camera: bool
    age_range, gender, look_notes    # bias-audited; see note
  brand_inputs:
    product_supplied: bool
    script_supplied: bool | creator_scripts
    reference_links: []
  delivery:
    format: file_upload       # NOT a social post
    revisions_included: int   # default 1
  rights: RightsGrant         # this IS the product being sold
```

**The content-type catalogue** (your list, extended and grouped for the UI):

- **Talking-head:** testimonial, review, founder-style, POV, problem/solution, myth-bust, day-in-the-life
- **Demonstration:** unboxing, tutorial, how-to, before/after, comparison, ingredient/feature breakdown
- **Entertainment:** skit, meme-style, reaction, green-screen, duet/stitch-style, street interview, prank-lite
- **Visual assets:** product photography, lifestyle photography, flat-lay, model shots, B-roll pack
- **Audio/voice:** voiceover (English, Swahili, Sheng, vernacular), jingle, podcast read
- **Motion/design:** simple animation, subtitle/caption pass, edit-only from brand footage

**[REC] Two design decisions specific to UGC:**

1. **The portfolio is the profile.** For a UGC creator, follower count must not appear on the card at all — not de-emphasised, *absent*. The card is: three video thumbnails, price, delivery time, rating, jobs completed. This is Fiverr's card, not Instagram's.
2. **Hook variants are the killer feature for performance buyers.** A brand testing creative wants three different first-three-seconds on one video. Nobody in Africa sells this. It is a trivially small feature and a strong differentiator with the highest-value buyer segment.

**[REC] On `look_notes`:** demographic targeting for casting is legitimate for advertising, and also the most likely place for the platform to enable discrimination. Constrain it to a controlled vocabulary (age band, gender, language), log every use, and prohibit free-text appearance requirements. Revisit with counsel before launch.

---

## 3. Influencer campaigns

The commodity category. Everyone does it; do it competently and move on.

```yaml
InfluencerCampaign:
  placements: [{platform, format, count, min_duration, live_window}]
  # platform: tiktok | instagram | youtube | facebook | x | linkedin
  # format: feed_post | reel | story | tiktok_video | short | long_form
  #         | live | integration | pinned_comment | bio_link
  requirements:
    min_live_duration_hours: 24   # cannot delete before this
    disclosure_required: true     # ALWAYS true — see 13-legal-compliance.md
    mention_handles: [], hashtags: [], link: url
  proof: {api_verified | screenshot_plus_url | platform_oauth}
```

**[REC]** Three things most platforms get wrong here:
- **Minimum live duration must be a contractual field**, because "the creator deleted the post" is a top-five dispute. Default 30 days; verify by re-checking the URL on a schedule.
- **Disclosure is not optional and not the creator's judgement call.** The platform injects the required disclosure text into every brief. See `13-legal-compliance.md`.
- **Cross-platform campaigns are one collaboration with multiple placements**, not multiple collaborations. Otherwise reporting and payment fragment.

---

## 4. Location visits — the wedge

This is where you differ structurally from everything in the global matrix. Treat it as a first-class booking product, closer to OpenTable than to an influencer campaign.

```yaml
VisitCampaign:
  venue:
    name, geo_point, ward, town
    visit_instructions, contact_person, parking_notes
  booking:
    available_slots: [{date, start, end, capacity}]
    creator_selects_slot: bool
    party_size_allowed: int        # +1 is standard and must be priced
  consumption:
    allowance_kes                  # what the creator may consume/receive
    covered_items: []
    is_comp_or_reimbursed: enum
  attendance_proof:
    method: geo_checkin | qr_code | staff_confirm | receipt_upload
  deliverables: [...]
  travel:
    stipend_kes                    # explicit; Nairobi transport is real money
```

**[REC] The details that decide whether this works:**

- **Geographic granularity must go below city.** Kenya's practical unit is the neighbourhood — Westlands, Kilimani, Karen, Lang'ata, Nyali, Milimani. A creator in Kasarani will not cross Nairobi for a KSh 3,000 visit. Model `country → county → town → ward/neighbourhood`, and make travel cost a visible, negotiable component.
- **Attendance proof should be QR-first.** Staff scans the creator's booking QR at arrival. Geo check-in is spoofable; a receipt is forgeable; a staff scan is cheap and near-unfakeable. **[REC]** QR primary, geo-fence as a corroborating signal, staff confirm as fallback.
- **Slot capacity prevents the classic disaster** of 20 creators arriving at a 30-seat restaurant simultaneously. Capacity per slot is mandatory.
- **The `+1` is not a nicety.** Restaurant and experience content needs two people on camera. Price it explicitly or creators will bring someone anyway and the venue will be unhappy.
- **Consumption allowance must be a number.** "Dinner is on us" produces a dispute the first time someone orders lobster.

**[ASSUMPTION]** Visit campaigns will have the highest completion rate and the highest satisfaction of any type, because the deliverable is concrete, the creator has a good time, and the brand sees people walk through the door. **[REC] This is very likely your best launch category.** It is also the one no incumbent can copy quickly, because it needs venue-side operational tooling they have no reason to build.

---

## 5. Event coverage

A visit with a fixed time window, higher intensity, and multi-format output.

```yaml
EventCoverage:
  event: {name, venue, start, end, dress_code, accreditation_required}
  role: attendee | documenter | host | mc | live_streamer
  deliverables:
    live_window: [{format, count, during_event: bool}]   # e.g. 5 stories DURING
    post_event: [{format, count, due_hours_after}]       # e.g. 1 recap in 48h
    raw_assets: {photo_count, video_minutes, delivery_method}
  exclusivity: {no_competitor_content_hours: int}
```

**[REC]** Two specifics: **live deliverables need a live clock** — stories posted during the event have a hard window and must be verified in near-real-time, not at approval. And **raw asset delivery is a separate deliverable with its own storage and rights terms** — 20 raw photos is a file transfer, not a post, and brands routinely forget they must pay for the rights to use them.

---

## 6. Affiliate / performance

**[REC] Build this as a first-class category, but be honest that it is the hardest to make work, and do not launch with it.**

The reason is structural: performance compensation requires **trustworthy conversion data**, and in Kenya the conversion often happens **offline** (someone walks into the shop) or through **WhatsApp commerce** with no tracking layer at all. If the creator cannot trust the number, they will not accept the deal — and they are right not to.

```yaml
PerformanceDeal:
  mechanism: promo_code | tracked_link | qr_code | ussd_code | reserved_phone
  payout:
    model: per_sale | per_lead | per_signup | revenue_share | per_1000_views
    rate_kes | rate_percent
    qualification_rules: {min_order_value, exclude_refunded, lead_definition}
  attribution:
    window_days: 30
    source_of_truth: platform_pixel | brand_declared | shopify | manual_reconcile
  guardrails:
    minimum_guarantee_kes        # STRONGLY recommended
    cap_kes
    reconciliation_day_of_month
    dispute_window_days: 14
```

**[REC] The trust design is the whole product here:**
- **Promo codes beat links in Kenya.** They work in physical shops, over WhatsApp, and verbally. Issue one unique code per creator per campaign. This is the highest-signal, lowest-tech attribution available and it works offline.
- **Never launch a pure commission-only marketplace category.** Creators have been burned by unverifiable "we'll pay you per sale" offers. **Require a minimum guarantee** on every performance deal for at least the first 12 months. It is the difference between a category that fills and one that sits empty.
- **The brand self-reports conversions, and the platform must assume they will under-report.** Mitigate with: mandatory monthly reconciliation, creator visibility into the running count, statistical anomaly detection across brands, and a brand reputation score that includes *reported conversion rate versus category norm*. A brand that consistently reports half the category conversion rate is either bad at selling or lying, and either way creators should see it.
- **Escrow the guarantee; invoice the commission.** You cannot escrow an unknown future amount. Guarantee sits in escrow; commission settles monthly against a funded balance with a top-up requirement.

---

## 7. Hybrid: guaranteed fee + performance

The right default for a maturing marketplace and, **[REC]**, an **empty column in the entire global competitive matrix.**

```yaml
HybridCompensation:
  guaranteed:
    cash_kes: 5000
    product_value_kes: 0
  variable:
    - {metric: sale,        rate_kes: 200, cap: 100}
    - {metric: views_1000,  rate_kes: 100, cap_kes: 20000}
    - {metric: qualified_lead, rate_kes: 100}
  settlement:
    guaranteed_released_on: deliverable_approved
    variable_settled: monthly_in_arrears
    variable_window_days: 60
```

Your three examples map cleanly: `KSh 5,000 + KSh 200/sale`; `KSh 2,000 + KSh 100 per 1,000 views`; `product worth KSh 3,000 + 10% commission`.

**[REC] The critical design constraint: the guaranteed portion and the variable portion have different escrow lifecycles.** The guarantee is escrowed at funding and released at approval. The variable portion cannot be escrowed at an unknown amount — so either (a) escrow the **cap** and refund the unearned remainder, or (b) require a **funded performance balance** the brand must top up. **[REC]** Use (a) when a cap exists — it is far more trustworthy to the creator — and require caps on all hybrid deals for the first year for exactly that reason.

**Why this matters commercially:** hybrid deals are how you raise AOV without raising the brand's risk, and AOV is the lever that decides whether the unit economics work (see `04-economics-and-pricing.md`).

---

## 8. Content licensing — sell rights as a product

The brand buys content it will use itself. The creator may never post. This is where UGC value is actually captured, and where creators are most routinely exploited.

```yaml
RightsGrant:
  base: organic_creator_channels        # included by default, always
  add_ons:
    - brand_organic_social:  {duration_days, +price}
    - paid_advertising:      {channels: [meta, tiktok, google, x], duration_days, +price}
    - website_and_email:     {duration_days, +price}
    - ooh_and_print:         {duration_days, +price}   # priced very differently
    - whitelisting_spark:    {duration_days, +price}   # creator's handle used
    - perpetual:             {+price}
  exclusivity:
    category_exclusivity: {category, duration_days, +price}
    non_compete_scope
  territory: [KE, EA, global]
  edit_rights: {may_edit, may_subtitle, may_recut, may_use_likeness_in_derivative}
  credit_required: bool
  expiry_behaviour: must_cease_use | auto_renew_offer
```

**[REC] Pricing structure (a multiplier ladder, not arbitrary numbers).** Express rights as multipliers of the base content fee so it scales with creator price and stays comprehensible:

| Grant | Multiplier on base fee | Rationale |
|---|---|---|
| Creator organic only | ×1.0 (included) | The default |
| Brand organic, 90 days | ×1.2 | Low incremental value |
| Paid ads, 30 days | ×1.5 | The standard UGC ask |
| Paid ads, 90 days | ×1.8 | |
| Paid ads, 12 months | ×2.5 | |
| Perpetual, all digital | ×3.5 | |
| + Whitelisting / Spark Ads | ×1.5 on top | Creator's identity is the asset |
| + Category exclusivity, 90 days | ×1.5 on top | Creator forgoes competitor income |

**[ASSUMPTION]** These multipliers are my recommendation drawn from the shape of global UGC pricing, not a verified Kenyan benchmark — **[FACT]** Billo, for reference, bundles **full perpetual paid-ads rights into its $99–$200 base price**, which is the opposite approach and worth considering for simplicity. Validate against real Kenyan willingness-to-pay in the first 90 days.

**[REC] UI principle: rights must be a slider with a live price, not a contract clause.** The brand moves "how long can we run this as an ad?" from 30 days to 12 months and watches the price change from KSh 6,000 to KSh 10,000. That single interaction teaches the entire market — brands and creators — what rights are worth. It is also, quietly, the most creator-protective thing you can build, and it directly attacks the perpetual-rights abuse that Zaumu markets against.

**[REC] Whitelisting requires real plumbing**, not a contract clause: TikTok Spark Ad code generation and Meta Partnership Ads account access. **[FACT]** Insense's one-click implementation of exactly this is its strongest feature. Target V2.

---

## 9. Creator packages (storefront)

Creator-authored, fixed-price, instantly buyable. **[FACT]** This is Collabstr's core mechanic and the reason it has liquidity without a sales team.

```yaml
Package:
  title, description, cover_media
  includes: [Deliverable]
  price_kes, delivery_days, revisions_included
  rights_included: RightsGrant
  add_ons: [{name, price_kes}]      # extra revision, rush, extra platform, rights upgrade
  max_concurrent_orders               # capacity control — protects reliability
  auto_accept: bool
```

**[REC]** Three rules: **capacity limits are mandatory** (a creator who takes eight orders and delivers two destroys the reputation system and your NPS); **add-ons are where AOV grows** (rush delivery, extra hooks, rights upgrades routinely add 30–50%); and **seed the catalogue yourself** — do not launch with an empty storefront. Write the first 20 packages with your first 20 creators, by hand, in a room.

---

## 10. Custom campaigns

The Upwork-shaped fallback for anything the presets do not cover. Brand writes a brief, creators apply, brand shortlists and hires.

```yaml
CustomCampaign:
  brief: {objective, description, references, do_not}
  targeting: {creator_types, categories, locations, age_range, languages,
              min_quality_score, audience_filters}
  slots: {count: 10, budget_per_slot_kes | total_budget_kes}
  application: {requires_pitch, requires_sample, requires_quote, deadline}
  selection: {auto_accept_threshold | manual_shortlist}
```

**[REC] The known failure mode of this format is application spam** — 200 low-quality applications, brand overwhelmed, brand leaves. Guard it from day one:
- **Limit concurrent applications per creator** (start at 10 active).
- **Require a pitch that references the brief**, not a template.
- **Rank applications by match score, never chronologically.**
- **Show the brand only the top 20** by default, with the rest one click away.
- **Charge applications against a weekly quota** that expands with reputation. A Gold creator gets more shots because they convert.

**[REC]** Custom campaigns should be a *minority* of GMV. If they exceed ~30% of volume, it means your presets do not match real demand and the catalogue needs rework. **Instrument this ratio as a product-market-fit signal** — it is one of the most informative numbers you will have.

---

## What this buys you

One collaboration entity, one funding and escrow path, one deliverable state machine, one dispute process, one reputation ledger — and ten purchasable products on the surface. Adding "podcast sponsorship" or "billboard shoot" later is a preset, not a project.

**[REC] Launch with four of the ten:** Location Visits, Paid UGC, Product Seeding, Influencer Posts. Add Packages and Custom in month two. Hold Affiliate, Hybrid, Events and standalone Licensing until you have real dispute and attribution data. Rationale is in `14-roadmap-mvp.md`.

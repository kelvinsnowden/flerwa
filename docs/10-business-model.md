# 10 — Business Model and Unit Economics (Brief §9, §30, §43, §44, §57)

## Why the original pricing does not survive the pivot

The creator blueprint recommended **15% on top, paid by the brand, 0% from the provider**. That was right for a market where supply was the scarce side, deliverables were digital, and prices were listed.

**[REC] It does not survive contact with services, for three reasons:**

1. **Quote-based work has no listed price to add 15% to.** A fundi quoting KSh 8,000 will simply quote KSh 8,000 knowing the customer pays KSh 9,200, and the "provider keeps 100%" promise becomes theatre.
2. **In services, demand is the scarce side, not supply.** Kenya has abundant providers and scarce trusted demand. Giving away the provider fee buys you the wrong thing.
3. **A single rate cannot span a KSh 3,500 repair and a KSh 50,000 project.**

---

## The recommended model

**[REC] A two-sided but asymmetric fee, transparent on both sides, varying by vertical.**

```
Customer pays:   service price + service fee (8–12%, shown as a line item)
Provider pays:   commission (5–10%, shown gross → net in the app)
Blended take:    15–20%, varying by vertical
```

| Vertical | Customer fee | Provider fee | Blended | Rationale |
|---|---|---|---|---|
| **Remote-principal / verification** | **12%** | **8%** | **20%** | Highest value delivered; customer is buying assurance, not labour; hard-currency buyer |
| Business & creator | 12% | 0% | 12% | Keep the archived promise — supply war is real in this vertical |
| Fundi / trade | 8% | 10% | 18% | Provider gains most (guaranteed payment, materials protection, disputes) |
| **Deal Desk** (provider brings customer) | **0%** | **5%** | **5%** | Platform contributed no demand |
| **Repeat, same pair, 2nd job** | 6% | 6% | **12%** | Anti-leakage |
| **Repeat, same pair, 3rd+** | 5% | 5% | **10%** | Anti-leakage |
| Recurring series | 5% | 5% | **10%** | Retention over extraction |

**[REC] Four principles that must not be compromised:**

1. **Never a hidden provider fee.** The app always shows *"Job KSh 8,000 · Platform 10% −KSh 800 · You receive KSh 7,200"* before acceptance. **[FACT]** Kenyan providers' loudest grievance with agencies and brokers is opaque deduction; replicating it destroys the supply proposition instantly.
2. **Never charge for leads.** **[FACT]** Thumbtack does $400M charging $8–150 per lead shared with 4–5 pros. It works commercially and it is wrong here: it extracts from providers who cannot afford it, decouples revenue from completed work, and produces no completion data — which is your entire strategic asset.
3. **Descending repeat fees are a cost of retention, not lost revenue.** The alternative is not 15% on job two; it is 0% on job two, off-platform.
4. **[REC] Materials pass-through is not revenue and not GMV.** Report it separately or you will flatter your numbers and mislead yourself.

---

## The KSh 5,000 line, derived

**[ASSUMPTION] Cost inputs are estimates requiring real quotes.** Payment costs use the earlier verified structure: collection ~1.5% at low volume, B2C payout ~1% plus a fixed per-transaction cost, business-absorbed.

| Job value | Blended fee | Revenue | Payment cost | Gross | Cost to serve | **Contribution** |
|---|---|---|---|---|---|---|
| KSh 800 | 18% | 144 | 68 | 76 | 150–300 | **−74 to −224** |
| KSh 1,500 | 18% | 270 | 78 | 192 | 150–350 | **−158 to +42** |
| KSh 3,000 | 18% | 540 | 98 | 442 | 200–400 | **+42 to +242** |
| **KSh 5,000** | 18% | 900 | 121 | 779 | 200–400 | **+379 to +579** |
| **KSh 8,000** | 18% | 1,440 | 155 | 1,285 | 250–400 | **+885 to +1,035** |
| **KSh 22,000** | 18% | 3,960 | 314 | 3,646 | 300–450 | **+3,196 to +3,346** |

**Cost to serve** = allocated support, trust & safety, dispute handling and QC per completed job. **[REC] For physical services with any human touch, assume KSh 200–400 in year one.** It falls with automation and standardisation; it never reaches zero while people enter homes.

> **The line sits at roughly KSh 5,000.** Below it, one support contact consumes the entire margin. Above KSh 8,000 the model is comfortable.

---

## Three scale scenarios

**[ASSUMPTION] Illustrative, not forecasts.**

### Scenario 1 — Month 9: proving the wedge

| | |
|---|---|
| Completed jobs / month | 400 |
| Average job value | **KSh 7,500** |
| **GMV** | **KSh 3,000,000** |
| Revenue @ 19% blended | 570,000 |
| Payment costs | (95,000) |
| Ops, support, T&S (5 FTE @ 85,000) | (425,000) |
| **Gross profit** | **50,000** (9%) |
| Engineering (4 @ 260,000), marketing, G&A, infra | (2,090,000) |
| **Net** | **−KSh 2,040,000/mo** |

### Scenario 2 — Month 24: two verticals, Nairobi

| | |
|---|---|
| Completed jobs / month | 3,000 |
| Average job value | **KSh 11,000** |
| **GMV** | **KSh 33,000,000** |
| Revenue @ 17% blended (repeat discounts biting) | 5,610,000 |
| Payment costs @ negotiated rates | (660,000) |
| Ops, support, T&S (16 FTE @ 90,000) | (1,440,000) |
| **Gross profit** | **3,510,000 (63%)** |
| Engineering (10 @ 300,000), marketing, G&A, infra | (7,300,000) |
| **Net** | **−KSh 3,790,000/mo** |

### Scenario 3 — Month 42: three verticals, two cities

| | |
|---|---|
| Completed jobs / month | 15,000 |
| Average job value | **KSh 13,000** |
| **GMV** | **KSh 195,000,000** (~US$1.5M/mo) |
| Revenue @ 16% blended | 31,200,000 |
| Payment costs | (3,510,000) |
| Ops, support, T&S (45 FTE @ 100,000) | (4,500,000) |
| **Gross profit** | **23,190,000 (74%)** |
| Engineering (28 @ 350,000), marketing, G&A, T&S tooling, infra | (21,000,000) |
| **Net** | **+KSh 2,190,000/mo** |

### What the models actually say

**1. Breakeven sits around KSh 120–150M GMV/month** — roughly **10,000–12,000 completed jobs at KSh 12,000+**. That is a serious business and a long road. Anyone modelling breakeven at Scenario 2 is modelling a smaller team than this business needs.

**2. Cost to serve per job must fall roughly 3× between Scenario 1 and 3** (from ~KSh 1,060 to ~KSh 300 all-in ops per job). If it does not, Scenario 3 is loss-making. **[REC] Make cost-to-serve-per-completed-job a board metric from month one.**

**3. AOV remains the dominant lever, exactly as in the original blueprint.** At Scenario 2 volumes:

| AOV | GMV | Revenue | Gross profit |
|---|---|---|---|
| KSh 6,000 | 18.0M | 3.06M | 960,000 |
| KSh 11,000 | 33.0M | 5.61M | 3,510,000 |
| KSh 16,000 | 48.0M | 8.16M | 6,060,000 |

**Same job count. Gross profit swings 6×.** This is why the vertical selection in `09` matters more than any pricing decision.

**4. Payment costs improve from ~17% to ~11% of revenue** with volume negotiation, but never disappear.

---

## Other revenue lines, honestly assessed

| Line | Verdict |
|---|---|
| **Transaction fee** | ✅ Core, from day one |
| **Managed service** (+8–10%) | ✅ Real, and it *is* the product at launch |
| **Recurring series** | ✅ The retention prize — lower rate, higher LTV |
| Business accounts (landlords, agencies, SMEs) | ✅ V2 — high AOV, low CAC |
| Deal Desk (5%) | ✅ From day one — cold-start weapon |
| Verification-as-a-service to third parties | ⚠️ Interesting later; conflict-of-interest risk if the seller pays |
| Premium placement | ❌ Corrupts ranking, which is the product |
| Provider subscriptions | ❌ Not while supply is being acquired |
| Lead fees | ❌ **Never** — see principle 2 |
| Customer subscriptions | ❌ Frequency is too low to justify |
| **Insurance attachment** | ⚠️ **[FACT]** Kandua's realised exit was to an insurer — a genuine long-term line, requiring partnership and **[LEGAL — COUNSEL REQUIRED]** |
| Lending / underwriting | ⚠️ **[REC] Keep out of the plan and out of the pitch.** Per your own brief: serious regulatory and risk analysis required first |

---

## The metric that governs pricing

**[REC] Do not optimise take rate. Optimise `GMV per active customer per year`.**

```
GMV per customer/yr = AOV × jobs per year × retention
```

A 20% take rate on a customer who transacts once is worth less than 12% on one who transacts six times. Every pricing decision in the table above — descending repeat fees, cheap recurring, the 5% Deal Desk — trades rate for frequency deliberately. **In a market where both parties can leave in ten seconds via M-Pesa, that is the only trade that compounds.**

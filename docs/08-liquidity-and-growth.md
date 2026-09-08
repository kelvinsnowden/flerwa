# 08 — Liquidity, Density, Disintermediation and Growth (Brief §27–35)

## Cold start: which side first?

**[REC] Neither. Sell completed jobs by hand, one at a time, before building anything.** This is unchanged from the original blueprint and more important here, because a services failure is physical and public: a no-show at someone's home generates a story that travels.

```
Weeks 1–4   Sell and deliver 20 jobs manually. WhatsApp, a phone, a spreadsheet.
            Recruit ONLY the providers those 20 jobs need — perhaps 8 people.
Weeks 5–8   40 more. Write down every price, objection, failure and dispute.
Weeks 9–12  Build the product from what you wrote down. Not before.
```

**[FACT]** Lynk pivoted its operating model repeatedly searching for one that worked in Nairobi, and had to build its own academy after training partnerships failed. **[REC] Assume you will be wrong about the operating model too, and buy that discovery cheaply — with 60 manual jobs, not with 9 months of engineering.**

---

## The Deal Desk, generalised — your best cold-start weapon (Brief §31)

The strongest idea in the original blueprint transfers directly, and is stronger here.

```
A provider already has a customer.
        ↓
"Let's run it through the platform so we both have protection."
        ↓
Platform: agreed scope + escrow + evidence + guaranteed payout + a verified record
        ↓
Provider pays 5%.  Customer pays 0%.  Customer is now onboarded, free.
```

**[REC] Why this matters more in services than it did in the creator market:**

- **It solves the two-sided cold start by not having one.** Both parties already exist and already agreed.
- **It acquires customers at approximately zero CAC**, and they arrive pre-trusting because their own provider vouched for the platform.
- **It generates real price data** — the input every "productised outcome" price in this document currently lacks.
- **It converts your biggest threat into revenue.** Rather than policing off-platform behaviour, you monetise it.
- **[FACT]** Precedent: Upwork Direct Contracts at 5%.

**[REC] The provider pitch is one sentence: *"Never chase a payment again. 5%."*** For a fundi who has been stiffed — and most have — that is a stronger proposition than lead generation.

**[REC] The customer pitch is also one sentence: *"It costs you nothing, and your money is only released when you're happy."***

---

## Disintermediation — the honest analysis (Brief §27, §30)

**[REC] You cannot prevent it. Stop trying. Design so that leaving is a bad trade, and choose categories where it is a bad trade naturally.**

Your brief asks for the answer to be *"Why would you leave?"* rather than *"Don't share your number."* Correct. Here is the honest inventory.

**Where leakage is structurally unwinnable:**
Recurring, local, same-provider, in-home services — cleaning, mama fua, gardening, nannying. By the third visit the relationship is direct and both parties save your fee. **[REC] The answer is not a feature. The answer is to not launch there.** This is the primary reason those categories are excluded in `00 §6`.

**Where leakage is structurally weak — build here:**

| Category | Why the customer stays |
|---|---|
| **Remote-principal / representation** | The customer has **no basis to trust the individual**. The platform *is* the trust. Going direct reintroduces exactly the risk they paid to remove. |
| **Episodic trades** (plumbing, painting, moving) | Different problem, different specialist, months apart. The customer's memory is of *the platform*, not the person. |
| **High-value one-offs** | The guarantee, dispute cover and insurance matter more than 15%. |
| **Business services** | Invoices, receipts, contracts, rights and VAT records have real value to a business buyer. |

**Retention mechanisms worth building, in order of strength:**

1. **Escrow and the guarantee.** Off-platform there is no recourse; the whole value is the recourse.
2. **Descending repeat fees** — 15% → 10% → 8% for the same customer-provider pair. Attacks leakage at the exact moment it is most tempting: right after a good first job.
3. **The Deal Desk at 5%** — the pressure valve.
4. **Records that matter:** receipts, warranty tracking, service history on a property, tax documentation.
5. **Workmanship guarantee** — a 30-day platform-backed guarantee simply does not exist off-platform. **[REC] This is the strongest single anti-leakage feature for trade work** and should be introduced with Vertical 3.
6. **[ASSUMPTION] Insurance attachment, later.** **[FACT]** Kandua was acquired by an insurer having built embedded financial services — evidence the attachment is real, but it requires partnership and regulatory work far beyond MVP.

**[REC] Detection is worth building only to inform pricing, never for punishment.** Aggressive enforcement in a market where both sides can transact on M-Pesa in ten seconds produces resentment and no compliance. Measure repeat rate per pair; if it collapses after job one, that is a pricing signal, not a policing signal.

---

## Geographic density (Brief §35)

**[REC] Think in travel time, not administrative geography.** Nairobi traffic makes 8km unbookable at 5pm. Model `country → county → town → ward`, with a **travel-time matrix by time of day** rather than straight-line distance.

**[REC] Launch corridor, not city:** Westlands, Parklands, Kilimani, Kileleshwa, Lavington, Karen. High-value property, dense SMEs, concentrated diaspora-owned rentals, providers can cross the corridor in reasonable time.

**[REC] The density rule:** do not open a new area until the current one sustains **≥5 verified providers per active service with <24h availability**. A thin footprint in six areas reads as an empty product everywhere; a dense footprint in one reads as a real service.

**[FACT] SweepSouth's exit from Kenya and Nigeria is the cautionary case** — home-services capability is local operational competence, not software, and it does not travel. That protects you from outside entrants and constrains your own expansion equally.

---

## Provider acquisition (Brief §31)

| Channel | **[ASSUMPTION]** Cost per *active earning* provider | Quality | Notes |
|---|---|---|---|
| **Founder hand-recruitment** | Time | ★★★★★ | The only channel for the first 30 |
| **Deal Desk** | ~0 | ★★★★★ | They arrive with a customer |
| Provider referrals | KSh 500 | ★★★★★ | Paid on the referee's first *settled* job |
| Earnings-proof content | KSh 300 | ★★★★ | A real M-Pesa message from a real provider |
| Trade associations, jua kali clusters | KSh 800 | ★★★★ | For Vertical 3 |
| TVET / polytechnic partnerships | KSh 1,000 | ★★★ | **[FACT]** Lynk's vocational partnerships never took off — expect this to underperform |
| Facebook/TikTok ads | KSh 2,000 | ★★ | Volume, low intent |

**[REC] Never pay on signup. Pay on the referee's first settled job.** Signup bounties reliably attract organised fraud; earning-gated rewards do not, because gaming them requires moving real money through a KYC'd rail.

**[REC] For the launch vertical, recruit small and pay well.** Twenty excellent verifiers beat two hundred mediocre ones. This supply pool is the product; treat recruitment like hiring, not like onboarding.

---

## Customer acquisition (Brief §32)

**[REC] For the diaspora wedge, the channels are unusually concentrated and unusually cheap:**

| Channel | Why |
|---|---|
| **Diaspora Facebook and WhatsApp groups** | Where scam warnings already circulate. Enter by being useful — publish a free "how to avoid rental and land scams" guide — not by advertising. |
| **Kenyan diaspora SACCOs, chamas, investment groups** | Members are actively buying property remotely. Partner rather than advertise. |
| **Diaspora churches and county associations** | High-trust, referral-dense communities |
| **Content answering the exact fear** | "How to verify a Kilimani apartment before you send a deposit" — SEO against a query people are already typing in distress |
| **Property portals and agents** | **[REC] Careful.** An agent referring inspections has an obvious conflict of interest. Accept traffic; never let the seller choose the inspector. |
| **Provider storefronts** | Shared into the same groups |

**[REC] The highest-converting asset you can produce is a redacted real inspection report.** It shows a frightened remote buyer exactly what KSh 6,000 buys, which no amount of copy achieves.

---

## Growth loops (Brief §33, §34)

Ranked by how much I would actually invest:

**1. Provider storefront distribution ★★★★★**
`Provider gets a bookable page → shares it → customers arrive → provider earns → shares more.` Supply becomes your demand channel. Cheapest acquisition available.

**2. Deal Desk conversion ★★★★★**
`Provider brings existing customer → customer experiences escrow → customer books someone else → that provider brings their customers.` Converts the informal economy transaction by transaction.

**3. Fear-relief referral ★★★★★**
`Customer avoids a scam → tells everyone.` **[ASSUMPTION]** In diaspora communities a near-miss story travels further than a satisfied one. Build the share moment into the report delivery: *"Share this report."*

**4. Earnings-proof loop ★★★★**
A real provider showing a real M-Pesa payment. Build a one-tap shareable receipt into the payout notification.

**5. Recurring conversion ★★★★**
`One-off job → "set up quarterly" → recurring GMV.`

**6. Density loop ★★★★**
`Enough providers in Kilimani → faster response → better reviews → more customers in Kilimani.` Manage by neighbourhood, not city.

**7. Evidence-as-marketing ★★★**
Redacted reports and before/after sets become the content engine.

**8. Landlord bridge ★★★**
`Diaspora buyer completes purchase → becomes a landlord → needs ongoing management.` **[REC] The single most valuable conversion in the model**: it turns a 2×/year customer into a quarterly one.

**9. Trade-cluster loop ★★★**
One respected fundi joins → his cluster follows. Supply in trades is socially networked.

**10. Records loop ★★**
Service history accumulating on a property makes the platform the system of record for that asset. Slow, and genuinely sticky.

---

## Referrals (Brief §31)

| Programme | Reward | Trigger |
|---|---|---|
| Customer → customer | KSh 500 credit each | Referee's first **settled** job |
| **Provider → customer** | **3% of that customer's GMV for 6 months** | First settled job; capped |
| Provider → provider | KSh 500 | Referee's first settled job |
| Diaspora community partner | Revenue share, contractual | Ongoing |

**[REC] The provider→customer reward is deliberately the most generous**, because a provider who brings a paying customer is worth far more than one who brings another provider. Supply is not your constraint; trusted demand is.

# 06 — Trust Architecture, Safety and Fraud (Brief §5, §16–20, §25, §26, §28, §54)

## The correction that governs this whole document

**[REC] Reputation splits in two, and conflating them is how a trust platform becomes a liability.**

| | Portable across categories? | What it measures |
|---|---|---|
| **Reliability & Integrity** | **Yes** | Shows up, on time, communicates, honest, doesn't steal, resolves problems |
| **Competence** | **No** | Can actually do *this specific job* well |

Mary being an outstanding cleaner is **zero evidence** she can inspect a property or wire a socket. A single blended "Trust Score 94" displayed across a horizontal marketplace actively misleads customers into unsafe hires, and it is the mechanism by which a platform's trust claim becomes a legal exposure.

```
PORTABLE                              NON-PORTABLE
┌──────────────────────┐              ┌──────────────────────────────┐
│  Reliability 94      │              │ Verification    ██████ 63 jobs│
│  ─ on-time      98%  │              │ Plumbing        ─      0 jobs │
│  ─ completion   99%  │              │ Content         ─      0 jobs │
│  ─ response    ~40m  │              │                              │
│  ─ disputes       1  │              │ Competence is earned per      │
│  ─ ID verified   ✓   │              │ category. It never transfers. │
└──────────────────────┘              └──────────────────────────────┘
```

**[REC] Product rule: a provider may only appear in a category where they hold category-specific verification, regardless of how high their Reliability score is.** Reliability determines *ranking within* a category. It never grants *entry to* one.

---

## Verification: define every claim you make (Brief §28)

Your brief is right that "verified" and "background checked" must be operationally and legally defensible. **[REC] Publish a plain-language definition of every badge, and never use a word you cannot substantiate.**

| Badge | What it means **exactly** | What it does **not** mean |
|---|---|---|
| **Phone verified** | OTP to an M-Pesa-registered number | Nothing about identity |
| **ID verified** | National ID/passport captured, liveness selfie matched, **name matches M-Pesa registration** | No criminal history checked |
| **Address on file** | Residential address collected and a utility bill or equivalent seen | Not independently visited |
| **Referenced** | Two prior customers or employers contacted by our team, notes on file | Not a criminal check |
| **Category assessed** | Passed our practical assessment for this category (test job, reviewed by ops) | Not a state licence |
| **Licensed** | Holds a named third-party licence/certificate, **copy on file, issuer verified** | Only as good as the issuer |
| **Insured job** | This booking is covered by our policy up to KSh X | Not unlimited liability |

**[REC] Do not claim "background checked."** **[LEGAL — COUNSEL REQUIRED]** Access to Kenyan criminal records for private screening is not something I could verify as reliably available to a platform, and the phrase creates an expectation you may not be able to meet. **[REC]** If you offer a Certificate of Good Conduct requirement for high-risk categories, describe it precisely as *"provider has supplied a Certificate of Good Conduct dated X"* — the specific, checkable claim — and confirm the lawful basis for collecting and retaining it under the Data Protection Act.

**[REC] Tier verification to risk, not to revenue:**

| Tier | Required for | Requirements |
|---|---|---|
| 0 | Browsing | Phone OTP |
| 1 | Any paid work | ID verified + M-Pesa name match |
| 2 | On-site at customer premises | Tier 1 + address on file + 2 references + category assessment |
| **3** | **Representation / customer-absent / high-value** | **Tier 2 + Certificate of Good Conduct + in-person interview + paid trial job + conflict-of-interest agreement** |

---

## The agency problem — the hardest risk in this business

**[REC] This deserves its own treatment because it is the failure mode that would destroy the wedge, and no competitor design I found addresses it.**

When a provider inspects a property for a remote buyer, the provider can be **bribed by the seller or agent** to write a favourable report. The customer then sends a life-changing sum on the strength of your verification. **A single such incident, publicised in a diaspora Facebook group, ends the company.**

**[REC] Controls, layered — none sufficient alone:**

1. **Structured reports, not opinions.** The deliverable is a **12-point checklist with mandatory geotagged photographic evidence per point**, not "looks fine to me." A dishonest inspector must fabricate evidence, not merely shade a judgement.
2. **In-app capture only.** Photos and video taken in-app, geotagged and timestamped at the property, hashed on upload. Gallery uploads are rejected for Tier 3 work.
3. **Conflict-of-interest declaration**, per job, contractual: the provider affirms no relationship with the seller, agent or landlord, and no payment received from them.
4. **The provider must never be introduced by, or introduced to, the counterparty by the platform's own routing.** Assign, don't let the seller choose.
5. **Random dual coverage.** **[REC]** For a sampled share of high-value jobs — and for every job above a value threshold — send a **second, independent inspector who does not know the first was sent.** Disagreement between reports is your strongest detection signal and the only real deterrent. Budget for it as a cost of goods, not overhead.
6. **Outcome follow-up.** Contact the customer 30–60 days later: did reality match the report? Feed the answer into the provider's Integrity score, weighted heavily.
7. **Never let the provider handle the customer's transaction money.** The platform's service is *information and representation*, not payment intermediation for the underlying property. **[LEGAL — COUNSEL REQUIRED]** — accepting or holding a customer's property deposit would materially change the regulatory analysis and should be avoided entirely.

**[REC] And be honest in the product about what the service is not.** An inspection report is evidence, not a legal guarantee of title. Overclaiming here is both a consumer-protection risk and a promise you cannot keep.

---

## The Trust Score (Brief §19, §20)

**[REC] Compute a composite for ranking. Never display a composite. Display components.**

```
Reliability (portable)
  on_time_rate            0.30
  completion_rate         0.30      accepted → completed
  response_time           0.15
  dispute_rate (inverted) 0.15
  cancellation (inverted) 0.10

Competence (per category)
  customer_quality_rating 0.45
  rework_rate (inverted)  0.20
  first_time_right        0.20
  assessment_score        0.15      decays as real jobs accumulate

Integrity (portable, gated)
  evidence_integrity      0.40      in-app capture, dual-coverage agreement
  outcome_follow_up       0.35      did reality match the report
  policy_violations       0.25      inverted
```

**[REC] Five design rules, all carried over from the original blueprint because they were right:**

1. **Bayesian cold start.** New providers enter at the category median with wide uncertainty, never at zero. `score = (prior·k + observed·n)/(k+n)`, k≈5. Otherwise no new provider is ever hired and supply calcifies — the explicit failure your brief warns about in §12.
2. **Rank by the lower confidence bound (Wilson), not the point estimate.** Three 5-star jobs must not outrank sixty 4.7-star jobs.
3. **180-day half-life.** Reputation must be losable and recoverable.
4. **Value-weight ratings.** A KSh 40,000 job counts more than a KSh 3,000 one.
5. **Ratings only from escrow-settled transactions.** This is the anti-gaming keystone: manipulating reputation costs real money through a KYC'd rail.

**[REC] Cold start, solved on the demand side rather than the algorithm side.** For a provider's first five jobs, show **"New — platform guaranteed"**: the platform underwrites the job, refunds the customer in full on any failure, and absorbs the loss. It converts an unranked provider into a safe choice and buys you the data the ranking needs. Budget it as customer acquisition cost.

---

## Two-sided reputation (Brief §11, §26)

**[REC] Customers must be rated too, and it matters more here than in the creator marketplace.**

```
Customer Trust
  ✓ ID verified · 17 jobs · ⭐ 4.8 from providers
  Payment reliability 100% · Cancellation 4% · No no-shows
```

Components: identity verification, completed transactions, funding reliability, cancellation rate, no-show rate, dispute rate, provider ratings, scope-creep flags.

**[REC] Why this is not symmetrical politeness but a supply-acquisition tool.** **[FACT]** Lynk found customers of higher social class unfairly mistrusted tradespeople. A provider who can see that a customer has 17 completed jobs, pays reliably and does not no-show is being offered something no WhatsApp referral gives them: **protection from a bad customer**. Combined with visible escrow, that is the core of the provider proposition.

**[REC] Consequences must be real:** customers who fail to fund after acceptance twice lose the ability to book without prepayment; chronic no-shows pay a cancellation fee that goes **to the provider**, not to the platform.

---

## Safety architecture (Brief §28)

**[REC] This is the risk most likely to be underweighted, and the one with the worst human consequences.** Physical services put strangers in homes and send people — often young, often women — to addresses given by strangers.

**Customer safety**
- Provider identity, photo and vehicle (where relevant) shown before arrival
- Live job status; check-in/check-out with geotag
- In-app emergency button routing to a staffed number during working hours
- Never share the customer's full address until the job is funded and assigned
- Post-job report channel that is prominent, not buried

**Provider safety — equally important and usually forgotten**
- Provider sees the customer's verification level and history **before accepting**
- Providers may decline any job, always, with no ranking penalty
- **Share-my-trip** to a trusted contact for on-site jobs
- Check-in/check-out with a missed-check-out escalation to ops
- Right to leave immediately and be paid in full if a site is unsafe or the customer is abusive
- **[REC] No lone female provider dispatched to a customer-absent residential job without an explicit opt-in and a check-in protocol.** This should be policy before it is ever tested.

**Prohibited and restricted**
- **Prohibited:** anything involving minors unsupervised, medical/clinical services, legal advice, security services, firearms, money handling for third parties, anything requiring a professional licence you have not verified.
- **[LEGAL — COUNSEL REQUIRED]:** childcare, elder care, health-adjacent services, domestic-worker placement, property representation, financial or tax services. Each needs a written view before the category opens.

**[REC] Treat any safety incident as a company-level event with founder involvement, a defined escalation path, and a decision made within hours — not a support ticket.** Have the protocol written before you need it.

---

## Disputes (Brief §24)

The five-tier ladder from the original blueprint survives and generalises:

```
L0 Self-serve — rework request inside the included allowance     0–24h
L1 Guided     — structured claim + evidence, 48h to respond
L2 Auto       — objective rules decide (timestamps, evidence, timers)  instant
L3 Mediation  — platform proposes a split; both accept → binding      72h
L4 Adjudicate — trained ops decides on an evidence rubric             5 days
```

**Auto-resolution rules — [REC] publish these in advance; predictability is most of perceived fairness:**

| Condition | Outcome |
|---|---|
| Provider no-show, no contact | 100% refund; reliability penalty |
| Evidence complete, customer silent 5 days | **Auto-approve, release to provider** |
| Customer cancels >24h before scheduled | Full refund |
| Customer cancels <24h before | 50% to provider (travel and lost slot are real costs) |
| Customer cancels after provider checked in | 100% to provider |
| Materials receipted, work incomplete | Materials settled; labour prorated |
| Evidence missing or ungeotagged | No release until supplied |
| Scope disagreement | Written scope governs; unwritten claims fail |

**[REC] The asymmetry principle: place the burden of proof on whoever controls the evidence.** The provider controls evidence of the work; the customer controls evidence of access, materials supplied and instructions given. Neither should be asked to prove a negative.

---

## Fraud (Brief §26)

**[REC] Ranked by expected loss in this specific market:**

| # | Threat | Primary control |
|---|---|---|
| 1 | **Disintermediation** | Value-based retention (`08`) — not policing |
| 2 | **Provider bribed by a third party (agency fraud)** | Structured evidence, dual coverage, outcome follow-up |
| 3 | Fabricated evidence (recycled or staged photos) | In-app capture, geotag, hashing, perceptual duplicate detection |
| 4 | Fake providers / stolen identity | ID + liveness + M-Pesa name match |
| 5 | Materials-money theft | Escrowed, receipted materials milestone |
| 6 | Customer refuses to pay for completed work | Escrow + 5-day auto-release |
| 7 | Theft from a customer's home | Tier 2/3 verification, insurance partnership, incident protocol |
| 8 | Review manipulation / collusion rings | Settled-transaction gating, graph analysis on repeated pairs |
| 9 | Account takeover / SIM swap | 24h hold and re-verification on payout-detail change |
| 10 | Fake customers wasting provider time | Customer verification + funding-before-dispatch |

**[REC] The keystone control is unchanged from the original blueprint: reputation and reviews derive only from escrow-settled transactions.** It makes fraud expensive, traceable and reversible, and it is nearly free to enforce.

# Part 5 — Payment Infrastructure (M-Pesa Core)

> **This document is not legal advice.** Kenyan payments law is a licensed area. Everything in the compliance section must be reviewed by a Kenyan advocate with CBK/NPS experience before you accept a single shilling. The design below is structured specifically to *reduce* the legal surface, but it does not eliminate it.

---

## The regulatory constraint that shapes everything

**[FACT]** Under the **National Payment System Act 2011** and the **National Payment System Regulations 2014**, an entity intending to process retail payments, facilitate e-commerce collections, operate digital wallets, or act as an aggregator must obtain a **Payment Service Provider (PSP) licence from the Central Bank of Kenya**. PSPs must protect consumer funds through **segregated client accounts or escrow mechanisms**, and applicants must submit an investment strategy for trust funds and details of any custodial trust relationship. ([CBK authorisation checklist](https://www.centralbank.go.ke/wp-content/uploads/2020/06/Payment-Service-Providers-Authorization-checklist.pdf), [CBK guidelines](https://www.centralbank.go.ke/images/docs/legislation/NATIONAL%20PAYMENT%20SYSTEM%20ACT%20(No%2039%20of%202011)%20(2).pdf), [CM Advocates](https://cmadvocates.com/blog/obtaining-a-psp-license-in-kenya-a-comprehensive-legal-and-regulatory-guide/))

You said: *"Do not assume we can legally hold customer funds indefinitely."* **You are right to be cautious, and the caution should go further:** the risk is not only duration, it is *character*. A balance a user can top up, hold, and spend at will is **stored value** and looks like e-money. A sum received for one identified transaction, held briefly, and paid to one identified recipient looks like **conditional settlement**. The first is a licensing problem; the second is much closer to ordinary commercial escrow.

### The three architectures, and the recommendation

| | **A. Aggregator-settled (RECOMMENDED for V1)** | **B. Trust account + partner bank** | **C. Own PSP licence** |
|---|---|---|---|
| Who holds float | Licensed aggregator (IntaSend / Paystack / Pesapal / Flutterwave) | Ring-fenced trust account, independent trustee | You |
| Regulatory burden | Lowest — you are a merchant | Medium — contractual trust, still needs opinion | Highest — full CBK licensing |
| Time to launch | Weeks | 3–6 months | 12–18+ months |
| Cost | Transaction fees | Legal + trustee + audit | Capital, compliance team, audit |
| Payout control | Via aggregator API | Direct B2C | Direct B2C |
| Economics | Worst | Better | Best |
| **When** | **Launch → ~KSh 30M GMV/mo** | KSh 30–150M/mo | Beyond, or if payments become a product |

**[REC] Launch on A. Plan for B. Only pursue C if financial services become a business line rather than a cost centre.**

The reasoning is not just speed. Architecture A means **the regulated float never sits in your name**. Money moves brand → aggregator's regulated account → creator. Your database records *entitlement*; the licensed party holds *funds*. That is a materially smaller legal surface, and it is also the honest description of what you are: a marketplace that instructs payments, not a bank.

### Design rules that keep you on the right side of the line

**[REC]** These are architectural commitments, not preferences:

1. **Escrow is always bound to one identified collaboration.** No general-purpose balance. Money enters *for* a specific contract.
2. **Escrow has a hard maximum duration.** **[REC]** 60 days. On expiry it auto-resolves (release or refund per policy) — it never simply sits.
3. **Creator earnings auto-sweep to M-Pesa.** Default: automatic payout on approval. If you offer a "hold my earnings" option at all, cap it — **[REC]** 7 days, then forced payout. A creator balance that accrues indefinitely starts to look like a deposit-taking product.
4. **No creator-to-creator transfers. No top-ups without a purchase. No withdrawal to anything but the verified owner's own M-Pesa number.** Each of these, individually, moves you toward looking like a wallet.
5. **Never pay interest on, or invest, held balances.** That is the brightest line in the room.
6. **Full double-entry ledger from day one**, reconciled daily against the aggregator. See below.

---

## The money flows

### Flow 1 — Brand funds a collaboration (STK Push)

```
Brand confirms order (KSh 11,500 = 10,000 creator + 1,500 fee)
   → Platform creates EscrowIntent (status: PENDING)
   → STK Push to brand's phone via aggregator
   → Brand enters M-Pesa PIN
   → Aggregator callback → verify amount + reference + idempotency key
   → EscrowIntent → FUNDED
   → Collaboration → IN_PROGRESS, creator notified (WhatsApp + push)
```

**[FACT]** STK Push (Lipa na M-Pesa Online) requires a registered Paybill or Till shortcode, publicly accessible HTTPS callback URLs, IP whitelisting, a signed go-live letter, and a defined use case; **6–8 weeks from sandbox to production is typical for a well-prepared team**. ([Daraja go-live guide](https://payherokenya.com/2025/05/21/how_to_go_live_on_mpesa_daraja_api/), [Hostiko](https://hostiko.co.ke/blog/mpesa-integration-kenya-daraja-api))

**[REC] Engineering non-negotiables for STK Push** — these are where teams lose money:
- **Never trust the callback alone.** Always reconcile with a transaction status query. Callbacks are lost, duplicated and delayed.
- **Idempotency on `CheckoutRequestID`.** Duplicate callbacks are normal, not exceptional.
- **Handle the timeout ambiguity explicitly.** A user who does not enter their PIN leaves the request in limbo; poll status and expire cleanly.
- **Assume partial and mismatched amounts.** Users type wrong amounts on Paybill. Reconcile by amount *and* reference; quarantine mismatches for manual review rather than auto-crediting.
- **Above STK limits, fall back to Paybill with a generated account number.** Large campaign funding will exceed transaction ceilings.

**[REC] For orders above ~KSh 150,000, offer bank transfer / Pesalink as the primary rail.** Agency and enterprise buyers will not fund a KSh 400,000 campaign by phone prompt, and forcing them to will cost you your highest-AOV customers.

### Flow 2 — Creator payout (B2C)

```
Brand approves deliverable
   → Collaboration → APPROVED
   → PayoutInstruction created (idempotency key = collaboration_id)
   → B2C to creator's VERIFIED M-Pesa number (must match KYC name)
   → Callback → PAID, receipt stored, creator notified
   → Target: under 60 minutes. Publish the median.
```

**[FACT]** M-Pesa B2C offers three tariff models: **Business Pays** (customer pays KSh 0 on KSh 1–250,000), **Shared Cost / Mgao** (50/50), and **Customer Pays**. Safaricom also cut merchant transfer fees by up to 50% effective 7 August 2026, with large Till-to-Paybill transfers capped at KSh 52. ([M-Pesa charges 2026](https://businessmax.co.ke/blog/m-pesa-charges/))

**[REC] Always use Business Pays and absorb the cost.** "KSh 10,000 means KSh 10,000 in your phone" is a promise worth far more than the KSh 40–60 it costs. Creators notice deductions and talk about them publicly.

**[REC] Payout speed is your headline product claim.** Publish the rolling median time from approval to M-Pesa on the homepage and in the creator app. It is verifiable, it is the thing creators care about most, and **[ASSUMPTION]** it is the grievance the entire Kenyan creator market has with agencies. Make it a number you defend, not a promise you make.

### Flow 3 — Split payments and milestones

**[REC] Default structures by order size:**

| Order value | Structure |
|---|---|
| < KSh 10,000 | 100% on approval (single release) |
| KSh 10,000–50,000 | 30% on acceptance / 70% on approval |
| > KSh 50,000 | Milestones |
| Visits & events | 100% escrowed; travel stipend released at check-in |

**[REC] The 30% upfront is a trust device, not a cash-flow device.** Its purpose is to prove to the creator that the money is real before they spend a day filming. It should be non-refundable except for creator non-performance — otherwise it provides no assurance at all.

Milestone template for larger work:

| # | Milestone | Release | Trigger |
|---|---|---|---|
| 1 | Concept / script approved | 20% | Brand approves concept |
| 2 | Draft delivered | 30% | Creator uploads draft |
| 3 | Final approved | 40% | Brand approves final |
| 4 | Published + proof verified | 10% | Proof verified (if publishing required) |

The whole amount is escrowed at funding. Milestones govern *release*, never *collection* — otherwise the creator has no assurance, which defeats the purpose.

---

## Refunds and the failure matrix

| Scenario | Escrow outcome | Creator record | Brand record |
|---|---|---|---|
| **Creator disappears** (no contact 72h past deadline) | 100% refund to brand | Non-completion; 3 in 90 days → suspension | Free replacement creator offered |
| **Creator misses deadline** (delivers late, work is fine) | Release in full | Late delivery logged; affects on-time % | — |
| **Brand cancels before creator accepts** | 100% refund | — | No penalty |
| **Brand cancels after acceptance, before work starts** | 90% refund; **10% kill fee to creator** | — | Cancellation rate ↑ |
| **Brand cancels after work started** | 50% refund; **50% to creator** | — | Cancellation rate ↑↑ |
| **Brand cancels after delivery** | No refund | — | Cancellation rate ↑↑↑ |
| **Brand won't approve legitimate work** | Auto-release after **5 days** of silence | — | Non-response logged |
| **Poor quality work** | Revision → mediation → partial/full refund | Quality flag | — |
| **Revision requested** | Escrow holds; clock pauses | — | Counts against revision limit |
| **Product never delivered** (seeding) | Cancel, no fault to creator | **No penalty** | Fulfilment reliability ↓ |
| **Creator posted, then deleted early** | Clawback from future earnings or refund | Serious violation | — |

**[REC] The auto-release rule is the single most important line in this table.** A brand that goes silent must not be able to hold a creator's money hostage. **Five days of no response after submission → automatic release.** State it in the creator terms, in the brief, and in the UI countdown. It is the mirror image of escrow: escrow protects the brand from a creator who vanishes; auto-release protects the creator from a brand that vanishes. **Without both, the marketplace is only trustworthy in one direction — and the untrusted side is the side you cannot afford to lose.**

Full evidence standards, revision limits and adjudication rules are in `06-trust-reputation-fraud.md`.

---

## KYC — tiered to transaction value

**[REC]** Do not front-load KYC. Every field before a creator's first earning is a drop-off. Escalate with money at stake:

| Tier | Trigger | Required | Enables |
|---|---|---|---|
| **0** | Signup | Phone OTP (M-Pesa-registered number) | Browse, apply |
| **1** | First paid collaboration | Full name matching M-Pesa registration; email | Earn up to KSh 20,000/month |
| **2** | Cumulative KSh 50,000 | National ID / passport + selfie liveness; ID-to-M-Pesa name match | Up to KSh 200,000/month |
| **3** | Cumulative KSh 500,000 or business | **KRA PIN**; business registration if applicable | Unlimited; withholding-tax handling |

**Brands:** business name + KRA PIN + contact verification before their first campaign goes live; certificate of incorporation for credit terms or invoicing.

**[REC] The M-Pesa-name-match check is your single highest-value fraud control** and it is nearly free: the payout name must match the KYC name. It defeats most account-takeover and mule-account patterns in one step, because M-Pesa registration is already ID-bound.

---

## The tax issue you must design for now

**[FACT]** Kenya applies a **5% withholding tax on digital content monetisation** for residents (**20% for non-residents**), in law since the Finance Act 2023 and effective 1 July 2023. Enforcement moved to withholding-at-source during 2026: **Meta began withholding 5% from Facebook and Instagram creator payouts in January 2026**, and **Google/YouTube began withholding from September 2026 earnings (paid October 2026)**, requiring a verified **KRA PIN on file in AdSense by 1 October 2026**. KRA guidance lists digital content monetisation among payments subject to withholding, covering ads, subscriptions, **brand deals**, and affiliate income. The Digital Content Creators Association of Kenya has publicly urged the Treasury and KRA to pause collection pending industry engagement. ([Techweez](https://techweez.com/2026/08/31/youtube-earnings-tax-kenya-5-percent-withholding/), [TechTrends KE](https://techtrendske.co.ke/2026/09/01/dccak-5-percent-withholding-tax-kenya/), [KICTANet](https://www.kictanet.or.ke/you-can-tax-us-but-where-is-it-going-what-kenyas-new-digital-taxes-really-mean-for-content-creators/))

**Why this is a product decision and not a footnote:**

If your platform is a payer of digital content monetisation income, **[ASSUMPTION]** it may itself carry a withholding obligation on creator payouts. Whether it does — and on which collaboration types — is a **question for a Kenyan tax advisor, urgently, before launch.** Getting it wrong in either direction is expensive: withhold when you should not and you underpay creators; fail to withhold when you should and you accrue a liability with penalties.

**[REC] Build the capability now, switch it on when advised:**
- `withholding_rate` as a configurable field per collaboration type and residency status
- KRA PIN capture at Tier 3 KYC (and encourage earlier)
- **Automatic withholding certificate generation** for every payout — this is a genuine creator benefit, because most creators cannot produce their own tax records
- Annual earnings statements per creator
- Gross/net clearly separated everywhere in the UI, never conflated

**[REC] Turn compliance into a feature.** *"We handle your creator tax paperwork"* is a real differentiator in a market where **[FACT]** withholding-at-source has just arrived and creators are visibly anxious about it. It is also, straightforwardly, the right thing to do. The informal WhatsApp economy cannot offer it, and that is a genuine reason to transact on-platform rather than off it.

---

## Reconciliation and the ledger

**[REC] Double-entry from commit one.** Retrofitting a ledger onto a payments system that has been running for a year is one of the most expensive mistakes available to you.

```
Accounts:
  brand_receivable        (per brand)
  escrow_held             (per collaboration)   ← liability
  platform_revenue        (fees earned)
  creator_payable         (per creator)         ← liability
  payment_costs           (expense)
  tax_withheld            (liability, if applicable)

Invariant, always:
  Σ escrow_held + Σ creator_payable == aggregator settlement balance
```

**Daily automated reconciliation** against the aggregator statement, with any break over KSh 100 raising an alert. **[REC] A named person owns reconciliation from month one.** Payment breaks compound silently and are discovered at the worst possible moment.

**Required per-transaction record:** M-Pesa receipt number, phone number (masked in UI, full in ledger), amount, timestamp, collaboration ID, direction, tariff applied, aggregator reference, reconciliation status. Retain for **7 years** **[ASSUMPTION — confirm the applicable retention period with counsel]**, and note that this interacts with Data Protection Act minimisation obligations (see `13-legal-compliance.md`).

---

## Multi-currency and the export path

**[REC]** Architect for it now, ship it in V3. Store **every** monetary amount as `{amount_minor, currency}` — never a bare number. Retrofitting currency is brutal.

When export becomes real: brand pays USD by card → platform converts → creator receives KSh via M-Pesa. FX spread becomes an additional revenue line, and **[ASSUMPTION]** a materially better-margin one than the take rate. Regional expansion adds MTN MoMo and Airtel Money (Uganda, Tanzania, Rwanda) — which is precisely why the payments layer must be **provider-abstracted from day one**:

```
PaymentProvider (interface)
  ├── MpesaDarajaProvider      (via aggregator at V1, direct at scale)
  ├── AirtelMoneyProvider      (V4)
  ├── MtnMomoProvider          (V4)
  └── CardProvider             (V3, export)
```

Every collaboration references a provider-agnostic `PaymentInstruction`. If M-Pesa is hard-coded into your domain logic, East African expansion becomes a rewrite rather than a configuration.

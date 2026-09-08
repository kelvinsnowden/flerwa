# 07 — Payment Architecture (Brief §21, §22, §23, §24)

## What carries over unchanged

The payment architecture from the original blueprint survives essentially intact, because it was designed around a constraint that has not changed: **[FACT]** processing retail payments, operating digital wallets or acting as an aggregator in Kenya requires **CBK authorisation as a Payment Service Provider** under the National Payment System Act 2011 and NPS Regulations 2014, with obligations to segregate client funds via trust or escrow structures. ([CBK](https://www.centralbank.go.ke/wp-content/uploads/2020/06/Payment-Service-Providers-Authorization-checklist.pdf))

**[REC] The unchanged design rules:**

1. **Launch on a licensed aggregator** (IntaSend / Paystack / Pesapal / Flutterwave) so the regulated float never sits in your name. You are a merchant instructing payments, not a payments business.
2. **Escrow is always bound to one identified transaction.** No general-purpose stored balance.
3. **Hard 60-day maximum escrow life**, then force-resolve.
4. **Auto-sweep provider earnings to M-Pesa.** No idle balances.
5. **Never pay interest on or invest held funds.**
6. **Double-entry ledger, reconciled daily against the aggregator, owned by a named person.**
7. **Business-Pays B2C tariff** — **[FACT]** M-Pesa's Business Pays option means the customer receives KSh 0 in deductions on amounts from KSh 1 to KSh 250,000. Absorb it. "KSh 6,000 means KSh 6,000 in your phone" is worth far more than the KSh 40–60 it costs.
8. **Static-IP constraint applies.** **[FACT]** Vercel uses dynamic outbound IPs; Daraja go-live typically involves whitelisting production server IPs. The aggregator resolves this — one more reason it is the right V1 choice. (`12`)

**[LEGAL — COUNSEL REQUIRED]** Whether this architecture makes you a PSP is a written-opinion question, not a judgement call. Unchanged from the original blueprint and still the first thing to resolve.

---

## What changes for a services marketplace

### 1. Money moves before the work, not after the brief

In the creator marketplace, funding and delivery were days apart and both remote. Here, a provider **travels to a location and incurs cost before any deliverable exists**. That changes three things:

**[REC] Fund before dispatch, always.** No provider is given an address until escrow is confirmed. This protects the provider from wasted trips and the customer from unfunded no-shows, and it makes the "customer failed to fund" failure mode impossible rather than merely penalised.

**[REC] Release travel/callout components at check-in, not at completion.** A provider who has physically arrived has earned the callout. Withholding it until a customer approves days later is the kind of unfairness that loses supply.

### 2. Materials money is a distinct escrow stage

The largest trust failure in Kenyan trade work, and unmodelled by every competitor I found.

```
MATERIALS_ADVANCED    → platform releases the agreed materials budget to the provider
                        (or pays the supplier directly, where possible)
MATERIALS_RECEIPTED   → provider uploads receipts + photos of goods on site
                        unused balance returns to the customer automatically
```

**[REC] Three rules:** the materials budget is agreed **in writing before work starts**; receipts are a **release condition** for the labour milestone, not a courtesy; and unused funds return automatically rather than on request. This protects the customer from theft and inflation, and — per Lynk's class-mistrust finding — protects the honest fundi from suspicion, which matters equally.

### 3. Recurring transactions need per-occurrence escrow

**[REC] Never take a large upfront payment for a series.** A customer booking quarterly property checks funds **each occurrence** shortly before it happens.

Two reasons, one commercial and one regulatory: prepaid multi-month balances are exactly the stored-value pattern that draws licensing scrutiny; and per-occurrence funding means a customer can stop at any time, which paradoxically increases willingness to start.

### 4. Payment structures by transaction size

| Value | Structure |
|---|---|
| < KSh 5,000 | 100% escrowed, single release on approval |
| KSh 5,000–25,000 | Callout/travel released at check-in; balance on approval |
| > KSh 25,000 | Milestones: 30% on scope agreement, materials as a discrete stage, balance on completion |
| Recurring | Per occurrence |
| Representation (Tier 3) | 100% escrowed; released only on complete structured evidence |

---

## The failure matrix

| Scenario | Escrow outcome | Provider record | Customer record |
|---|---|---|---|
| Provider no-show | 100% refund | Reliability penalty; 3 in 90 days → suspension | Free reassignment offered |
| Provider late, work fine | Full release | On-time % affected | — |
| Customer cancels >24h ahead | 100% refund | — | No penalty |
| Customer cancels <24h ahead | **50% to provider** | — | Cancellation rate ↑ |
| Customer cancels after check-in | **100% to provider** | — | Cancellation rate ↑↑ |
| Customer silent 5 days post-evidence | **Auto-release to provider** | — | Non-response logged |
| Work incomplete | Prorated by scope items completed | Quality flag | — |
| Materials taken, no work | Materials clawed back; labour zero | **Fraud review** | Full refund |
| Site unsafe, provider withdraws | **100% to provider** | No penalty | Reviewed |
| Evidence missing | Held pending | — | — |
| Platform error | **Both paid in full from platform funds** | — | — |

**[REC] The last row is a budget line, not a hypothetical.** Pay both sides and reconcile later. It is the cheapest reputation insurance available.

---

## KYC, tiered to value

| Tier | Trigger | Required |
|---|---|---|
| 0 | Signup | Phone OTP on an M-Pesa-registered number |
| 1 | First paid job | Full name matching M-Pesa registration |
| 2 | Cumulative KSh 50,000 | National ID + liveness; ID-to-M-Pesa name match |
| 3 | Cumulative KSh 500,000, or business | KRA PIN; business registration where applicable |

**[REC] The M-Pesa name-match check remains the highest-value fraud control per shilling spent.** M-Pesa registration is already ID-bound; requiring the payout name to match the KYC name defeats most mule-account and takeover patterns in one step.

---

## Tax

**[FACT]** Kenya applies a **5% withholding tax on digital content monetisation** for residents (20% non-residents), effective 1 July 2023, with Meta withholding from January 2026 and Google/YouTube from September 2026 earnings.

**[REC] Note carefully: that regime is specific to *digital content monetisation*.** It is directly relevant to the creator vertical. **[LEGAL — COUNSEL REQUIRED]** Whether and how withholding applies to a plumber's labour, an inspector's fee, or a platform's service fee is a **different question with a different answer**, and one of the clearest examples in this document of where the pivot widens the regulatory surface. Get a written view covering: withholding obligations by service type; VAT on the platform fee and on the underlying service; VAT registration threshold and timing; and the treatment of materials pass-through, which is **[ASSUMPTION]** likely not your revenue but must be presented correctly in the ledger either way.

**[REC] Build the capability, keep it switchable per category and residency, and generate withholding certificates automatically.** Handling providers' tax paperwork is a genuine benefit the informal economy cannot offer — and an honest reason to transact on-platform.

---

## The ledger

Unchanged and still non-negotiable from commit one:

```
Accounts
  customer_receivable   escrow_held        platform_revenue
  provider_payable      materials_held     payment_costs
  tax_withheld          insurance_reserve

Invariant, always:
  Σ escrow_held + Σ materials_held + Σ provider_payable
      == aggregator settlement balance
```

**[REC] `materials_held` and `insurance_reserve` are new accounts, and both are liabilities, not revenue.** Booking a materials advance as revenue is an easy and expensive accounting error to make early. Get the chart of accounts reviewed by an accountant before the first transaction, not after the first audit.

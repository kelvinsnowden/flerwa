# 14 — Risks, Failure Modes and Regulatory Surface (Brief §64, §65, §66)

## The twenty ways this fails

Ordered by probability × severity. **[REC]** The first five are the ones that actually decide the outcome.

**1. You launch horizontally and reach liquidity in nothing.**
*Evidence:* **[FACT]** Lynk pivoted operating models repeatedly across dozens of categories and exited via acquisition; SweepSouth spent $15M+ and left Kenya.
*Prevention:* one vertical, one corridor, gated expansion. *Warning:* a second category opening before the first hits 300 jobs/month. *Mitigation:* close categories, do not add them.

**2. The diaspora wedge is not real — willingness to pay does not exist at scale.**
*Prevention:* the 30-day validation in `11` **before** building. *Warning:* fewer than 10 unsolicited payers in week 2. *Mitigation:* fall back to Vertical 2, where a complete blueprint and a proven buyer already exist. **[REC] This fallback is the reason not to delete the creator work.**

**3. Cost to serve never falls below contribution per job.**
*Prevention:* KSh 5,000 floor; productisation; measure per-job cost from month one. *Warning:* cost to serve flat for two quarters. *Mitigation:* raise prices or narrow the catalogue — never chase volume at negative contribution.

**4. Agency fraud — an inspector is bribed and a customer loses life savings.**
*Prevention:* structured evidence, in-app capture, dual coverage on high-value jobs, outcome follow-up, conflict declarations (`06`). *Warning:* any single instance. *Mitigation:* make the customer whole immediately, publish what happened, tighten. **[REC] This is the failure mode that ends the company rather than damaging it.**

**5. A safety incident in a customer's home, or to a provider.**
*Prevention:* tiered verification, check-in/out, provider opt-in rules, incident protocol written before launch. *Warning:* any report. *Mitigation:* founder-level response within hours.

**6. Disintermediation in the categories you do launch.**
*Prevention:* wedge selection (`09`), descending repeat fees, Deal Desk, guarantees. *Warning:* per-pair repeat below 20%.

**7. Supply vetting costs more than modelled.**
*Evidence:* **[FACT]** Lynk had to build an academy after training partnerships failed. *Prevention:* launch vertical needs integrity and documentation, not trade skill. *Warning:* cost per cleared provider above KSh 5,000.

**8. Providers cannot use the software.**
*Prevention:* offline-tolerant capture, WhatsApp-first comms, in-person onboarding. *Warning:* evidence rejection rate above 20%.

**9. Frequency is too low to build habit.**
*Prevention:* the landlord conversion and recurring series. *Warning:* repeat below 25% at month 6.

**10. Existing players (Kalinoi, Balozy, My-Fundi) move first on verification.**
*Prevention:* depth in one vertical beats their breadth. *Warning:* any launches a diaspora inspection product. *Mitigation:* compete on evidence quality and guarantee, not features.

**11. A well-funded entrant.** *Mitigation:* **[FACT]** SweepSouth proves capability does not travel; local operational depth is the defence.

**12. Regulatory action on holding funds.** *Prevention:* aggregator architecture, 60-day escrow cap, written opinion pre-launch.

**13. Classification of providers as employees.** *Prevention:* genuine contractor structure; domestic work excluded. **[LEGAL — COUNSEL REQUIRED]**

**14. Property representation strays into regulated estate-agency or legal advice.** *Prevention:* report facts and evidence only; never opinion on title, valuation or legality; never hold deposits. **[LEGAL — COUNSEL REQUIRED]**

**15. Payment or reconciliation failure destroys trust.** *Prevention:* double-entry from commit one, daily reconciliation, a named owner. *Mitigation:* **pay from platform funds first, investigate second.**

**16. Founder-led sales does not transfer to hires.** *Prevention:* document every objection from job one.

**17. Building before selling.** *Prevention:* 60 manual jobs before the MVP. *Warning:* engineering velocity high, GMV flat.

**18. Provider concentration** — a handful of providers carry most jobs and can hold you up. *Prevention:* monitor share; cap at 15%.

**19. Data protection breach involving ID documents and home addresses.** *Prevention:* consider a specialist KYC vendor so you hold verification results rather than raw documents; encrypt; strict access; ODPC registration.

**20. The founders solve the interesting problem instead of the boring one.**
*Prevention:* North Star is completed jobs, not features. **[REC] In this business the boring problem is recruiting twelve honest people and checking their reports. That is the company.**

---

## Regulatory surface (Brief §66)

**[REC] Nothing here is legal advice.** The pivot materially widens the surface relative to the creator marketplace, and four items below are new.

### Resolve before taking money

| # | Question | Status |
|---|---|---|
| 1 | Does the escrow architecture make us a PSP requiring CBK authorisation? | Carried over — **[FACT]** PSP licensing required for processing retail payments, operating wallets or aggregating, under NPS Act 2011 / NPS Regulations 2014, with client-fund segregation obligations |
| 2 | **Are providers unambiguously independent contractors?** | **New and sharper** — physical, scheduled, supervised-feeling work invites scrutiny that remote creator work did not |
| 3 | **Does property inspection/representation touch estate-agency or legal-practice regulation?** | **New** |
| 4 | Withholding tax and VAT by service type | **[FACT]** The 5% digital-content-monetisation regime applies to the creator vertical; treatment of trade labour, inspection fees, platform fees and materials pass-through is a different question |
| 5 | ODPC registration | **[FACT]** Registration required under the Data Protection Act 2019; thresholds include turnover above KSh 5M, >10 employees, or processing sensitive data; penalties to KSh 5M or 1% of turnover |
| 6 | **Consumer protection obligations for a platform making trust claims** | **New** — "verified" is a representation to consumers |

### New exposures created by the pivot

**Domestic work.** **[FACT]** Gazetted minimum wage of **KSh 18,047/month** in the major cities (KSh 9,268 in smaller towns and rural areas); over two million domestic workers, largely informal and on verbal agreements. **[REC] Excluded from the plan** — but if it is ever reconsidered, the classification and wage-compliance analysis must come first, not after.

**Physical safety and liability.** Sending people into homes creates duty-of-care questions and insurance requirements the creator marketplace never had. **[REC] Obtain public liability and professional indemnity cover before the first on-site job**, and be precise in the product about what any "guarantee" actually covers.

**Trust claims as consumer representations.** **[REC] Every badge in `06` must be substantiable.** Do not use "background checked." **[LEGAL — COUNSEL REQUIRED]** on the lawful basis for collecting and retaining Certificates of Good Conduct.

**Data protection, sharpened.** You will hold national IDs, liveness selfies, home addresses, geotagged photographs of people's homes, and reports about their property. **[REC] Provider home addresses and customer property addresses are the most sensitive data in the system.** Address is released only after funding and assignment; evidence photographs of interiors are access-controlled and retained under a documented policy; and the tension between financial-record retention and erasure rights must be resolved in writing with counsel.

**Cross-border.** Diaspora customers mean processing personal data of people in the UK, US, EU and Gulf. **[REC] Confirm the position on inbound customers under UK/EU regimes** — it may be limited, but it should be answered rather than assumed.

### Checklist

**Before first shilling:** incorporation and KRA PIN · **PSP opinion** · **contractor-classification opinion** · **property-representation opinion** · ODPC registration · terms, provider agreement, privacy notice · aggregator contract · **public liability and professional indemnity insurance** · substantiated definitions for every trust badge · incident-response protocol · principal-vs-agent decision documented.

**Before scale:** VAT assessment · trust-account structure · formal data-retention policy · category-specific legal review before each new vertical.

**[REC] Budget KSh 1.2–2.0M for pre-launch legal, tax, compliance and insurance.** **[ASSUMPTION]** — higher than the creator marketplace estimate because the surface is genuinely wider. In a business whose entire proposition is trust, a compliance or safety failure is not a legal problem; it is an extinction event.

# 13 — Metrics and Marketplace KPIs (Brief §55, §56)

## North Star

> ## **Completed, protected transactions per month**
> ### governed by two guardrails: **average job value** and **repeat rate**

**Definition:** transactions reaching `SETTLED` — evidence accepted, customer satisfied, provider paid — in a calendar month.

**[REC] Why this and not GMV.** GMV is distorted by a handful of large jobs and says nothing about whether the marketplace works. A completed protected transaction cannot happen unless a customer trusted you, a provider delivered, evidence satisfied, and money moved. Every failure mode in the business reduces it. And it is legible to everyone from an engineer to an ops associate to a provider.

**[REC] Why the guardrails are mandatory.** Optimising the count alone drives toward small, cheap jobs — precisely the sub-KSh 5,000 categories the strategy excludes. And growth from new customers only is a treadmill.

**The board line, every month:**
> **"N jobs completed, at KSh X average, Y% from returning customers."**

---

## The metric that decides whether this is a company

**[REC] Repeat rate at 90 days.** Your brief says one-off transactions can be manufactured but habit cannot be faked. Correct — and in this business it is *the* number, because **[FACT]** lead-gen marketplaces show repeat rates as low as 15%, Handy struggled to exceed 2:1 LTV:CAC, and TaskRabbit's ~4:1 came from retention.

```
Repeat rate (90d) = customers with ≥2 settled jobs within 90 days
                    ─────────────────────────────────────────────
                        customers with ≥1 settled job
```

**[REC] Targets: >30% by month 3, >40% by month 12.** Below 25% at month 6 means you are running a services agency with an app, and the response is to stop building and find out why.

---

## Core metrics and formulas

### Volume and value
```
GMV                = Σ service_amount of settled transactions
                     ⚠ EXCLUDES materials pass-through
Net revenue        = platform fees − payment costs − refunds
AOV                = GMV / settled transactions
Take rate          = platform fees / GMV
GMV per customer/yr= AOV × jobs/yr × retention        ← the pricing objective
```

### Marketplace health
```
Active providers   = ≥1 accepted job in 30d
Earning providers  = ≥1 SETTLED job in 30d           ← track this, not signups
Provider utilisation = earning providers / verified providers
Fill rate          = jobs assigned & accepted / jobs requested
Time to assignment = median request → provider accepted     target <2h
Time to completion = median funded → settled
Coverage depth     = verified providers per service per ward   target ≥5
```

**[REC] Coverage depth per ward is the density metric that governs expansion.** Below 5, response times slip and the product feels broken locally.

### Trust and quality
```
Completion rate    = settled / funded                        target >92%
First-time-right   = approved without rework / approved      target >85%
Dispute rate       = disputes / funded                        target <3%
Auto-approve rate  = approved by timeout / approved           watch: disengagement
Evidence rejection = evidence returned as insufficient        watch: provider training
Median time to payout = settled_at − approved_at             target <60 min
Safety incidents   = absolute count                          target 0, reviewed individually
```

**[REC] Safety incidents are never a rate.** Report the number and review each one.

### Efficiency
```
Cost to serve  = (ops + support + T&S + payment costs) / settled transactions
                 ← must fall every quarter or Scenario 3 never arrives
CAC per side   = attributable S&M / newly activated customers (or providers)
LTV (customer) = AOV × jobs/yr × years × contribution margin
LTV:CAC        > 3.0 by month 18
Contribution per job = revenue − payment cost − cost to serve   ← positive by month 9
```

---

## The dashboard that should exist

**[REC] Six numbers on one screen. If a seventh is needed, something is wrong.**

```
┌──────────────────────────────────────────────────────────┐
│  Completed jobs (mo)     412      ▲ 18%                  │
│  Average job value       KSh 8,240   ▲ 4%    ⚠ guardrail │
│  Repeat rate (90d)       34%      ▲ 3pt      ⚠ guardrail │
│  ─────────────────────────────────────────────────────   │
│  Contribution per job    KSh 410  ▲                      │
│  Median time to payout   38 min   ✓                      │
│  Disputes                2.1%     ✓     Incidents: 0     │
└──────────────────────────────────────────────────────────┘
```

---

## Vanity metrics to refuse

**[REC] Ban these from internal reporting, however good they look to investors:**

| Metric | Why it misleads |
|---|---|
| Registered providers | Will be 10–20× earning providers. Meaningless. |
| Registered customers | Same. |
| App downloads | No app, and it would not matter. |
| GMV including materials | **Inflates the number with money that is not yours.** |
| Jobs *requested* | Only completed jobs count. |
| Categories live | Breadth is the failure mode, not the achievement. |
| Cities covered | Density beats coverage. |

**[REC] The last two deserve emphasis, because they are exactly the numbers a horizontal-marketplace narrative reaches for** — and celebrating them is how a company talks itself into the strategy that killed its predecessors.

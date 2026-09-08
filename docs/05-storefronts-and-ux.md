# 05 — Storefronts and UX (Brief §15, §32, §45, §46, §47, §52)

## The homepage (Brief §45)

**[REC] One question, examples that teach the taxonomy, and proof. Nothing else above the fold.**

```
┌──────────────────────────────────────────────────────────┐
│   What do you need done?                                 │
│   ┌────────────────────────────────────────────────┐     │
│   │ Describe it, or pick below…                    │ →   │
│   └────────────────────────────────────────────────┘     │
│                                                          │
│   "Inspect an apartment before I pay the deposit"        │
│   "Check on my rental property in Kasarani"              │
│   "Fix a leaking pipe"                                   │
│   "Create 3 TikTok videos for my restaurant"             │
│                                                          │
│   ─────────────────────────────────────────────          │
│   Every job is paid into escrow. Nobody gets paid        │
│   until you confirm the work is done.                    │
│   ✓ ID-verified providers   ✓ M-Pesa   ✓ Full refund     │
│     if the job isn't done                                │
└──────────────────────────────────────────────────────────┘
```

**[REC] Three deliberate choices.** The example prompts are *the* taxonomy-teaching mechanism — a customer who cannot find their need in a category grid will leave, but one who reads four examples understands the platform's range in three seconds. The trust promise sits above the fold because it is the product. And there is **no category grid on the homepage** — categories are for people who already know what they want, and they are one tap away.

**[REC] Do not put "creators" on the homepage.** Vertical 2 is reached through business-oriented entry points and direct storefront links, not the consumer front door. Mixing "inspect my property" with "hire a TikTok creator" in one grid makes the platform look unserious to both audiences.

---

## Service storefronts (Brief §15, §32)

Generalised directly from the creator storefront, which was the strongest idea in the original blueprint.

```
platform.co.ke/@brian-m

┌───────────────────────────────────────────────────────┐
│ [photo]  Brian Mwangi              ✓ ID verified      │
│          Property Verification · Nairobi              │
│          ⭐ 4.9 (63 jobs) · 98% on-time · Replies ~40m │
│          Reliability 94 · Verification competence: 63 │
├───────────────────────────────────────────────────────┤
│ SERVICES                                              │
│ Property inspection + report      KSh 6,000   48h  [Book] │
│ Property viewing on your behalf   KSh 4,500   72h  [Book] │
│ Quarterly property check          KSh 5,500   /visit [Book]│
│ Document collection & courier     KSh 3,500   48h  [Book] │
├───────────────────────────────────────────────────────┤
│ SAMPLE REPORT  [view a redacted real report ▸]        │
├───────────────────────────────────────────────────────┤
│ COVERAGE  Kilimani · Kileleshwa · Lavington · Westlands│
│ RECENT    "Saved me from a fake agent." — J.K., London │
└───────────────────────────────────────────────────────┘
```

**[REC] Four things this must do that the creator version did not:**

1. **Show the sample deliverable.** For a creator the portfolio *is* the proof. For a verifier, the equivalent is a **redacted real inspection report**. A customer who reads one understands the value instantly and stops price-shopping. This is the single highest-converting element on the page.
2. **Show coverage area, not just city.** Travel time is the constraint that determines whether a booking is realistic.
3. **Separate Reliability from Competence.** Displaying one blended score would imply Brian can rewire a socket. He cannot. (`06`)
4. **Never show "0 jobs" nakedly for a new provider.** Show what has been verified instead: *"ID verified · Trained & assessed · Platform-guaranteed."* Cold start is a design problem, not just an algorithm problem.

**[REC] The storefront remains a distribution channel, exactly as before.** A provider who shares `platform.co.ke/@brian-m` in a WhatsApp status, a diaspora Facebook group or a Google Business Profile is saying *"book me safely"* — and acquiring your demand for you. **[REC] This is the cheapest customer acquisition available and it should be instrumented from day one:** every storefront gets a share sheet, a QR code, and an attribution parameter.

---

## The two promises (Brief §46, §47)

**[REC] Use these as the literal information architecture, not just marketing.** Each stage is a screen and a state.

### Customer
```
FIND        Describe it, or pick a service.        → matched, priced, available
TRUST       See who they are and what they've done. → verification + history
PAY         Money held safely until you confirm.    → escrow, visible
GET IT DONE Track it. See the evidence.             → live status + proof
REPEAT      Book them again in one tap.             → rebook
```

### Provider
```
GET CUSTOMERS   A profile people can book directly
GET PAID        Escrowed before you start. M-Pesa within the hour.
BUILD STANDING  Every completed job is a verified record
GROW            Repeat customers, higher-value work, better placement
```

**[REC] "Escrowed before you start" is the recruitment line.** **[FACT]** Lynk found customers unfairly mistrusted tradespeople; the mirror of that is that tradespeople are routinely not paid. A provider who can see the money is already held has a reason to prefer you that no competitor in Kenya is currently offering him.

---

## Customer navigation

`Home (what do you need?) · My jobs · Messages · Payments · Profile`

**[REC] "My jobs" is the retention surface, not "Explore."** In a services marketplace the returning user is checking on work, not browsing. Put live job status first, completed jobs (with one-tap rebook) second, and discovery third.

---

## Provider navigation

`Today · Opportunities · Jobs · Earnings · Profile`

**[REC] "Today" first.** A provider opens the app to answer one question: *what do I have on right now, and where do I need to be?* **[REC] And "Earnings" must show pending, in-escrow and paid separately** — visible escrowed money is the single most reassuring thing in the provider experience.

**[REC] Design the provider app for a mid-range Android on patchy data.** Offline-tolerant evidence capture with background upload is not a nicety: a provider standing in a basement with no signal must be able to complete a job and have it sync later. **[FACT]** SweepSouth's Kenya failure was attributed partly to slow, unstable technology in new markets — provider-side reliability is where that shows first.

---

## Productised outcomes (Brief §17, generalised)

The Campaign-in-a-Box idea, generalised. **[REC] Sell outcomes with names, prices and inclusions — never "browse providers."**

| Vertical | Product | Price | Inclusions |
|---|---|---|---|
| **Verification** | **Know Before You Pay** | KSh 6,000 | Inspection, 20+ geotagged photos, video walkthrough, 12-point checklist, 48h report |
| Verification | Viewed For You | KSh 4,500 | Attend viewing, video call you in live, report |
| Verification | Landlord's Quarterly Check | KSh 5,500/visit | Condition check, meter readings, tenant confirmation, photo set |
| Fundi | Fix My Leak | KSh 3,500 | Diagnosis, repair, parts to KSh 800, 30-day guarantee |
| Fundi | Paint My 1-Bed | KSh 22,000 | Prep, 2 coats, paint included, 2 days, guarantee |
| Business | 3 TikToks for My Business | KSh 13,000 | 3 videos, 1 revision, 90-day ad rights |

**[ASSUMPTION] Every price above is a placeholder to be validated in week one.** They are shaped to clear the KSh 5,000 line, which is their only defensible property today.

---

## The rebook mechanic (Brief §25)

**[REC] The second transaction must be the easiest thing in the product.** After completion:

```
✅ Job complete. KSh 6,000 released to Brian.
   [Book Brian again]   [Book this service again]   [Set up quarterly]
```

**[REC] "Set up quarterly" is the highest-value button in the application.** It converts a one-off into a recurring series, which is the difference between a transaction business and a retention business (`08`). Offer it at the exact moment of maximum satisfaction — immediately after a job the customer is happy with — and never by email a week later.

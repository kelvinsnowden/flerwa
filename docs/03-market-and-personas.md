# 03 — Market Opportunity and Personas (Brief §6, §7, §8)

## The market, sized honestly

**[REC] Refuse to produce a TAM number you cannot defend.** There is no credible published figure for "Kenyan trusted-services spend," and manufacturing one from population × arbitrary spend is the kind of slide that ends diligence. What follows is what is actually knowable.

**[FACT] Anchors that are real:**

| Anchor | Value | Source |
|---|---|---|
| Kenya diaspora remittances | **US$5.04B (2025); US$4.96B 12mo to Jun 2026; CBK projects US$5.24B (2026)** | CBK via Business Daily / The Star |
| Kenya internet users | 23.4M (40.5%) end-2025 | DataReportal |
| Domestic workers in Kenya | **>2 million**, mostly informal, verbal agreements | Kudheiha / press |
| Gazetted domestic-worker minimum wage | **KSh 18,047/month** (Nairobi, Mombasa, Kisumu, Nakuru, Eldoret); KSh 9,268 smaller towns | Daily Nation |
| Kenya digital advertising | US$95.5M (2024) → US$119.4M (2028) | Statista |
| Kenya influencer advertising | US$2.1M (2024) → US$3.0M (2028) | Statista |

**[ASSUMPTION] What these anchors imply.** The remittance figure is *not* a services TAM — it is overwhelmingly household support, education and property. But it establishes two things that are strategically decisive: a large population of Kenyans who **routinely move significant money into Kenya from a distance**, and an existing habit of **paying for outcomes they cannot personally verify**. The share of that flow that would attach to a paid verification or representation service is unknown and must be measured, not modelled.

**[REC] The one number to go and get in the first 30 days:** *what will a diaspora Kenyan pay, today, for a verified stranger to inspect a property and produce an evidenced report before they send a deposit?* Twenty conversations answers it. No amount of desk research will.

---

## Customer personas

### P1 — The Remote Principal *(launch customer)*

> **Wanjiru, 38, nurse in Manchester.** Sends money home monthly. Is buying a plot in Kitengela from a developer she found on Facebook. Has been shown photos she cannot verify. Her cousin "checked it out" and was vague. She has read about diaspora land scams and is frightened but proceeding anyway because she has been saving for six years.

- **Job to be done:** *"Tell me the truth about something I cannot see, before I send money I cannot get back."*
- **Willingness to pay:** **[ASSUMPTION] High** — she is contemplating a six-figure-shilling transfer; a KSh 6,000 inspection is rounding error insurance. This is the core assumption of the whole strategy and must be tested first.
- **Frequency:** Low as a buyer (2–4/year), **higher once she owns property** (tenant vetting, rent oversight, quarterly checks, repairs supervision).
- **Why she cannot disintermediate:** she has no trusted local network — that is the entire reason she is here. Her existing network is the failure mode.
- **Where she is:** UK, US, Canada, Gulf states. Concentrated in diaspora WhatsApp groups, SACCOs, church networks, investment chamas.

### P2 — The Upcountry Principal

> **Kiprop, 51, farmer in Eldoret.** Daughter is at university in Nairobi. Owns a rental flat in Kasarani managed by a caretaker he does not fully trust. Travels to Nairobi twice a year and dreads it.

Same job, domestic version, lower price point, **[ASSUMPTION]** larger population, harder to reach. **[REC] Serve second — the diaspora segment has higher willingness to pay and better channel concentration.**

### P3 — The Nairobi Householder *(the obvious customer — deprioritised)*

> **Mercy, 34, Kilimani.** Needs her sink fixed and her apartment painted. Currently asks the estate WhatsApp group.

- **Job:** *"Find me a fundi who won't overcharge me, botch it, or vanish with the materials money."*
- **[REC] Real customer, genuine pain, but she is Vertical 3.** Her repair jobs clear the KSh 5,000 line; her cleaning and errands do not. Serve her for fundi work once trust operations are proven — not at launch.

### P4 — The SME Owner *(Vertical 2 — the existing blueprint)*

> **Otieno, 41, restaurant in Westlands.** Needs content, photography, occasional creators.
Fully specified in `archive-creator-marketplace/`. High AOV, digital delivery, recurring need.

### P5 — The Property-Owning Landlord

> **Njeri, 46, owns three rental units across Nairobi.** Needs tenant vetting, viewings conducted, repairs supervised, deposits verified.
**[REC] The bridge persona.** She is local, recurring, high-value, and buys exactly the same service catalogue as P1. Onboarding her makes the supply pool busy between diaspora jobs.

---

## Provider personas

### S1 — The Verifier / Local Agent *(launch supply)*

> **Brian, 29, Nairobi.** Diploma-educated, underemployed, smartphone with decent camera, moves around the city, writes clearly, wants professional work.

- **Why this supply is easier than fundis:** the core competencies are **integrity, observation, documentation and communication** — assessable in an interview and a paid trial, not requiring a trade qualification or an academy. **[FACT]** Lynk's cost centre was vetting and training tradespeople; this pool sidesteps most of it.
- **Why it is harder:** you are placing him in an **agency relationship near money**. A dishonest inspector who takes KSh 20,000 from a seller to write a clean report destroys a KSh 500,000 customer outcome. **This is the central supply risk and it is addressed in `06`.**
- **[REC] Small, deeply vetted, well-paid, heavily monitored pool. Do not scale this supply quickly.** Quality here is the product.

### S2 — The Fundi

> **Kamau, 36, plumber, Kasarani.** Skilled, no formal certification, gets work by referral and WhatsApp, is periodically stiffed by customers, occasionally accused of overcharging.

**[FACT] Note the symmetry Lynk discovered:** he is also a victim of the trust deficit — customers of higher social class assume he is cheating. **[REC] The provider-protection story (agreed scope, escrowed funds so he knows he'll be paid, evidenced completion, a neutral dispute process) is as strong a recruitment message as customer acquisition.**

### S3 — The Creator / Digital Professional
Fully specified in the archive. Digitally native, portfolio-assessable, remote-deliverable.

### S4 — The Domestic Worker
**[REC] Explicitly out of scope.** **[FACT]** Gazetted minimum wage of KSh 18,047/month; >2M workers, largely informal. **[LEGAL — COUNSEL REQUIRED]** placement and platform-mediated domestic work carry employment-classification and labour-law exposure materially different from booking a tradesperson. This is a deliberate exclusion, not an oversight.

---

## The demand-side insight that should shape the product

**[REC]** Across P1, P2, P3 and P5, the customer is never really buying a service. They are buying **the removal of a specific fear**:

| Persona | The fear |
|---|---|
| Remote principal | "I will send money and there will be nothing there." |
| Upcountry principal | "I am being quietly robbed and cannot check." |
| Householder | "He will overcharge me, or take the materials money and disappear." |
| Landlord | "My caretaker is lying to me." |
| SME owner | "I will pay and get nothing usable." |

**Sell against the fear, not the category.** *"Know before you pay"* is a stronger proposition than *"book a property inspector."* This is also why the homepage in `05` leads with a question, not a taxonomy.

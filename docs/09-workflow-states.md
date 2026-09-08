# Part 12 — The Complete Campaign Workflow

## Two state machines, not one

**[REC]** The most common modelling error here is a single status field on a campaign. It cannot represent a campaign where 8 of 15 creators have delivered. Separate them:

```
CAMPAIGN  — the brand's demand object (1 brand : N collaborations)
COLLABORATION — one brand-creator contract (its own money, its own state)
```

A campaign is `ACTIVE` while its collaborations independently move through their lifecycles. All money, all reputation, all disputes attach to the **collaboration**.

---

## Campaign states

```
DRAFT ──► PENDING_REVIEW ──► OPEN ──► FILLING ──► FULL ──► IN_PROGRESS ──► COMPLETED
  │             │              │                                              │
  │             ▼              ▼                                              ▼
  └────────► REJECTED      CANCELLED                                       ARCHIVED
                               ▲
                          EXPIRED (deadline passed, unfilled)
```

| State | Meaning | Key transitions |
|---|---|---|
| `DRAFT` | Being composed | → PENDING_REVIEW on submit |
| `PENDING_REVIEW` | Moderation queue | **[REC]** Manual for first 90 days, then risk-scored. Auto-approve trusted brands. |
| `OPEN` | Live, accepting applications | → FILLING on first acceptance |
| `FILLING` | Some slots filled | → FULL when all filled |
| `FULL` | All slots filled | → IN_PROGRESS when all funded |
| `IN_PROGRESS` | Work underway | → COMPLETED when all collaborations terminal |
| `EXPIRED` | Deadline passed, unfilled | **[REC]** Auto-refund unallocated escrow immediately |
| `CANCELLED` | Brand cancelled | Per-collaboration cancellation rules apply |

**[REC] Moderation is not optional at launch.** The first fraudulent or abusive campaign to reach creators does disproportionate reputational damage in a market where WhatsApp groups spread news in minutes. Review every campaign manually until you have enough volume to risk-score, and treat it as a cost of trust, not overhead.

---

## Collaboration states — the core state machine

```
                    ┌──────────────────────────────────────────┐
                    │            APPLICATION PHASE             │
                    └──────────────────────────────────────────┘
  INVITED ─────┐
               ├──► APPLIED ──► SHORTLISTED ──► ACCEPTED ──► AWAITING_FUNDING
  DISCOVERED ──┘        │             │                            │
                        ▼             ▼                            ▼
                    DECLINED      NOT_SELECTED                  FUNDED
                                                                   │
                    ┌──────────────────────────────────────────┐   │
                    │           FULFILMENT PHASE               │   │
                    └──────────────────────────────────────────┘   │
                                                                   ▼
   BRIEFED ──► [PRODUCT_DISPATCHED ──► PRODUCT_DELIVERED]  (seeding)
      │        [VISIT_BOOKED ──► CHECKED_IN ──► VISIT_COMPLETE] (visits)
      ▼
   IN_PRODUCTION ──► DRAFT_SUBMITTED ──► IN_REVIEW
                            ▲                 │
                            │                 ├──► REVISION_REQUESTED ──┐
                            └─────────────────┘                        │
                                              │                        │
                                              ▼                        │
                                          APPROVED ◄──────────────────-┘
                                              │
                    ┌──────────────────────────────────────────┐
                    │          PUBLICATION PHASE               │
                    └──────────────────────────────────────────┘
                                              │
                          ┌───────────────────┴──────────────┐
                          ▼                                  ▼
                    PENDING_PUBLICATION              (no publishing required)
                          │                                  │
                          ▼                                  │
                     PUBLISHED                               │
                          │                                  │
                          ▼                                  │
                   PROOF_SUBMITTED                           │
                          │                                  │
                          ▼                                  │
                   PROOF_VERIFIED ──────────────────────────►│
                                                             ▼
                                                      PAYMENT_RELEASED
                                                             │
                                                             ▼
                                                        SETTLED
                                                             │
                                                             ▼
                                                      REVIEW_PENDING
                                                             │
                                                             ▼
                                                        COMPLETED

  Terminal exceptions from any state:
    CANCELLED_BY_BRAND · CANCELLED_BY_CREATOR · EXPIRED · DISPUTED · REFUNDED
```

---

## Every state, defined

### Application phase

| State | Entry | Exit | Timer | Money |
|---|---|---|---|---|
| `INVITED` | Brand invites directly | Creator accepts/declines | **72h** → auto-decline | None |
| `APPLIED` | Creator applies with pitch | Brand shortlists/rejects | **7d** → auto-expire | None |
| `SHORTLISTED` | Brand shortlists | Brand accepts/rejects | 5d | None |
| `ACCEPTED` | Brand accepts creator | Funding | **48h** → auto-cancel | None |
| `AWAITING_FUNDING` | Contract formed | Escrow funded | **48h** → cancel + brand penalty | Pending |
| `FUNDED` | Escrow confirmed | Brief released | Immediate | **Held** |

**[REC] `AWAITING_FUNDING` is where marketplaces quietly bleed creators.** A brand that accepts and does not fund has wasted a creator's time and hope. Enforce the 48-hour timer strictly and count non-funding against the brand's trust score. Two failures should suspend campaign posting.

### Fulfilment phase

| State | Notes |
|---|---|
| `BRIEFED` | Full brief + logistics released. **The delivery clock starts here.** |
| `PRODUCT_DISPATCHED` | Seeding only. Tracking attached. |
| `PRODUCT_DELIVERED` | **Content deadline starts HERE, not at BRIEFED.** Non-delivery within SLA → auto-cancel, no creator fault. |
| `VISIT_BOOKED` | Visits only. Slot reserved, capacity decremented. |
| `CHECKED_IN` | QR scan at venue. **Travel stipend releases here** if applicable. |
| `VISIT_COMPLETE` | Content deadline starts. |
| `IN_PRODUCTION` | Creator working. Reminders at 50% and 80% of the window. |
| `DRAFT_SUBMITTED` | Files uploaded. **Brand review clock starts (5 days to auto-approve).** |
| `IN_REVIEW` | Brand reviewing. |
| `REVISION_REQUESTED` | Must cite a specific brief requirement. Counts against the limit. Deadline extends by the agreed revision window. |
| `APPROVED` | Brand approves, **or** 5-day silence triggers auto-approval. |

### Publication phase

| State | Notes |
|---|---|
| `PENDING_PUBLICATION` | Creator must post. Publication window begins. |
| `PUBLISHED` | Creator posts. |
| `PROOF_SUBMITTED` | URL and/or API verification. |
| `PROOF_VERIFIED` | Automated where API allows; manual fallback. **[REC]** Also schedules the **live-duration monitor** — re-check at day 7 and day 30 to catch early deletion. |
| `PAYMENT_RELEASED` | B2C instruction issued. |
| `SETTLED` | M-Pesa confirmed. **[REC] Target median under 60 minutes from APPROVED.** |
| `REVIEW_PENDING` | Both parties prompted. **Double-blind:** reviews reveal on mutual submission or at 14 days. |
| `COMPLETED` | Terminal. Reputation events written to the ledger. |

---

## The timers, in one table

**[REC] These are the most important product decisions in the entire workflow.** Each one converts a human failure into a deterministic, fair outcome — and every one of them prevents a dispute rather than resolving it.

| Timer | Duration | On expiry | Protects |
|---|---|---|---|
| Invitation response | 72h | Auto-decline | Brand |
| Application review | 7d | Auto-expire | Creator |
| Acceptance → funding | 48h | Cancel + brand penalty | **Creator** |
| Brief → draft | Per campaign | Late flag, then default | Brand |
| **Draft → brand decision** | **5d** | **AUTO-APPROVE + RELEASE** | **Creator** |
| Revision turnaround | 48h default | Late flag | Brand |
| Approval → publication | 72h default | Breach process | Brand |
| Publication → proof | 24h | Reminder, then flag | Brand |
| Approval → payout | **<60 min target** | Escalation alert | **Creator** |
| Review window | 14d | Reviews reveal | Both |
| **Escrow maximum life** | **60d** | **Force-resolve** | **Compliance** |
| Minimum live duration | 30d default | Breach + clawback | Brand |

**[REC] If you implement only one thing from this document, implement the 5-day auto-approve.** It is the structural counterweight to escrow. Escrow protects the brand from a creator who vanishes; auto-approve protects the creator from a brand that goes quiet. A marketplace with only the first is trusted by only one side — and the side it fails is the side you cannot buy.

---

## Every state emits an event

**[REC]** Append-only event log from commit one. This is not infrastructure indulgence — it is what makes disputes adjudicable, reputation auditable, analytics possible, and the AI training set real.

```json
{
  "event_id": "uuid",
  "collaboration_id": "uuid",
  "type": "DRAFT_SUBMITTED",
  "actor": {"type": "creator", "id": "uuid"},
  "at": "2026-09-12T14:32:11Z",
  "from_state": "IN_PRODUCTION",
  "to_state": "DRAFT_SUBMITTED",
  "payload": {"asset_ids": ["..."], "hours_before_deadline": 6.2},
  "idempotency_key": "..."
}
```

Every reputation metric, every dispute determination, and every analytics number is **derived from this log**, never stored as a mutable field. When a creator disputes their on-time rate, you can reconstruct it exactly. When you change the reputation formula, you can recompute history. When you train a ranking model, the labels already exist.

**[REC] This is the single highest-leverage architectural decision in the codebase, and it is nearly free if made on day one and extremely expensive if made in month eighteen.**

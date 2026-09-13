# Marketplace Definition of Done

The closing document in this program. Defines what "done" means for this
entire remediation effort, and doubles as the practical execution backlog
the founding brief's §26 asks for — the register
(`MARKETPLACE_REMEDIATION_REGISTER.md`) already carries every field that
section requires (ID, title/problem statement, affected files/components,
domain, priority, dependencies, acceptance criteria via "Definition of
done"/"Evidence required for closure", test plan, external access needs,
status); this document adds the suggested implementation order across the
whole register, and the per-domain and program-level completion criteria.

## 1. What "done" means, generally

Per the founding brief's own repeated instruction: **no item is done
because a recommendation was written.** An item in the register is only
"Verified" when:

1. Code exists implementing the recommended solution, **and**
2. A specific test (automated, or a role-simulated live-DB check following
   this project's established pattern, or a documented manual click-through)
   was actually run and passed, **and**
3. The evidence for #2 is attached to the register entry (a citation to a
   commit, a test-run log, or a documented live-verification result — the
   same evidentiary standard every claim in `SECURITY.md` and
   `MARKETPLACE_SCALE_READINESS_AUDIT.md` already holds itself to).

"Implemented" (code exists, not yet tested) and "Verified" (tested and
passed) are different statuses for a reason — conflating them is exactly
the failure mode the founding brief warns against.

## 2. Program-level definition of done, by phase

Reproduced from `MARKETPLACE_REMEDIATION_MASTER_PLAN.md` §25 for
completeness, with the evidence standard made explicit per item:

### Phase 0 exit criteria (all must be Verified, not merely Implemented)

1. SEC-001 — a real CI run, passing, covering the financial/authz RPCs.
2. PAY-004/OPS-005 — a demoed dual-control flow, tested with two real
   distinct admin accounts.
3. TXN-004 — a populated `sla_deadline` column plus a scheduled sweep,
   observed firing correctly in at least one test case.
4. OPS-001 — a live demo of the transaction-detail view against a real
   (test) transaction with a non-trivial history (funded, disputed,
   resolved).
5. PAY-006 — a scheduled reconciliation job, observed running and
   correctly flagging a deliberately-introduced imbalance in a test
   scenario, then correctly reporting balanced on the next clean run.
6. TSF-014 (category pause, minimum viable) — a demoed toggle that
   actually prevents new bookings in a paused category.
7. LEGAL-001/002/003 — signed, dated legal opinions on file (not merely
   "commissioned").
8. TSF-013 — a written, founder-reviewed incident-response protocol.
9. SEC-002 — a live test showing the EICAR test file is caught and
   blocked.
10. DR-001 — a completed, timed restore test with a written report.

### Phase 1 exit criteria

One complete, real transaction lifecycle executed in a staging environment
(created via DR-001's restore test) with a synthetic customer and provider:
request → quote → accept → fund (sandbox) → check-in → evidence → a
deliberately-triggered dispute → resolution via the admin UI (not raw SQL)
→ settlement → review. Every step's outcome recorded against the
corresponding register item.

### Phase 2 exit criteria

Staging environment used for every migration in the phase (not just
created once and ignored); SEC-007's RLS optimization advisor re-run shows
0 remaining `auth_rls_initplan`/`multiple_permissive_policies` findings, or
each remainder is explicitly justified in writing; at least one category
achieves `docs/14`'s density bar (≥5 verified providers, <24h availability)
in one launch corridor, evidenced by a LIQ-001 dashboard query, not an
estimate.

### Phase 3 exit criteria

A written load-test report per `MARKETPLACE_LOAD_TESTING_PLAN.md` §7,
covering all 5 staged VU levels, with every pass/fail criterion evaluated
and attached as raw data — not a summary claim. Infra plan limits (PERF-001)
confirmed, not assumed. A disaster-recovery drill executed and timed
(distinct from the initial restore test — this one under simulated real
conditions, e.g. during a scheduled low-traffic window with the team
treating it as a real incident).

### Phase 4

Not defined in detail by this program — depends on Phase 0–3 evidence and
on category-level unit economics (`docs/10`) actually clearing founder-set
thresholds, which is out of engineering's control to declare done.

## 3. Domain-level definition of done

| Domain | Done when |
|---|---|
| Security | Every SEC-* item Verified; `SECURITY.md` and this document's security appendix both current; no outstanding P0/P1 finding older than its own stated urgency |
| Payments | Every PAY-* item Verified; ledger self-consistency job green for 30 consecutive days before declaring the reconciliation system trustworthy |
| Trust & Safety | TSF-001 through TSF-014 Verified; the fraud-threat table in `MARKETPLACE_TRUST_AND_SAFETY_PLAN.md` §3 shows every threat with at least a "Partially implemented" status, none remaining fully "Not implemented" |
| Provider Quality | PROV-001 (tiered model) Verified and in active use for at least 5 real providers |
| Liquidity | LIQ-001 dashboard live and reviewed weekly; at least one category meets the density bar |
| Operations | OPS-001/002 Verified; a real support agent (not an engineer) has successfully resolved a real (or realistic synthetic) transaction issue using only the admin UI |
| Legal | Every LEGAL-* item has a named owner and either a completed opinion/registration or an explicit, dated decision to defer with reasoning recorded |
| Disaster Recovery | DR-001 through DR-005 Verified; RPO/RTO ratified and met in the drill |
| Analytics | The 4 computable-today dashboard numbers live; funnel events wired for at least the customer-side funnel |
| Load Testing | The full staged report exists per §2's Phase 3 criteria |
| Release Engineering | The checklist in `MARKETPLACE_RELEASE_AND_ROLLBACK_PLAN.md` §3 has been used for at least 5 consecutive real releases |

## 4. First 10 tasks to execute (suggested implementation order across the whole register)

Cross-domain, dependency-ordered, chosen for maximum safety gained per unit
of effort — not simply "all P0s first," since several P0s (legal opinions,
insurance, staffing decisions) are not engineering-sequenceable at all and
belong to the founder's own track, running in parallel from day one rather
than gating engineering's first 10:

1. **PAY-006** — ledger self-consistency job. No dependencies, buildable
   today, highest financial-safety value per hour of engineering.
2. **SEC-003** — enable Dependabot. Zero cost.
3. **Read `rpc_cancel_booking` in full** (closes TXN-005/PAY-009
   Investigating status) — a pure investigation task, cheap, unblocks
   downstream scoping.
4. **TXN-003** — read the 5 remaining state-transition RPCs for lock
   discipline. Same rationale as #3.
5. **SEC-010** — PII-in-logs grep-and-review pass. Cheap, no dependencies.
6. **TSF-013** — write the incident-response protocol. Zero engineering
   cost; needs founder time, not developer time — run in parallel with 1–5.
7. **OPS-001** — the transaction-detail admin view. No schema changes,
   highest support-capability gain available.
8. **TXN-004** — dispute `sla_deadline` column + sweep. Follows the
   already-proven cron pattern exactly.
9. **TSF-014's category-pause toggle** — the column already exists; this
   is a small, high-value admin UI addition.
10. **Begin SEC-001** — stand up the test runner and port the first batch
    of already-documented manual verifications (the 9 messaging checks from
    `SECURITY.md` are a natural, self-contained first milestone) into
    executable tests.

Everything else in the register follows the phase ordering in §2 above,
adjusted as real findings from tasks 1–10 change what's known.

## 5. Evidence required to declare the platform ready for real transactions

Not "ready for 5,000 users" (that requires the full Phase 3 evidence) —
specifically, ready to accept the **first real transaction** with real
money:

- [ ] Phase 0 exit criteria (§2) fully met and Verified.
- [ ] At least PAY-001's business decision made (which aggregator) and a
  real sandbox integration tested end-to-end, including a deliberate
  webhook-retry test proving the idempotency work holds under a real
  (sandbox) provider, not just synthetic test payloads.
- [ ] LEGAL-001/002/003 opinions received (not just commissioned).
- [ ] LEGAL-006 (insurance) confirmed in place.
- [ ] LEGAL-005 (published terms/privacy notice) live.
- [ ] TSF-013 protocol written and at least one person is actually
  reachable per it.
- [ ] At least one real, vetted provider onboarded through whatever tier
  of PROV-001 is live by then.

This list is deliberately short and strict — it is the actual gate, not an
aspiration.

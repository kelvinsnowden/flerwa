# Marketplace Disaster Recovery Plan

Companion to the register's `DR-*` items. Per the founding brief: **do not
claim backups are sufficient until restore tests have actually been
performed.** No restore has been performed in this project's history —
this is stated as the headline finding, not buried.

## 1. Current state, honestly

| Capability | Status |
|---|---|
| Automated backups | **Assumption** — Supabase provides these by plan tier; exact tier/retention/frequency for this project: Blocked — external access |
| Restore tested | **Missing** — never performed |
| RPO defined | **Missing** |
| RTO defined | **Missing** |
| Outage runbooks (Supabase/Vercel/payment provider/Realtime/email/SMS/DNS) | **Missing** — none written |
| Incident severity levels | **Missing** |
| On-call ownership | **Missing** — no team large enough yet to need a rotation, but the *decision* of who is reachable in an emergency is still unmade |
| Read-only/degraded mode | **Missing** |
| Emergency transaction pause | **Missing** — same item as register TSF-014 |
| Post-incident review process | **Missing** |

## 2. Outage scenarios and required behavior, per the founding brief's list

| Scenario | Current behavior | Required behavior |
|---|---|---|
| Supabase outage | Entire app fails (every page is server-rendered against Supabase, `ƒ` dynamic throughout — Confirmed, code, `MARKETPLACE_SCALE_READINESS_AUDIT.md`) | A maintenance-mode static page at minimum; no code exists for this today |
| Vercel outage | Total outage — no fallback hosting | Out of scope to mitigate at this stage (multi-host failover is Phase 4+ complexity); documented as an accepted risk, not silently ignored |
| Payment provider outage | Not yet reachable (no live provider) | `rpc_ingest_payment_event`'s existing "record what you can, don't silently drop" pattern is the right foundation; needs a reconciliation-exception sweep (PAY-003) to surface stuck payments once live |
| Realtime outage | Messaging falls back to server-rendered-only, degraded but functional (Confirmed, code — `message-thread.tsx`'s own comment states this design intent) — **the one scenario already handled correctly** | No further action needed beyond MSG-003's UX polish (a visible "delayed" indicator) |
| Email/SMS/WhatsApp outage | N/A — no channel exists yet (NOTIF-001/002) | Design requirement for whichever channel is built: never block the underlying action (already the stated principle, confirmed safe for the one channel that does exist — in-app notifications, NOTIF-003) |
| DNS/domain outage | Not assessed this pass | Requires confirming domain registrar/DNS provider and its own redundancy — Blocked — external access |
| Database performance degradation | Partially mitigated by the prior session's RLS/index/pagination work | Ongoing — SEC-007's remaining RLS optimization continues this |
| Failed migration | No rollback strategy documented beyond "forward-fix" implicit convention | See `MARKETPLACE_RELEASE_AND_ROLLBACK_PLAN.md` |
| Corrupt data / accidental deletion | Append-only tables (`ledger_entries`, `transaction_events`, `admin_actions`) are structurally resistant; everything else depends entirely on backup/restore (DR-001, untested) | Restore test is the only way to know the real answer here |
| Credential compromise / secret leakage | No rotation procedure documented (SEC-006) | See Security plan |
| Webhook delivery interruption | Idempotent ingestion already tolerates late/duplicate delivery (Confirmed, prior session) — a *total* interruption (provider never retries) has no detection | PAY-003 |
| Queue failure | No queue infrastructure exists beyond the 2 cron routes; `scheduler_runs` gives visibility into whether the auto-approve sweep ran (Confirmed, code) — nothing else is monitored this way | Extend the same `scheduler_runs` pattern to any future scheduled job |
| Regional connectivity problems (Kenya-specific) | Not assessed — depends on Vercel's edge network reach, not something this codebase controls | Blocked — external access |

## 3. RPO/RTO — proposed defaults, pending founder decision

Not decided by this document — genuinely a business decision (register
decision #9-adjacent, and its own line item DR-002). Proposed starting
point for discussion, not a ratified target: **RPO 24 hours** (matches a
plausible daily-backup cadence, to be confirmed against actual Supabase plan
capability), **RTO 4 hours** for a full outage. These numbers should be
revisited once real transaction volume exists and the cost of an hour of
downtime is a known, not estimated, quantity.

## 4. The restore test — the single most important action item in this document

**Procedure (to be executed, not just planned):**
1. Confirm the current Supabase plan's backup retention/frequency
   (dashboard access required — Blocked — external access until performed).
2. Create a new, throwaway Supabase project.
3. Restore the most recent backup into it (via Supabase's own restore
   tooling, or `pg_dump`/`pg_restore` if point-in-time recovery isn't
   available on the current plan).
4. Point a local/preview instance of the app at the restored project.
5. Verify: can a user log in, does RLS still function correctly (spot-check
   2–3 of the role-simulated tests from `SECURITY.md`), does the schema
   match migration history exactly (`supabase migration list` /
   `list_migrations` against both).
6. Time the whole procedure — that measured time becomes the evidence-based
   RTO, replacing the proposed default in §3.
7. Tear down the throwaway project.
8. Write up what was learned, including anything that didn't restore
   cleanly.

This should double as the creation of the staging environment (REL-002) —
the same throwaway project, kept rather than torn down, becomes the
permanent staging environment if the founder approves the ongoing cost
(register decision #9).

## 5. Incident severity and escalation — a starting framework

Proposed (needs founder ratification, not unilaterally adopted):

| Severity | Definition | Response |
|---|---|---|
| SEV1 | Money is moving incorrectly, or a safety incident is in progress | Founder notified immediately, regardless of time |
| SEV2 | Core booking/payment flow is down for all users | Notified within 1 hour |
| SEV3 | A single feature is degraded (e.g. messaging Realtime down but DB functional) | Next business day acceptable |
| SEV4 | Cosmetic/non-blocking | Normal backlog |

## 6. Post-incident review

**Missing** — no template or process exists. Recommend a short, blameless
write-up per incident: what happened, when detected, when resolved, root
cause, what prevents recurrence, filed as a new register item if it
surfaces a gap not already tracked.

## 7. Recommended sequencing

1. Perform the restore test (§4) — this is both a DR deliverable and the
   cheapest path to a real staging environment (REL-002/LOADTEST-001).
2. Ratify RPO/RTO and severity levels with the founder (§3, §5).
3. Write the outage runbooks for the two scenarios most likely to actually
   occur at this stage (Supabase degradation, Realtime outage) — skip
   speculative runbooks for scenarios with no live dependency yet (payment
   provider, email/SMS).
4. Build the read-only/degraded-mode capability, sharing implementation
   with TSF-014's emergency pause control rather than as a separate system.

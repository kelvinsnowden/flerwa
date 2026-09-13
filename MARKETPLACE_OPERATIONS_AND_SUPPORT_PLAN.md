# Marketplace Operations and Support Plan

Companion to the register's `OPS-*` items.

## 1. Can the internal team actually operate this marketplace today?

**No, not without direct database access.** This is stated plainly because
it is the honest answer, not a hedge. Confirmed admin surfaces that exist
today (**Confirmed, code**): `/admin` (overview stats), `/admin/verifications`,
`/admin/disputes`, `/admin/payments`, `/admin/deal-desk`, `/admin/transactions`,
`/admin/integrations`. What a support agent cannot do through any of these
screens: see one transaction's complete cross-table history in one place
(OPS-001), repair a stuck transaction outside the two narrow existing RPCs
(OPS-002), triage a fraud or safety report (doesn't exist — TSF-007/008),
or act with anything less than full admin power (OPS-004 — there is no
lesser role).

## 2. Required queues, current state

| Queue | Exists? | Notes |
|---|---|---|
| Verification | Yes — `/admin/verifications` | Confirmed, code |
| Disputes | Yes — `/admin/disputes` | Confirmed, code; verified live in prior session |
| Payment exceptions | No | PAY-003 dependency (reconciliation must exist first to produce exceptions) |
| Fraud | No | TSF-008 |
| Safety incidents | No | TSF-012/013 |
| Refunds | Folded into disputes today | PAY-009 — no independent refund queue |
| Payouts | No | Doesn't exist as a feature yet (PAY-001 dependency) |
| Failed notifications | No | NOTIF-001 dependency (no notification channel to fail yet, beyond in-app) |
| Failed jobs | No | No background-job infrastructure beyond the 2 existing cron routes |
| Unmatched demand | No | LIQ-003 |
| Escalations | No | OPS-006 |

## 3. Role-based access — current state and target

**Current (Confirmed, code):** `profiles.role = 'admin'` is a single flag;
every admin RPC and every `/admin/*` page checks the same `is_admin()`
boolean. There is no distinction between customer support, provider
operations, verification, trust & safety, finance, disputes, moderation,
engineering, and superadmin.

**Target (register OPS-004):** introduce named roles. Two implementation
options, tradeoffs stated plainly:

1. **Extend `profiles.role`'s enum** with the new named values, keep
   `is_admin()` as "any of the admin-family roles" for backward
   compatibility with every existing RLS policy that only needs a yes/no
   answer, and add narrower checks (e.g. `is_finance_admin()`) only where a
   specific action needs restricting (payment confirmation, ban actions).
   **Recommended** — smallest, most backward-compatible change.
2. A separate `admin_roles` join table supporting multiple roles per
   person. More flexible, more schema/RLS surface to get right. Defer
   unless role combinations (one person, multiple hats) prove necessary in
   practice.

## 4. Two-person approval — design

See register PAY-004/OPS-005 for the specific `rpc_confirm_manual_payment`
case. General pattern recommended for any future "dangerous financial
action" (also covers a future ban/pause action, TSF-014):

```
pending_admin_approvals
  id, action_type, target_table, target_id, payload jsonb,
  requested_by, requested_at,
  approved_by, approved_at,
  status ('pending'|'approved'|'rejected'|'expired')
```

A first admin calls a "request" RPC that writes a pending row and performs
no state change. A second, *different* admin calls an "approve" RPC that
checks `requested_by <> approved_by` before performing the actual action.
This pattern generalizes across every future dual-control need without a
bespoke schema per action type.

## 5. Bulk actions, searchability, internal notes, SLA timers

None of these exist on any current admin page (**Confirmed, code** — none
of the 6 admin pages reviewed this pass include a notes field, an assignment
selector, a bulk-select checkbox, or a visible SLA countdown). Recommended
build order, cheapest-and-most-valuable first:

1. Search/filter on `/admin/transactions` and `/admin/disputes` (if not
   already present — **Not confirmed**, needs a direct UI check before
   scoping).
2. Internal notes on disputes and verifications (a simple `admin_notes`
   text column + append-only note-log table, following the same
   append-only pattern already established for `transaction_events`).
3. SLA timers once TXN-004 (dispute deadlines) exists — display, don't
   invent a second deadline concept.
4. Bulk actions last, and only with explicit confirmation dialogs and a
   hard cap on batch size — the founding brief explicitly asks for
   "safeguards," not raw bulk power.

## 6. Emergency pause controls

See register TSF-014. The category-level half (`categories.is_active`
toggle) is the cheapest available fix in this entire document — the column
already exists and is already enforced by RLS; only an admin UI toggle is
missing.

## 7. Support must never need engineering to read raw database rows

This is the founding brief's own standard for this section, and today's
honest answer is that it is **not met**. The single highest-leverage fix is
OPS-001 (the transaction-detail view) — it alone would close the majority of
"can support understand this transaction" gaps without touching any RPC or
schema, since every table it needs to unify already exists and is already
correctly access-controlled.

## 8. Recommended sequencing

1. OPS-001 (transaction detail view) — no schema changes, pure UI/query
   work, highest immediate support-capability gain.
2. TSF-014's category toggle (cheapest emergency control available).
3. OPS-005/PAY-004 dual-control pattern (§4) — build the general
   `pending_admin_approvals` mechanism once, reuse it for every future
   dangerous action.
4. OPS-004 role separation — sequence after #1–3 so there's real usage data
   on which actions actually need restricting to which role, rather than
   guessing upfront.
5. OPS-002 (additional repair RPCs) — build incrementally as real repair
   needs are actually encountered in operation, not speculatively.

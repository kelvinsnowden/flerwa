# Database

Live project: `trusted-services-marketplace` (ref `famdxoardiibonghxepl`,
eu-west-1). 9 migrations, applied in order, tracked in
`supabase/migrations/` with filenames matching their applied timestamps
exactly — `supabase db push` against a fresh project replays this history
verbatim. See `BUILD_PLAN.md` Phase 2 for why a new project was created
rather than reusing the account's one existing (unrelated, paused) project.

## Migration order

| File | What it does |
|---|---|
| `20260908133816_core_schema.sql` | Enums, `profiles`, catalogue tables (`categories`, `services`, `service_scope_items`, `service_checklist_items`), `providers`, `provider_verifications`, `provider_categories`, `provider_services`, `provider_service_areas`, `reliability_scores` |
| `20260908134556_transactions_payments_trust.sql` | The `service_transactions` spine, evidence, events, payments, ledger, reviews, disputes, messages, notifications, Deal Desk, service requests/quotes, saved providers, admin actions, append-only triggers, the new-user profile trigger |
| `20260908134652_rls_policies.sql` | RLS enabled + policies on all 29 tables, `is_admin()` and `is_txn_participant()` helpers |
| `20260908134754_transaction_functions.sql` | Every `rpc_*` `SECURITY DEFINER` function — booking, payment confirmation, check-in, completion, approval/release, revision, reliability recomputation, the auto-approve sweep, verification/clearance |
| `20260908134930_harden_function_security.sql` | First security-hardening pass (partially ineffective — see below) |
| `20260908135116_fix_function_grants.sql` | The actual fix for the grant surface — see `SECURITY.md` §8 for the full story of what was wrong and how it was found |
| `20260908135342_index_foreign_keys.sql` | 31 covering indexes, generated from `pg_constraint`/`pg_index`, not hand-transcribed |
| `20260908135437_storage_buckets.sql` | 3 Storage buckets + their RLS policies |
| `20260908140000_seed_launch_catalogue.sql` | The 4-service Remote-Principal launch catalogue, 8 Nairobi locations, full scope/checklist for the flagship service |

## Entity map

```
auth.users (Supabase-managed)
   │
   ▼
profiles ──────────────────────────────────────────── role: customer|provider|admin
   │
   ├──────────────┐
   ▼              ▼
providers      (customer — no separate table; a user IS a customer
   │             by default, becomes a provider by inserting one row here)
   ├── provider_verifications        (KYC documents, admin-reviewed)
   ├── provider_categories           (competence + clearance, PER CATEGORY)
   ├── provider_services             (price overrides on the catalogue)
   ├── provider_service_areas
   └── reliability_scores            (ONE row, portable, recomputed)

categories ── services ── service_scope_items
                  │      └ service_checklist_items
                  ▼
          service_transactions  ◄──── THE spine (see ARCHITECTURE.md)
                  │
      ┌───────────┼──────────────┬─────────────┬────────────┐
      ▼           ▼              ▼             ▼            ▼
transaction_   transaction_   payments      reviews      disputes
scope_items    evidence          │
      │        (+checklist_   payment_events
      ▼         results)
transaction_events (append-only)   ledger_entries (append-only)
```

Plus: `messages`, `notifications`, `deal_desk_requests`, `service_requests`
+ `quotes` (Post-a-Task, capped at 5 quotes/request by a trigger, not just
application logic), `saved_providers`, `admin_actions`, `locations`.

## Money

Every amount column is `bigint ... amount_minor`, paired with a `char(3)
currency`. `service_transactions.total_amount_minor` is `GENERATED ALWAYS
AS (service_amount_minor + materials_amount_minor + platform_fee_minor)
STORED` — Postgres computes it, so application code cannot construct an
inconsistent total. `materials_amount_minor` is tracked separately and is
never included in GMV reporting (`src/app/admin/page.tsx` sums
`service_amount_minor` only, with a comment explaining why) — see
`docs/10-business-model.md` on why materials pass-through must never be
counted as revenue.

## The ledger

`ledger_entries` is a classic double-entry table: every economic event
(funding, release) inserts a balanced set of debit/credit rows sharing one
`transaction_group` UUID. Account types: `customer_receivable`,
`funds_held`, `materials_held`, `provider_payable`, `platform_revenue`,
`payment_costs`, `refunds`. It is append-only by trigger, not just by
convention.

## Reputation

`reliability_scores` is recomputed, never authored, by
`recompute_reliability(provider_id)`:

```
completion_rate = 100 * completed / accepted
score = ((completion_rate_or_prior * completed) + (70 * 5)) / (completed + 5)
```

That is Bayesian shrinkage toward a neutral prior (70, k=5) — a brand-new
provider is not unrankable at zero, and a provider with 2 jobs and 5 stars
does not automatically outrank one with 60 jobs and a real track record.
Matches `docs/06-trust-architecture.md`'s "Bayesian cold start" rule
directly.

## Row Level Security — the short version

Default deny on all 29 tables. See `SECURITY.md` for what was actually
verified (not just what the policy source says) — including a real bug
found and fixed in the function grant surface during this build.

## Regenerating types

```bash
npx supabase gen types typescript --project-id famdxoardiibonghxepl > src/lib/database.types.ts
```

Not run in this session (would need the Supabase CLI installed and
authenticated) — `src/lib/types.ts` is hand-written to mirror the schema
instead. Regenerate and switch to generated types before this grows past
MVP size; hand-maintained types will drift.

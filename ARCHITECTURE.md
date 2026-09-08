# Architecture

Companion to `BUILD_PLAN.md` (the phased plan) and `DATABASE.md` (the
schema). This is the "how it fits together" document.

## The one-sentence architecture

**One generic `service_transactions` spine, driven entirely by Postgres
`SECURITY DEFINER` functions and RLS, with a thin Next.js layer that never
holds business logic the database doesn't also enforce.**

A property inspection, a future plumbing job, and the seeded-but-unlaunched
creator/content category are all rows in the same table, distinguished by
`category_id` / `pricing_model` / `fulfilment_mode` — never by separate
per-vertical tables or separate per-vertical code paths. Adding a new
service is a catalogue row (`categories`, `services`, `service_checklist_items`)
plus admin clearance, not a code change. This is the direct implementation
of the blueprint's central architectural instruction (brief §3, §6, §42):
narrow launch catalogue, general — and reusable — underlying engine.

## Where business logic actually lives

```
Browser / Server Component
        │  reads: normal Supabase queries, always RLS-scoped to auth.uid()
        │  writes: ONLY via supabase.rpc('rpc_*', ...) or an insert that
        │          RLS itself gates (e.g. reviews, messages, evidence)
        ▼
Postgres SECURITY DEFINER functions  ◄── the actual business logic lives HERE
        │  every rpc_* re-checks the caller (auth.uid(), is_admin())
        │  independent of whatever RLS/grant already applied
        ▼
Tables with default-deny RLS
```

This is deliberate and matches the Next.js 16 docs' own warning, read
before writing any server code in this build (`node_modules/next/dist/docs/
01-app/01-getting-started/07-mutating-data.md`): *"Server Functions are
reachable via direct POST requests, not just through your application's
UI. Always verify authentication and authorization inside every Server
Function."* The Next.js Server Actions in this codebase (`bookService`,
`confirmPayment`, etc.) are thin wrappers that call an `rpc_*` function —
the actual authorization check is in Postgres, not in the Next.js layer,
specifically so that a bug in a Server Action's own logic cannot grant
unauthorized access. See `SECURITY.md` for what was independently verified.

## Stack, and why each piece

| Layer | Choice | Why |
|---|---|---|
| Framework | Next.js 16 (App Router, Turbopack) | Server Components read Supabase directly with no API layer to keep in sync; SSR matters for the public storefront's SEO per `docs/12-technical-architecture.md` |
| Database | PostgreSQL (Supabase) | Relational joins, real transactions, and constraint-enforced money — not a document store. The blueprint's own reasoning (`docs/12-technical-architecture.md`: "Firestore was wrong before; it is now emphatically wrong") for a schema with geospatial dispatch, per-category reputation, recurring series and materials sub-ledgers |
| Auth | Supabase Auth via `@supabase/ssr` | Cookie-based session, readable by both Server and Client Components. `getClaims()` used in `src/proxy.ts` per the current `@supabase/ssr` README, not the older `getSession()` pattern |
| Session refresh | `src/proxy.ts` (Next 16 renamed Middleware → Proxy) | Runs once per navigation, refreshes the token, writes cookies onto the response — without it, `cookies().set()` calls from a Server Component are silently dropped (no response to attach them to) |
| Storage | 3 Supabase Storage buckets | `avatars` (public), `provider-documents` and `transaction-evidence` (private, RLS-gated by a path-embedded owner/participant ID) |
| Payments | `payments.provider_key` column, currently `'manual'` only | A real `PaymentProvider` abstraction exists at the schema level (any future rail is a new `provider_key` value and a new admin/webhook confirmation path) but only the honest manual adapter is wired — see `SECURITY.md` "Payment honesty" |

## The two things that would be expensive to retrofit, done on day one

1. **`amount_minor bigint` everywhere, never a float.** Every money column
   in the schema. `total_amount_minor` is a `GENERATED ALWAYS AS` sum —
   computed by Postgres, not assembled by application code, so it cannot
   drift from its parts.
2. **Append-only `transaction_events` and `ledger_entries`.** Both have a
   `BEFORE UPDATE OR DELETE` trigger (`trg_block_mutation`) that
   unconditionally raises. Reputation (`reliability_scores`) is *recomputed*
   from `transaction_events` by `recompute_reliability()` — never
   hand-edited — so the scoring formula can change later without losing
   history.

## Reliability vs. Competence — the schema expression of a strategy correction

`docs/06-trust-architecture.md` (and `docs/00-executive-thesis.md §8`)
identify that a provider's *reliability* (shows up, on time, honest)
transfers across categories, but their *competence* (can actually do this
specific job well) does not — a blended trust score across a horizontal
marketplace produces unsafe hires. This is not just written guidance; it is
enforced in the schema:

- `reliability_scores` — **one row per provider.** Portable.
- `provider_categories` — **one row per (provider, category).** Carries
  `is_cleared`, `competence_score`, and category-specific `attributes` (a
  creator's platform/audience data, say, or eventually a trade
  certification) in a JSONB column that never pollutes the generic
  `providers` table.
- `rpc_book_service` will not let a customer book a provider for a category
  where `provider_categories.is_cleared` is false or absent — checked
  server-side, not just hidden in the UI.

## Where the code intentionally stops short of the full blueprint

Per BUILD_PLAN.md's "Deliberately NOT built" section: no native app (mobile
web only, but no business logic lives in a Client Component, so a future
native client calls the same `rpc_*` functions), no AI matching or intake
(admin reads free-text requests by hand — the manual process the blueprint
says *is* the specification for the eventual automation), no automated
dispute resolution, no lending/insurance, no second payment rail. Each of
these is a schema-compatible addition, not a rearchitecture, when the time
comes — that compatibility is the point of the generic spine.

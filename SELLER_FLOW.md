# Seller Flow

How the seller side of the two-sided marketplace actually works, end to
end, after the marketplace-direction correction (`MARKETPLACE_UX_AUDIT.md`).
Every RPC/table named here is real and wired to real UI — nothing in this
document describes a stub.

## 1. The buyer/seller/both model

There is no separate "seller account type." One `auth.users` row, one
`profiles` row (always `role = 'customer'` in practice — see
`MARKETPLACE_UX_AUDIT.md` §1 on why `profiles.role` is not what gates
seller-ness), and **a `providers` row if and only if that person has ever
applied to sell**. A user can have both simultaneously with zero
conflict — they always could; the UI just didn't expose it clearly before
this pass.

`profiles.intent` (`'buyer' | 'seller' | 'both'`, nullable) is asked once,
right after first sign-in, via `/onboarding`
(`src/app/onboarding/`). It is **never** read anywhere for access control —
only to decide which CTA to lead with. A `buyer` can go sell services
later; a `seller` can book someone else's service any time; a user who
picked `buyer` and later becomes a seller is not asked again. There is no
code path that locks a user out of either side.

## 2. Seller onboarding — the wizard

Route: `/provider/apply` (`src/app/provider/apply/{page,wizard,actions}.tsx`).
A single multi-step client component (`Wizard`), not five separate routes —
each step's "Continue" calls its own server action, which writes real rows
immediately (not staged client state that could be lost), then advances.
Returning to `/provider/apply` later (before verification is submitted)
re-opens the wizard pre-filled with whatever was already saved, so nothing
is lost and nothing is duplicated.

| Step | What it collects | Where it's stored |
|---|---|---|
| 1. About you | Photo (reused `PhotoUpload`, writes `profiles.avatar_url`), display name, headline, bio, experience/past work, base location | `providers` row (created here if it doesn't exist yet — upsert, not insert-only) |
| 2. What you offer | One or more categories, each with optional self-reported years of experience / specialties | `provider_categories` via `rpc_set_provider_category` — see §5 on why this needs an RPC |
| 3. Services & pricing | Which catalogue services (within chosen categories) to offer, optional own price override | `provider_services` (plain upsert — RLS already scopes it to the caller's own `provider_id`) |
| 4. Service area & availability | Additional locations served, "currently accepting work" toggle | `provider_service_areas` (replaced wholesale on save) + `providers.is_accepting_work` |
| 5. Review & submit | Read-only summary of everything above, "Submit for verification" | `rpc_submit_for_verification` — the only path that can move `verification_status` from `pending` to `submitted` |

**Deliberately not built**: a separate service-creation model where a
seller invents an arbitrary new service (name, description, price) from
scratch. Step 3 only lets a seller opt into **existing catalogue
services** (`services`, admin-curated) with their own price —
`provider_services` already existed in the schema for exactly this,
and inventing a parallel model would have meant either letting sellers
write directly into the shared `services` catalogue (no moderation) or
building a second, unmoderated catalogue next to the real one. Neither is
"extend what exists."

**Deliberately not built**: identity-document upload (ID, selfie,
certificates). `provider_verifications` (the table for this) already
existed with the right shape, but building a secure upload flow for it —
a new storage bucket, file-type/size validation, admin review UI for the
documents themselves — is a real, separate feature. The wizard's step 5
shows the true verification state instead of a fake upload control (see
§4).

## 3. What "your own service, your own price" actually means

`provider_services.price_minor` is nullable — `null` means "use
`services.base_price_minor`" (the catalogue default). A seller setting
their own price is trusted, because it's their own row (RLS: `provider_id`
must resolve to their own `user_id`) — this is not the same trust boundary
as a customer supplying a price, which `rpc_book_service` has always
resolved server-side and ignored from the client.

## 4. Verification status — shown honestly, never faked

`providers.verification_status`: `pending → submitted → under_review →
verified` (or `rejected`/`expired`). The wizard's review step and the
seller dashboard both show the **real** current state via the same
`VerificationBadge`/copy pattern used elsewhere in the app — never a
generic green checkmark. Submitting the wizard only ever reaches
`submitted`; only an admin (`rpc_set_verification_status`, unchanged by
this pass) can move it further, enforced by a row-level trigger (already
in place from an earlier session) — see `SECURITY.md` §9 for a smaller,
adjacent gap (`is_published` specifically) found and closed while
building this.

This is deliberately distinct from **competence** (self-reported
`years_experience`/`specialties` in `provider_categories.attributes`,
admin-set `competence_score`) and **reputation** (`reliability_scores`,
computed from completed jobs and reviews, never hand-edited). A seller can
legitimately be "identity verified, has supplied competence info, has no
reviews yet" — that's shown as exactly that, not collapsed into one badge.

## 5. Why some of this needed new RPCs instead of plain RLS

`provider_categories` is otherwise entirely admin-write
(`is_cleared`/`cleared_by`/`jobs_completed`/`quality_rating`/
`competence_score` all live on the same row). Relaxing that table's RLS to
let a seller self-insert would have risked a seller writing to one of
those columns too if the `with check` clause weren't exactly right.
`rpc_set_provider_category` is narrower and safer: it only ever writes
`attributes`, `on conflict do update set attributes = ...` — structurally
incapable of touching the trust-sensitive columns, regardless of what the
caller passes.

## 6. Seller dashboard

Route: `/provider` (`src/app/provider/page.tsx`). Shows, all from real
queries, never fabricated: verification status, pending/earned amounts
(computed from actual `service_transactions` rows, zero if there are
none), reliability score, active jobs, completed jobs, **the seller's own
services with their real prices**, and quick links to Task requests
(`/provider/requests`), Add a service (back into the wizard), Messages,
and Bring your own customer (`/deal-desk`).

## 7. Post-a-Task — the seller side

The customer side (`/tasks/new`) already existed from the previous pass.
`service_requests` and `quotes` existed in the schema from the *original*
build but had **zero UI ever wired to either table** until this pass —
fully dead tables, not "partially built."

- **Discovery** (`/provider/requests`): a seller sees open, unexpired
  `service_requests` in categories they've declared via
  `provider_categories` (RLS already restricts `service_requests` reads
  to `state = 'open'` for any authenticated provider; this page further
  filters to the seller's own categories, since "any provider can see any
  open request regardless of relevance" is not the same as "eligible").
- **Quoting** (`/provider/requests/[id]`): `rpc_submit_quote` — checks the
  category match server-side (not just in the UI), checks the request is
  still open and unexpired, then inserts. The pre-existing
  `trg_enforce_quote_cap` trigger (untouched) still enforces the 5-quote
  cap at the database level.
- **Customer review** (`/tasks/[id]`): shows every pending quote with the
  seller's real name, verification status, headline, and rating (or an
  honest "no reviews yet" — never a fabricated number), plus Accept/
  Decline.
- **Conversion** (`rpc_accept_quote`): creates a real `service_transactions`
  row — same table, same 12% platform fee calculation `rpc_book_service`
  uses, same state machine, `origin = 'task'` only to mark provenance.
  Every other pending quote on the same request is declined server-side in
  the same call. **There is exactly one transaction/payment lifecycle in
  this app; Post-a-Task feeds into it, it does not duplicate it.**

**Deliberately not built**: "ask a question" on a quote before accepting
(no natural transaction exists yet to scope a message thread to — real
in-app messaging only attaches to a `service_transactions` row). A
customer can still message *after* accepting, via the resulting booking's
existing messaging thread.

## 8. Bring your own customer

Unchanged by this pass, still real: `/deal-desk`
(`src/app/deal-desk/`) lets a seller flag an existing off-platform
arrangement; an admin converts it into a real, protected
`service_transactions` row via `rpc_convert_deal_desk_request` (requires
the customer to already have an account — this pass did not add invite-a-
customer-by-email, which would be a genuinely separate feature: Admin API
user creation, email delivery, a claim flow). Now explicitly surfaced from
both the customer-facing homepage and the seller dashboard/account menu,
not just buried in one generic link.

## 9. What's still deferred (see `MARKETPLACE_UX_AUDIT.md` §11 for the full list)

- Real per-service checklists/pricing UI beyond "pick from the catalogue"
  — sellers cannot yet author a brand-new service type themselves.
- Identity document upload for verification.
- "Ask a question" pre-acceptance on a quote.
- Multi-location service-area radius/map (currently a flat list of named
  locations, which is what `provider_service_areas` already models).

# Customer Support System — Phase 2 Implementation Report

Companion to `MARKETPLACE_SUPPORT_SYSTEM_PLAN.md` (the research/spec/architecture
document written before any code). This is the final report against the
brief's §16 deliverables list, for Phase 2 (core email support) as actually
built and verified this pass.

## 1. What was implemented

- **Provider-agnostic notification layer** (`src/lib/notifications/`) —
  `EmailProviderAdapter`/`SmsProviderAdapter` interfaces mirroring
  `src/lib/payments/provider.ts` exactly; `registry.ts` (`emailAdapters`,
  `smsAdapters`); first real adapter `adapters/resend-email.ts` (send,
  Svix-verified inbound webhook, inbound body/attachment fetch). Nothing
  outside these files imports Resend or any vendor by name — this satisfies
  the explicit mid-session instruction: *"Don't make this build rely on any
  specific provider eg RESEND, let it be adaptable to any provider even on
  SMS etc."*
- **Database schema** (3 migrations, applied and verified live against
  project `famdxoardiibonghxepl`): `notification_channels`,
  `support_categories` (5 seeded), `support_conversations`,
  `support_messages` (internal notes share the table via `is_internal_note`,
  Help Scout's own model), `support_attachments`, `support_tags` +
  `support_conversation_tags`, `support_canned_replies`. Every privileged
  write goes through a `SECURITY DEFINER` RPC; RLS enforces read scoping.
- **`support-attachments` storage bucket** — private; every write goes
  through a trusted server action using the service-role client (no
  anon/authenticated write policy exists at all, since an anonymous
  submitter has no `auth.uid()` to key an insert policy on); reads scoped
  to the owning customer or admin.
- **Inbound email webhook** (`/api/webhooks/support-inbound`) — verifies
  the active provider's signature, matches replies primarily by a `[REF]`
  subject tag (provider-independent) and secondarily by
  `In-Reply-To`/`References` against a stored `email_message_id`,
  downloads and re-uploads attachments, creates a new conversation for
  unmatched mail rather than dropping it.
- **Outbound send helper** (`src/lib/notifications/send-support-email.ts`)
  — auto-acknowledgement on submit, agent-reply email with threading
  headers, both routed through the active adapter only.
- **Customer widget** (`/support`, `/support/[id]`) — works without login;
  email/name/subject/body/category/optional-attachment form; honest
  "we reply by email, not live chat" copy (no false immediate-response
  promise); reference-number confirmation; logged-in customers see their
  own history (internal notes excluded by RLS, not app logic); contextual
  entry point from a booking detail page (`?booking=<id>`, only accepted
  when the caller is actually a participant on that transaction).
- **Admin support workspace** (`/admin/support`, `/admin/support/[id]`) —
  filterable inbox (status/assignee/search), full conversation view with
  customer-visible messages and internal notes visually distinguished,
  reply (sends a real email), internal notes, assign, status/priority/
  category, tag toggling, canned-reply insert/manage, customer profile
  panel with marketplace context (linked profile + booking count, linked
  related booking).
- **Admin configuration** — `/admin/integrations` gained a "Support
  channels" section, reusing the exact `rpc_set_active_payment_provider`
  pattern (`rpc_set_active_notification_channel`, admin-only, audit-logged).
- **Unit tests** — `src/lib/notifications/adapters/resend-email.test.ts`
  (11 tests): hand-computed HMAC signatures proving `verifyInboundWebhook`
  accepts valid signatures and rejects wrong-secret, tampered-body, stale-
  timestamp, and missing-header cases; `sendEmail`'s unconfigured/happy-path
  behavior; `parseInboundEvent`'s parsing/rejection behavior.

## 2. What was explicitly postponed (and why)

| Item | Status | Reason |
|---|---|---|
| Live chat (real-time widget, typing/online indicators) | Not built | Phase 3 per the phased plan — reuses the exact `postgres_changes` pattern already proven in `message-thread.tsx`; needs a UI/UX pass of its own |
| Agent/team RBAC (dedicated support-agent role, teams, routing rules) | Not built | Blocked on the pre-existing GOV-P1 founder decision (`profiles.role` is a 3-value enum with no admin sub-roles) — Phase 2 ships with "any admin is a support agent," same posture as every other admin-console feature this session |
| SLA dashboards, CSAT surveys, knowledge base | Not built | Phase 4, deliberately not attempted before Phase 2 exists to build on |
| AI reply suggestions/summarization | Not built | No AI call is made anywhere in this feature; the architecture leaves room (nothing prevents adding a `generated_by` field later) but nothing was implemented, per the brief's own instruction that AI needs a separate cost/safety review first |
| SMS/WhatsApp as a support channel | Not built | `SmsProviderAdapter` ships with zero registered adapters by design — no vendor connected, no budget decision made |
| Customer web-reply (vs. email-only reply) | Not built | The written spec (§3 of the plan) commits to email-only reply for Phase 2; the customer's `/support/[id]` view is read-only by design |

## 3. Files changed / added

**New:**
- `MARKETPLACE_SUPPORT_SYSTEM_PLAN.md`, this report
- `src/lib/notifications/{email-provider,sms-provider,registry,send-support-email}.ts`
- `src/lib/notifications/adapters/{resend-email.ts,resend-email.test.ts}`
- `src/app/api/webhooks/support-inbound/route.ts`
- `src/app/support/{page.tsx,support-form.tsx,actions.ts,[id]/page.tsx}`
- `src/app/admin/support/{page.tsx,actions.ts,canned-replies-manager.tsx,[id]/{page.tsx,conversation-workspace.tsx}}`
- `supabase/migrations/20260914110000_support_system_schema.sql`
- `supabase/migrations/20260914110200_support_attachments_bucket.sql`
- `supabase/migrations/20260914110400_support_system_rpcs.sql`
- `supabase/migrations/20260914110500_fix_support_request_reference_ambiguity.sql`

**Modified:**
- `.env.example` (new vars, see §4)
- `src/components/ui/icon.tsx` (added `help-circle`, `paperclip`)
- `src/app/account/page.tsx` (Get help entry point)
- `src/app/account/bookings/[id]/page.tsx` (contextual "Need help with this booking?" link)
- `src/app/admin/layout.tsx` (Support nav link)
- `src/app/admin/integrations/{page.tsx,actions.ts,provider-toggle.tsx}` (Support channels section)

## 4. Environment variables / external services required

| Variable | Required for | Status in this environment |
|---|---|---|
| `RESEND_API_KEY` | Sending + inbound body fetch via the Resend adapter | Set, but **zero verified sending domains** on the connected account |
| `RESEND_WEBHOOK_SECRET` | Verifying inbound `email.received` webhooks (Svix HMAC) | **Not set** — every inbound webhook fails closed until it is |
| `SUPPORT_EMAIL_FROM` | The address auto-acks/replies are sent from | **Not set** |

No new database, cache, or messaging infrastructure was introduced —
everything runs on the existing Postgres/Supabase stack (RLS, RPCs,
storage, and Realtime already proven elsewhere in this codebase for the
still-pending Phase 3).

## 5. Email/realtime infrastructure requirements to go live

1. Verify a sending domain with Resend (or connect a different vendor by
   writing one adapter — see `src/lib/notifications/adapters/resend-email.ts`
   for the template).
2. Set `RESEND_WEBHOOK_SECRET`/`SUPPORT_EMAIL_FROM` and point Resend's
   inbound webhook at `/api/webhooks/support-inbound` on the deployed
   domain.
3. An admin activates the `resend` email channel from
   `/admin/integrations` (`rpc_set_active_notification_channel` — mirrors
   the payment-provider activation gate; this one has no legal-signoff
   requirement since no money moves).
4. **Not independently confirmed in this session** (documented rather than
   guessed, per the brief's own instruction): the exact JSON field names
   Resend's `GET /emails/receiving/{id}` response uses for body/headers.
   The endpoint path itself was confirmed via search against Resend's own
   docs page; the response shape is a best-effort mapping flagged inline in
   `resend-email.ts` — verify against one real inbound email before
   depending on it in production.

## 6. Admin roles / permissions

- Every privileged RPC (`rpc_agent_reply_support_conversation`,
  `rpc_add_support_internal_note`, `rpc_assign_support_conversation`,
  `rpc_set_support_conversation_{status,priority,category,tags}`,
  `rpc_upsert_support_tag`, `rpc_upsert_support_canned_reply`,
  `rpc_delete_support_canned_reply`, `rpc_set_active_notification_channel`)
  checks `is_admin()` and raises an exception otherwise — verified live
  (see §7).
- `rpc_submit_support_request` is the one function callable by `anon` —
  by design, since the widget must work without login.
- No admin sub-roles exist yet (see §2) — any of the marketplace's existing
  admins can act as a support agent in Phase 2.

## 7. Testing evidence

**Automated:**
- `npx tsc --noEmit` — clean after every stage of this build.
- `npx next build` — clean, all new routes (`/support`, `/support/[id]`,
  `/admin/support`, `/admin/support/[id]`, `/api/webhooks/support-inbound`)
  register and compile.
- `npx vitest run` — 43/43 passing, including the 11 new
  `resend-email.test.ts` cases covering signature verification (valid,
  wrong-secret, tampered-body, stale-timestamp, missing-header),
  send/threading-header behavior, and inbound-event parsing.

**Live, against the real Supabase project (all inside rolled-back
transactions unless noted):**
- `rpc_submit_support_request` called as the actual `anon` Postgres role
  (not just the service-role default) — succeeded, returned a reference
  number. This caught and fixed a real bug: the first version raised
  `column reference "reference_number" is ambiguous` because the
  `RETURNS TABLE` output parameter shadowed the column name — fixed by
  qualifying it with a table alias (see the `fix_support_request_reference_
  ambiguity` migration).
- `rpc_agent_reply_support_conversation` called with no admin session —
  correctly raised `Only an admin may reply as a support agent.`
- RLS, simulated as real Postgres roles with `SET LOCAL ROLE` +
  `request.jwt.claims` (the same mechanism PostgREST itself uses):
  - Customer A cannot see customer B's conversation (`support_conversations`
    row-count check: 1 visible, not 2).
  - A customer's own internal-note message is invisible to them even on
    their own conversation (0 internal rows returned, only the
    customer-authored one).
  - An `anon`-role read of `support_conversations` returns zero rows even
    for a conversation whose `customer_profile_id` is null (anonymous) —
    confirms the "no web view by reference number alone" design decision
    actually holds at the database layer, not just by omitting a lookup UI.
  - `support_categories` is readable by `anon` (needed for the widget's
    category dropdown to render for an anonymous visitor).
- `mcp__Supabase__get_advisors` (security) — no new findings beyond the
  same class already present throughout this codebase (every
  `SECURITY DEFINER` RPC is flagged as "callable by anon/authenticated,"
  which is by design — each one self-guards with `is_admin()`).

**Not tested in this session (explicitly, per §7 of the plan and the
brief's own "do not claim untested things work" instruction):**
- Real email delivery or real inbound-webhook receipt end-to-end — the
  connected Resend account has zero verified sending domains, so this
  cannot be demonstrated live here.
- Browser click-through of the widget/admin UI — not performed this
  session; typecheck/build/live-RPC/live-RLS testing were used instead.
  Recommended before launch.

## 8. Security considerations

- Strict RBAC: every privileged action server-side-checks `is_admin()`
  inside the RPC itself (not just at the UI layer) — verified live.
- Anonymous-submitter privacy: no web view of a ticket by reference number
  alone (verified live via RLS simulation) — email is the only channel an
  anonymous customer has into their own ticket.
- Internal notes are never returned to a non-admin reader, enforced by RLS
  (verified live), not by the application filtering them out.
- Inbound webhook signatures are verified (Svix HMAC, constant-time
  compare) before any payload is trusted; an unconfigured or wrong secret
  fails closed (verified via unit test).
- Attachment uploads never go through a client-writable storage policy —
  every write is server-side via the service-role client from a trusted
  action, with content-type/size validated before upload.
- Rate limiting on the anonymous submission path reuses the existing
  `rpc_check_rate_limit`/`checkRateLimit` (IP-bucketed pre-auth, same as
  signup/booking/task-posting).
- No raw payment credentials are anywhere near this feature; no
  impersonation path exists (an admin's replies are attributed to their
  own `auth.uid()`, logged in `admin_actions`).

## 9. Deployment instructions

1. Migrations are already applied to the live Supabase project
   (`famdxoardiibonghxepl`) — nothing further to run there.
2. Set the three env vars in §4 in the deployment environment (Vercel
   project settings).
3. Deploy the branch.
4. Verify a Resend sending domain (or connect an alternate vendor).
5. Point the vendor's inbound webhook at
   `https://<domain>/api/webhooks/support-inbound`.
6. An admin visits `/admin/integrations` and activates the email channel.
7. Send one real test email to the connected address and confirm it
   creates a conversation visible at `/admin/support` — this is the one
   piece of end-to-end verification that could not be performed in this
   session and should happen before relying on this in production.

## 10. Remaining risks

1. Resend's inbound-body response field names are a best-effort mapping,
   not verified against a live sample (see §5.4) — could need a small fix
   once real inbound mail is tested.
2. No agent/team RBAC yet — every admin can act as every support agent;
   acceptable for a small early-stage team, revisit once GOV-P1 is
   decided.
3. No SLA/escalation automation yet — an urgent ticket sitting unassigned
   has no automatic alert (Phase 4).
4. Live chat does not exist yet — the widget is honest about this
   ("we reply by email, not live chat"), but it's worth confirming that
   copy still reads correctly once live chat ships in Phase 3, so the two
   modes don't contradict each other.

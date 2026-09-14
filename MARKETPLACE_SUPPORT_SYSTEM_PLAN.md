# Customer Support System — Research, Specification, and Architecture

## 1. Existing marketplace, as verified this pass (not assumed)

**Stack:** Next.js 16.3.4 (App Router, Server Components/Actions), React 19,
Supabase (Postgres + Auth + Storage + Realtime), Tailwind 4, Zod, Vitest.
No ORM — every DB call goes through the Supabase client or a `SECURITY
DEFINER` RPC. No Redis, no message queue, no separate backend service.

**Auth/roles:** `profiles.role` is a 3-value enum — `customer` / `provider`
/ `admin`. **There is no admin sub-role today** (confirmed via
`information_schema` and every existing admin RPC — `is_admin()` is
binary). This is the single biggest constraint on this brief's agent/team/
RBAC requirements (§6–7 of the brief) and is already tracked as **Blocked**
on a founder decision in `MARKETPLACE_REMEDIATION_REGISTER.md`
(`DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL` #8) and
`MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md` (GOV-P1–P4). This plan does not
re-litigate that — it designs support so **any existing admin can act as a
support agent today**, with true teams/departments/per-agent RBAC
explicitly deferred to the same decision.

**Existing messaging infrastructure — directly reusable:**
- `conversations`/`messages` tables (customer↔provider chat) — confirmed
  real-time via `supabase.channel(...).on("postgres_changes", {event:
  "INSERT", ...})` in `src/app/messages/message-thread.tsx`. This exact
  pattern is what live chat will reuse — **no new realtime infrastructure
  needed**, Realtime is already proven working in this codebase.
- `src/lib/rate-limit.ts` → `rpc_check_rate_limit` — already handles
  **pre-auth** rate limiting via IP (`x-forwarded-for`), which is exactly
  what an anonymous support-request form needs. Reusable as-is.
- `admin_actions` (append-only audit log) and the now-15-page admin
  console built in the preceding continuation — reusable conventions:
  `SECURITY DEFINER` RPC per privileged action, `is_admin()` gate, reason
  fields, `revoke ... grant ... to authenticated` grant discipline.
- Storage: 4 buckets exist (`avatars`, `provider-documents`,
  `transaction-evidence` private; `provider-portfolio` public). A new
  `support-attachments` bucket is needed — none of the existing ones fit
  (private, but not scoped to a transaction/provider).
- **No existing email-sending library** — `src/lib/alerts.ts` (built this
  continuation) is the *only* outbound-email code in the repo, and it
  calls Resend's REST API directly via `fetch`, no SDK dependency. No
  inbound-email processing exists anywhere. No SMS/WhatsApp integration
  exists at all (confirmed — `.env.example` has zero SMS-related vars).
- **Provider-abstraction precedent already exists, twice**:
  `payment_providers` table + `src/lib/payments/registry.ts` +
  `PaymentProviderAdapter` interface (swap IntaSend for Kora = one new
  adapter file); `verification_providers` table for identity-check
  vendors. **This plan follows the identical shape for email/SMS** — see
  §4.

**What this means for scope:** the marketplace's own data (bookings,
disputes, providers, customers) already exists and is queryable; the
admin console already exists and already has the exact conventions this
system needs (RLS + RPC + audit log + reason fields). This is a genuinely
additive build, not a rework.

## 2. Platform research

Researched via official/primary sources where available; each claim below
is either cited or marked as a design recommendation, per the brief's
instruction not to blur the two.

- **Chatwoot** (open source, closest architectural analog): Rails + Vue +
  Postgres + Redis/Sidekiq for background jobs and realtime, multi-tenant
  `Account` as root entity, polymorphic `Inbox`/`Channel` model,
  `ContactInbox` mapping one contact across multiple channels. [System
  Architecture Overview](https://deepwiki.com/chatwoot/chatwoot/1.2-installation-and-deployment),
  [Core Data Models](https://deepwiki.com/chatwoot/chatwoot/3-core-data-models),
  [Inboxes and Channels](https://deepwiki.com/chatwoot/chatwoot/3.5-inboxes-and-channels).
  **Build-vs-integrate:** self-hosting Chatwoot would mean running a
  second stack (Rails/Redis/Sidekiq) this project doesn't otherwise need,
  plus syncing customer/booking identity across two systems. Chatwoot
  Cloud is a recurring per-agent SaaS cost. Given this codebase's Postgres
  + RLS + RPC conventions already do everything Chatwoot's data model
  does (conversations, messages, inboxes-as-channel, contact↔conversation
  mapping) — **recommendation: build native**, not integrate. Revisit only
  if agent headcount grows enough that the "any admin is an agent" model
  genuinely can't scale (see §5, Phase 4 risk).
- **Help Scout** (shared inbox, the closest analog to the required
  email-first model): one email alias flows into a shared inbox; the
  system "automatically sorts, labels, and assigns emails," uses internal
  notes and @mentions instead of CC/BCC, and assignment prevents duplicate
  replies. [Shared inbox](https://www.helpscout.com/shared-inbox/),
  [What is a shared inbox](https://docs.helpscout.com/article/1581-what-is-shared-inbox).
  **Directly adopted:** internal notes live in the same conversation
  thread as customer-visible messages (a boolean flag, not a separate
  table) — simpler data model, same UX Help Scout ships.
- **Intercom vs. Zendesk vs. Crisp** — widget/offline UX: "when nobody is
  on shift, the widget should say so, collect an email, promise a reply
  window, and keep that promise"; false "instant reply" promises
  underperform an honest one; bottom-right placement is the safe default;
  intent-based/delayed prompts over immediately-intrusive ones. [Live chat
  best practices](https://gettalkative.com/info/web-chat-best-practices),
  [comparison](https://www.selecthub.com/live-chat-software/intercom-vs-zendesk-live-chat/).
  **Directly adopted:** the widget's offline state is copy-driven and
  explicit ("Agents are offline — email us and we'll reply within
  [target]"), never a spinner or a silently-broken chat box.
- **Resend inbound email** (the load-bearing technical finding): inbound
  went GA "in late 2025" — an `email.received` webhook fires with
  metadata only; body/attachments are fetched via a separate API call;
  works either via a zero-DNS managed `@<id>.resend.app` address or a
  custom domain with **one MX record**. [Receiving
  emails](https://resend.com/docs/dashboard/receiving/introduction),
  [Inbound](https://resend.com/features/inbound),
  [webhook signature verification](https://github.com/resend/resend-skills/blob/main/skills/resend/references/webhooks.md).
  **This is why email-first support is buildable at all on this stack's
  existing provider** — but see §7's honest verification limitation.
- **Email threading mechanics** — industry-standard approach: match
  inbound replies on `In-Reply-To`/`References` headers against a stored
  outbound `Message-ID` first, fall back to subject-line parsing only as
  a last resort; every outbound message needs a unique `Message-ID` or
  threads will incorrectly merge. [Threading
  headers](https://cr.yp.to/immhf/thread.html), [In-Reply-To
  explained](https://blog.mutantmail.com/unraveling-the-mystery-of-the-handy-in-reply-to-email-header-field/).
  **Directly adopted** — see §4's `support_messages.email_message_id`/
  `email_in_reply_to` columns and §6's matching order.

**Recommended features for this marketplace** (justified below, not a
copy of any one platform): email-first ticketing with real threading;
unified admin inbox with status/priority/category/assignment; internal
notes; canned replies; tags; booking/transaction linking (marketplace-
specific — none of the researched platforms know what a "booking" is,
this codebase does); live chat as an additive channel on the same
conversation model, gated by a single settings toggle; SLA/response-time
tracking as data collection now, dashboarding later (Phase D-equivalent,
per the admin console's own established phase ordering). **Explicitly
not recommended for v1:** AI reply suggestions/summarization (real cost,
real risk, brief says "do not introduce unnecessarily" — architecture
leaves room, see §9); a separate knowledge-base CMS (an FAQ is a much
smaller, safer first step); WhatsApp/SMS as a support *channel* (no
provider connected, no budget decision made — NOTIF-001/002 already
blocked in the register).

## 3. Product specification (what "done" means for Phase 2)

A visitor or customer can reach a support form from a persistent widget
entry point. They submit email address (name optional if logged in),
subject, message, optionally an attachment. Rate-limited (reusing
`rpc_check_rate_limit`, pre-auth IP-bucketed, matching the existing
signup/booking limiter shape). A conversation is created, a human-
readable reference number generated, a confirmation email sent (via the
active `EmailProviderAdapter`) with that reference number, and — only if
an active email-provider is actually configured — the confirmation is
real; otherwise the UI must honestly say so rather than claim delivery
(§7). Agents see it in the unified inbox, reply from there; the reply
goes out as a real email using the same `Message-ID`/`In-Reply-To`
threading discipline; the customer's own email reply comes back through
the inbound webhook and lands in the same conversation thread. A logged-in
customer additionally sees their own conversation history under
`/account`. Status, priority, category, tags, assignment, internal notes,
canned replies all work from the admin inbox on day one.

## 4. Provider-agnostic architecture (per explicit instruction)

**This build must not hard-depend on Resend, or on any single SMS
vendor.** Following this codebase's own established pattern
(`payment_providers` + `PaymentProviderAdapter` + `registry.ts`):

```
src/lib/notifications/
  email-provider.ts     — EmailProviderAdapter interface
  sms-provider.ts        — SmsProviderAdapter interface (unconfigured by default)
  registry.ts             — key -> adapter maps, exactly like payments/registry.ts
  adapters/
    resend-email.ts       — first real implementation (fetch-based, no SDK)
```

```ts
interface EmailProviderAdapter {
  key: string;
  sendEmail(msg: OutboundEmail): Promise<{ ok: boolean; providerMessageId?: string; error?: string }>;
  verifyInboundWebhook(rawBody: string, headers: Headers): boolean;
  parseInboundEvent(rawBody: string): ParsedInboundEmail | null; // metadata only if the vendor splits body/metadata like Resend does
  fetchInboundBody?(eventId: string): Promise<{ text: string; html: string | null; attachments: InboundAttachment[] }>;
}
```

A new `notification_channels` table (same shape as `payment_providers`:
`key`, `kind` ∈ {`email`,`sms`}, `display_name`, `is_active`, `config
jsonb`) tracks which provider is active per channel; `/admin/integrations`
(already exists) gains a Support Channels section to switch it, reusing
the exact `rpc_set_active_payment_provider`-style RPC pattern. **Every
piece of support logic — the webhook route, the outbound-send helper, the
RPCs — talks only to the adapter interface, never to Resend by name.**
Swapping to Postmark, SendGrid, SES, or Mailgun later is one new adapter
file plus a registry line, exactly like IntaSend → Kora already is. SMS
follows the identical shape but ships with **zero adapters registered** —
no SMS vendor is connected in this environment (confirmed), so
`smsAdapters = {}` and any code path that would send an SMS no-ops with a
clear "not configured" result, matching `INTASEND_SECRET_KEY`'s existing
"unset by default, never a silent false positive" convention.

## 5. Phased plan (this session)

- **Phase 2 (this pass): core email support.** Data model, RLS, RPCs,
  provider-agnostic email adapter + Resend implementation, inbound
  webhook with real Message-ID threading, customer widget (email mode
  only), admin inbox + conversation view, canned replies, internal notes,
  categories/tags/priority, booking-context linking.
- **Phase 3 (next pass): live chat.** Reuses the exact `postgres_changes`
  INSERT-subscription pattern already proven for peer messaging, applied
  to `support_messages`; presence/typing via Supabase Realtime
  Broadcast/Presence (same client library, no new infra); live-chat
  toggle in admin settings; graceful fallback to email when no agent is
  online.
- **Phase 4 (later): advanced ops.** Routing/auto-assignment, SLA
  dashboards, CSAT surveys, knowledge base, audit-log surfacing (the
  admin console's `admin_actions` pattern already covers this — mostly a
  matter of logging the new action types).

## 6. Data model (Phase 2)

`support_conversations` — id, reference_number (short, unique, shown to
customer), subject, status (`open`/`pending`/`resolved`/`closed`),
priority (`low`/`normal`/`high`/`urgent`), category_id (nullable fk),
channel (`email`/`chat`, chat unused until Phase 3), customer_profile_id
(nullable — null for anonymous), customer_email, customer_name,
related_transaction_id (nullable fk to `service_transactions`, for
booking-context linking), assigned_to (nullable fk to `auth.users`),
created_at, last_customer_message_at, last_agent_message_at, resolved_at,
closed_at.

`support_messages` — id, conversation_id, sender_type
(`customer`/`agent`/`system`), sender_id (nullable — set for a logged-in
customer or an agent, null for an anonymous customer or system message),
author_email, author_name, body, is_internal_note (bool — internal notes
live in the same thread, Help Scout-style, never returned to
customer-facing queries), email_message_id, email_in_reply_to, created_at.

`support_attachments`, `support_categories`, `support_tags` +
`support_conversation_tags`, `support_canned_replies`,
`notification_channels` (§4) — each a small, focused table following this
codebase's existing conventions (RLS with `is_admin()`, no direct
customer write path beyond narrow RPCs).

**RLS/anonymity design decision:** an anonymous submitter gets **no** web
view of their ticket by reference number alone (a guessable/URL-shared
reference number would otherwise be an enumeration hole) — their entire
interface is email, matching how every researched platform actually
treats anonymous contacts. A logged-in customer's conversations are
scoped by `customer_profile_id = auth.uid()`, same shape as every other
"participant read" policy already in this schema.

## 7. Honest, upfront verification limitation

Exactly the same constraint already on record for `src/lib/alerts.ts`
(ops alerts, earlier this continuation): **this session's connected
Resend account has zero verified sending domains.** Real end-to-end
email delivery and real inbound-webhook receipt cannot be demonstrated
live in this session. Every piece of this system will be built and
verified at the level this session *can* verify — typecheck, build,
RLS/grant checks against the live schema, rollback-safe DB behavior
tests, and code-level correctness of the threading/signature-verification
logic — and every claim about live delivery will say exactly that plainly,
not imply it was tested. Closing this gap requires the founder to connect
a verified domain (Resend or otherwise, per §4's abstraction) — a business
step, not an engineering one.

## 8. Risks and decisions requiring approval

1. **Agent/team RBAC** (§1) — deferred to the existing GOV-P1 founder
   decision; Phase 2 ships with "any admin is a support agent."
2. **Verified sending domain** (§7) — required before any real email
   moves; independent of which provider is chosen.
3. **AI features** (§9 of the brief) — architecture leaves the seam open
   (a `generated_by` field on messages, never built this pass) but no AI
   call is made — real cost and safety review needed first.
4. **SMS/WhatsApp as a support channel** — no vendor connected, no budget
   decision made; `SmsProviderAdapter` ships with zero registered
   adapters, by design.

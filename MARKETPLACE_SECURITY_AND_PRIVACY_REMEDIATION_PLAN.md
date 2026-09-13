# Marketplace Security and Privacy Remediation Plan

Companion to the register's `SEC-*` and `LEGAL-*` items. `SECURITY.md`
remains the authoritative, live-verified record of the core RLS/authorization
model — this document does not repeat its content, only extends it with what
that document doesn't cover: file-upload/malware handling, dependency
hygiene, headers, logging hygiene, secret rotation, and the legal/privacy
checklist the founding brief's §16 asks for.

## 1. What's already strong — restated so it isn't lost among the gaps

Per `SECURITY.md`, live-verified, re-confirmed by spot-check this pass:

- RLS default-deny on every table; every state change goes through a
  `SECURITY DEFINER` RPC that independently re-checks caller identity.
- Two real self-escalation bugs were found and fixed during original
  development (`providers.is_published`, function-grant leakage), and a
  third, smaller instance was self-caught and fixed in the immediately
  preceding session (the `rpc_book_service` overload/grant issue).
- Private Storage buckets use path-segment-based RLS
  (`storage.foldername(name)[1] = auth.uid()::text` or the transaction-
  participant equivalent) — an unauthorized signed-URL request 403s
  independent of whether a URL was ever leaked.
- Append-only financial/audit tables (`ledger_entries`, `transaction_events`,
  `admin_actions`) are a real, structural control, not a policy promise.

**Do not weaken any of the above for performance or convenience** — this is
restated as a hard constraint because it is the project's most valuable
asset and the one most tempting to erode under time pressure.

## 2. IDOR / privilege escalation — current posture

No new IDOR vector was found this pass beyond what `SECURITY.md` already
documents and has fixed. The one **process** gap (not a code vulnerability):
without SEC-001 (a regression suite), the *durability* of every fix listed
above depends entirely on nobody accidentally reverting it in a future
change. This is why SEC-001 is filed as this program's highest-priority
security item, ahead of any specific new finding.

## 3. File upload security

| Control | Status |
|---|---|
| MIME-type allowlist | Confirmed, code (bucket config) |
| File size limits | Confirmed, code (5MB avatars, 10MB documents, 20MB evidence) |
| Path-segment authorization | Confirmed, live-verified (`SECURITY.md`) |
| Malware/content scanning | **Missing** — SEC-002 |
| CSAM/illegal-content detection | **Missing** — same remediation as SEC-002 covers this for most vendors (e.g. Google's Web Risk / hash-matching services include this) |

## 4. Secrets management

**Confirmed, code:** `SUPABASE_SERVICE_ROLE_KEY` is only ever imported in
`src/lib/supabase/admin.ts`, guarded by `import "server-only"` (a build-time
enforcement, not just a convention — re-confirmed this pass). `CRON_SECRET`
is compared with `crypto.timingSafeEqual` (constant-time, prior session).
**Missing:** any written rotation procedure (SEC-006); any confirmation of
where else these secrets are held (a local `.env.local`, a CI secret store —
**not audited this pass**, flagged for a dedicated secrets-inventory pass
before declaring this domain closed).

## 5. Dependency hygiene

**Missing entirely** — no CI, no Dependabot confirmed enabled, no `npm
audit` gate (SEC-003). This is a zero-cost-to-enable, real-value fix
(GitHub Dependabot alerts are free) and should be one of the first items
closed in this entire program regardless of phase, given the cost is
essentially zero.

## 6. Headers, CSP, error-message leakage

- No security headers configured (`next.config.ts` — SEC-004/011).
- Error-message leakage: **Not confirmed this pass** whether any route
  returns raw Postgres error text to the client in a way that leaks schema
  detail — `src/app/api/webhooks/payments/route.ts` does return
  `error.message` in its 500 response (Confirmed, code), which is a
  deliberate, documented choice (to signal the vendor's retry logic) but
  should be reviewed for whether the Postgres error text itself could ever
  contain sensitive detail (column names, constraint names) that shouldn't
  reach an external, unauthenticated caller. Recommend a generic error
  message for the webhook 500 response instead of the raw `error.message`,
  logging the detail server-side only.

## 7. PII in logs and analytics

**Not confirmed** — flagged in the register (SEC-010) as needing a direct
grep-and-review pass, not yet performed to completion this session given
the scope of everything else in this program. Recommended as an early,
cheap item: grep every `console.log`/`console.error` call for interpolated
variables that could carry an email, phone number, or ID number, and
replace with user IDs or redacted forms where found.

## 8. Legal and privacy checklist (founding brief §16)

Per the brief's own instruction: **do not provide unsupported legal
conclusions** — the following separates engineering-actionable items from
what genuinely needs a qualified Kenyan legal/privacy professional, carried
over from `docs/14`'s own citations, not newly invented.

| Item | Engineering can act now? | Needs legal/business first? |
|---|---|---|
| Data minimization in schema (collect only what's needed) | Partially — a schema review against actual field usage is engineering work | Legal should confirm the target minimization standard |
| Consent capture at signup/provider-apply | Engineering can build a checkbox once the exact consent text is legal-approved | **Requires legal review** for the text itself |
| Privacy notice / terms / provider agreement | Engineering can build the `/privacy`, `/terms` routes | **Requires legal review** for content — LEGAL-005 |
| Retention periods | Engineering can build the deletion job once a period is decided | **Requires business decision** — LEGAL-007 |
| Deletion requests (DSAR) | Engineering can build a request-intake mechanism | Process/SLA is a business decision |
| Data correction requests | Same as above | Same |
| Data breach response | Engineering builds the technical detection/containment | **Requires a written protocol**, overlaps TSF-013/DR |
| Data processor agreements (Kora, future payment aggregator) | N/A | **Requires legal review** — contract terms |
| Cross-border transfer (diaspora customers) | N/A | **Requires legal review** — `docs/14` flags this explicitly as unresolved |
| ODPC registration | N/A | **Requires business decision** — who files, when — LEGAL-004 |
| PSP-status / contractor-classification / property-representation opinions | N/A | **Requires legal review** — LEGAL-001/002/003, unchanged from `docs/14`, not resolved by any work in this program |

## 9. Backup security

Covered in full in `MARKETPLACE_DISASTER_RECOVERY_PLAN.md` — noted here only
to record that backup **access control** (who can trigger a restore, whether
backups themselves are encrypted at rest) is a Supabase-platform-level
setting, **Blocked — external access**, not something this codebase
controls directly.

## 10. Recommended sequencing

1. SEC-003 (Dependabot) — zero cost, enable today.
2. SEC-010 (PII-in-logs audit) — cheap, high-value, no dependencies.
3. SEC-004 (security headers) — one small config change.
4. SEC-002 (upload scanning) — before any real identity document is
   uploaded by a real provider, i.e., before real supply onboarding begins.
5. SEC-012/LEGAL-007 (retention policy) — blocks on a business decision
   first; raise it early given the lead time legal review requires.
6. SEC-001 (regression suite) — the largest item, started in parallel with
   the above, not sequenced after them.

import { describe, it, expect } from "vitest";
import { DB_URL, withRolledBackTransaction, asUser, asPostgres, FIXTURES } from "./client";

/**
 * MARKETPLACE-SECURITY-002 — provider-eligibility authorization gaps.
 * Extended by MARKETPLACE-SECURITY-003 (financial-write hardening).
 *
 * These tests describe the FIXED behavior proposed in
 * security_proposals/PROPOSED_marketplace_security_003_financial_hardening.sql
 * (supersedes the `-002` proposal, which this file originally targeted),
 * which has NOT been applied to the live database as of when this file
 * was written — see SECURITY_READINESS_REGISTER.md. Until that migration
 * is authorized and applied, every "rejected"/"BLOCKED" assertion below
 * will FAIL against the live DB (the current, vulnerable behavior lets
 * these calls succeed) — that failure is itself the regression signal
 * proving the gap is real and still open. Once applied, all tests here
 * should pass. Skipped without SUPABASE_DB_URL; see TESTING.md.
 *
 * Uses the real, standing "QA Plumbing Pro" fixture
 * (FIXTURES.qaPlumbingProvider) exactly as it exists live —
 * is_published=true, verification_status='submitted' (never verified),
 * cleared for FIXTURES.homeServicesCategory. No fixture data is
 * fabricated by this suite.
 */
describe.skipIf(!DB_URL)("provider eligibility (MARKETPLACE-SECURITY-002/003)", () => {
  it("direct INSERT into service_transactions is rejected at the grant layer (SEC-P0-001 primary fix)", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      try {
        await tx`
          insert into service_transactions
            (customer_id, provider_id, service_id, category_id, pricing_model, fulfilment_mode, state,
             currency, service_amount_minor, platform_fee_minor, requested_at)
          values
            (${FIXTURES.customer}, ${FIXTURES.qaPlumbingProvider}, ${FIXTURES.service}, ${FIXTURES.category},
             'fixed', 'on_site_customer_absent', 'settled', 'KES', 99999900, 0, now())
        `;
        return "FAIL: insert succeeded";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).not.toBe("FAIL: insert succeeded");
    // Primary defense (-003): the INSERT grant itself is revoked from
    // anon/authenticated, so this fails before the trigger (secondary
    // defense-in-depth) ever evaluates.
    expect(outcome).toContain("permission denied for table service_transactions");
  });

  it("direct INSERT into quotes bypassing rpc_submit_quote is still ownership-scoped but not eligibility-scoped (documented residual gap)", async () => {
    // This is NOT expected to be rejected once the fix is applied — see
    // SECURITY_AUTHORIZATION_MATRIX.md's "Residual gap" section. Included
    // here so a future decision to close this gap has a test to flip.
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [req] = await tx`
        insert into service_requests (customer_id, category_id, title, description, contact_phone)
        values (${FIXTURES.customer}, ${FIXTURES.homeServicesCategory}, 'test request', 'test description body', '0700000000')
        returning id
      `;
      await asUser(tx, FIXTURES.qaPlumbingProviderUserId);
      try {
        const [quote] = await tx`
          insert into quotes (request_id, provider_id, amount_minor, message)
          values (${req.id}, ${FIXTURES.qaPlumbingProvider}, 500000, 'test')
          returning id
        `;
        return quote.id ? "insert succeeded" : "FAIL: no id returned";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).toBe("insert succeeded");
  });

  it("rpc_book_service rejects an unverified provider even when category-cleared", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      try {
        await tx`select rpc_book_service(${FIXTURES.plumbingRepairService}, ${FIXTURES.qaPlumbingProvider}, null, now() + interval '3 days', 'test', '0700000000', null)`;
        return "FAIL: booking succeeded";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).not.toBe("FAIL: booking succeeded");
    expect(outcome).toContain("not available for booking");
  });

  it("rpc_submit_quote rejects an unverified provider even with a matching category on their profile", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [req] = await tx`
        insert into service_requests (customer_id, category_id, title, description, contact_phone)
        values (${FIXTURES.customer}, ${FIXTURES.homeServicesCategory}, 'test request', 'test description body', '0700000000')
        returning id
      `;
      await asUser(tx, FIXTURES.qaPlumbingProviderUserId);
      try {
        await tx`select rpc_submit_quote(${req.id}, 500000, 'test quote')`;
        return "FAIL: quote succeeded";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).not.toBe("FAIL: quote succeeded");
    expect(outcome).toContain("not yet eligible to quote");
  });

  it("rpc_book_service succeeds once the same provider is legitimately verified", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.superAdmin);
      await tx`select rpc_set_verification_status(${FIXTURES.qaPlumbingProvider}, 'verified', 'test')`;
      await asPostgres(tx);

      await asUser(tx, FIXTURES.customer);
      const [txn] = await tx`select rpc_book_service(${FIXTURES.plumbingRepairService}, ${FIXTURES.qaPlumbingProvider}, null, now() + interval '3 days', 'test', '0700000000', null) as id`;
      await asPostgres(tx);

      const [row] = await tx`select state from service_transactions where id = ${txn.id}`;
      return row.state;
    });
    expect(outcome).toBe("requested");
  });

  it("a non-existent provider ID is rejected with a generic, non-leaking error", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      try {
        await tx`select rpc_book_service(${FIXTURES.plumbingRepairService}, '00000000-0000-0000-0000-000000000000', null, now() + interval '3 days', 'test', '0700000000', null)`;
        return "FAIL: booking succeeded";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).toBe("This professional is not available for booking.");
  });

  it("quotes.state is constrained to the documented set of values", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [req] = await tx`
        insert into service_requests (customer_id, category_id, title, description, contact_phone)
        values (${FIXTURES.customer}, ${FIXTURES.homeServicesCategory}, 'test request', 'test description body', '0700000000')
        returning id
      `;
      const [quote] = await tx`
        insert into quotes (request_id, provider_id, amount_minor, message)
        values (${req.id}, ${FIXTURES.provider}, 500000, 'test')
        returning id
      `;
      try {
        await tx`update quotes set state = 'bogus_state' where id = ${quote.id}`;
        return "FAIL: invalid state accepted";
      } catch (e) {
        return (e as Error).message;
      }
    });
    expect(outcome).not.toBe("FAIL: invalid state accepted");
    expect(outcome).toContain("quotes_state_check");
  });

  it("service_requests.state cannot be forged to 'awarded' by a direct client UPDATE (SEC-P0-004)", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [req] = await tx`
        insert into service_requests (customer_id, category_id, title, description, contact_phone)
        values (${FIXTURES.customer}, ${FIXTURES.homeServicesCategory}, 'test request', 'test description body', '0700000000')
        returning id
      `;
      await asUser(tx, FIXTURES.customer);
      try {
        await tx`update service_requests set state = 'awarded' where id = ${req.id}`;
        return "FAIL: forged state accepted";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).not.toBe("FAIL: forged state accepted");
  });

  it("a provider flagged is_test_fixture cannot also be is_published (schema-level guarantee)", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.superAdmin);
      try {
        await tx`update providers set is_test_fixture = true, is_published = true where id = ${FIXTURES.qaPlumbingProvider}`;
        return "FAIL: test-fixture provider was published";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).not.toBe("FAIL: test-fixture provider was published");
    expect(outcome).toContain("providers_test_fixture_not_published");
  });

  it("rpc_accept_quote rejects acceptance once the quoting provider has been suspended after quoting (SEC-P1-001 TOCTOU)", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.superAdmin);
      await tx`select rpc_set_verification_status(${FIXTURES.qaPlumbingProvider}, 'verified', 'test')`;
      await asPostgres(tx);

      const [req] = await tx`
        insert into service_requests (customer_id, category_id, title, description, contact_phone)
        values (${FIXTURES.customer}, ${FIXTURES.homeServicesCategory}, 'test request', 'test description body', '0700000000')
        returning id
      `;

      await asUser(tx, FIXTURES.qaPlumbingProviderUserId);
      const [quote] = await tx`select rpc_submit_quote(${req.id}, 500000, 'test quote') as id`;
      await asPostgres(tx);

      // Suspension requires dual control (GOV-P4): propose as one admin,
      // decide as a second, different admin — a single rpc_admin_set_provider_suspended
      // call only creates a pending approval, it does not execute.
      await asUser(tx, FIXTURES.superAdmin);
      const [approval] = await tx`select rpc_admin_set_provider_suspended(${FIXTURES.qaPlumbingProvider}, true, 'test suspension') as id`;
      await asPostgres(tx);

      await asUser(tx, FIXTURES.secondAdmin);
      await tx`select rpc_decide_admin_action(${approval.id}, 'approve')`;
      await asPostgres(tx);

      await asUser(tx, FIXTURES.customer);
      try {
        await tx`select rpc_accept_quote(${quote.id})`;
        return "FAIL: acceptance succeeded for a suspended provider";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).not.toBe("FAIL: acceptance succeeded for a suspended provider");
  });

  it("rpc_accept_quote succeeds end-to-end for an eligible provider and creates a valid transaction", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.superAdmin);
      await tx`select rpc_set_verification_status(${FIXTURES.qaPlumbingProvider}, 'verified', 'test')`;
      await asPostgres(tx);

      const [req] = await tx`
        insert into service_requests (customer_id, category_id, title, description, contact_phone)
        values (${FIXTURES.customer}, ${FIXTURES.homeServicesCategory}, 'test request', 'test description body', '0700000000')
        returning id
      `;

      await asUser(tx, FIXTURES.qaPlumbingProviderUserId);
      const [quote] = await tx`select rpc_submit_quote(${req.id}, 500000, 'test quote') as id`;
      await asPostgres(tx);

      await asUser(tx, FIXTURES.customer);
      const [txn] = await tx`select rpc_accept_quote(${quote.id}) as id`;
      await asPostgres(tx);

      const [txnRow] = await tx`select id, state, provider_id from service_transactions where id = ${txn.id}`;
      const [reqRow] = await tx`select state, transaction_id from service_requests where id = ${req.id}`;
      return { txnId: txnRow.id, txnState: txnRow.state, txnProvider: txnRow.provider_id, reqState: reqRow.state, reqTxnId: reqRow.transaction_id };
    });
    expect(outcome.txnProvider).toBe(FIXTURES.qaPlumbingProvider);
    expect(outcome.reqState).toBe("awarded");
    expect(outcome.reqTxnId).toBe(outcome.txnId);
  });

  it("rpc_book_service is idempotent for a repeated idempotency_key (no duplicate transaction)", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.superAdmin);
      await tx`select rpc_set_verification_status(${FIXTURES.qaPlumbingProvider}, 'verified', 'test')`;
      await asPostgres(tx);

      await asUser(tx, FIXTURES.customer);
      const idempotencyKey = `test-idem-${Date.now()}`;
      const [first] = await tx`select rpc_book_service(${FIXTURES.plumbingRepairService}, ${FIXTURES.qaPlumbingProvider}, null, now() + interval '3 days', 'test', '0700000000', ${idempotencyKey}) as id`;
      const [second] = await tx`select rpc_book_service(${FIXTURES.plumbingRepairService}, ${FIXTURES.qaPlumbingProvider}, null, now() + interval '3 days', 'test', '0700000000', ${idempotencyKey}) as id`;
      await asPostgres(tx);

      const rows = await tx`select id from service_transactions where customer_id = ${FIXTURES.customer} and provider_id = ${FIXTURES.qaPlumbingProvider}`;
      return { firstId: first.id, secondId: second.id, count: rows.length };
    });
    expect(outcome.firstId).toBe(outcome.secondId);
    expect(outcome.count).toBe(1);
  });
});

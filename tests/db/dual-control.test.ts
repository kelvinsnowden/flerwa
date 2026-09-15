import { describe, it, expect } from "vitest";
import { DB_URL, withRolledBackTransaction, asUser, asPostgres, FIXTURES } from "./client";

/**
 * SEC-001 tier 1 — PAY-004 / GOV-P4 dual control. Converts the manual,
 * one-off role-simulated verification run live against the project
 * during this session into a permanent, re-runnable regression test:
 * without this, a future migration could silently reintroduce the exact
 * bug SEC-013 found (an _execute_* function reachable without going
 * through rpc_decide_admin_action) with nothing to catch it.
 *
 * Skipped when SUPABASE_DB_URL isn't set (see TESTING.md) rather than
 * failing the whole suite — this tier needs real database credentials
 * that aren't available in every environment this repo's tests run in.
 */
describe.skipIf(!DB_URL)("dual control: rpc_confirm_manual_payment (PAY-004)", () => {
  it("propose alone does not fund the transaction", async () => {
    const state = await withRolledBackTransaction(async (tx) => {
      const [txn] = await tx`
        insert into service_transactions
          (customer_id, provider_id, service_id, category_id, pricing_model, fulfilment_mode, state,
           currency, service_amount_minor, platform_fee_minor, requested_at)
        values
          (${FIXTURES.customer}, ${FIXTURES.provider}, ${FIXTURES.service}, ${FIXTURES.category},
           'fixed', 'on_site_customer_absent', 'requested', 'KES', 600000, 48000, now())
        returning id
      `;

      await asUser(tx, FIXTURES.superAdmin);
      await tx`select rpc_confirm_manual_payment(${txn.id}, 'TEST-REF', 'test')`;
      await asPostgres(tx);

      const [after] = await tx`select state from service_transactions where id = ${txn.id}`;
      return after.state;
    });

    expect(state).toBe("requested");
  });

  it("blocks the proposer from deciding their own proposal", async () => {
    const message = await withRolledBackTransaction(async (tx) => {
      const [txn] = await tx`
        insert into service_transactions
          (customer_id, provider_id, service_id, category_id, pricing_model, fulfilment_mode, state,
           currency, service_amount_minor, platform_fee_minor, requested_at)
        values
          (${FIXTURES.customer}, ${FIXTURES.provider}, ${FIXTURES.service}, ${FIXTURES.category},
           'fixed', 'on_site_customer_absent', 'requested', 'KES', 600000, 48000, now())
        returning id
      `;

      await asUser(tx, FIXTURES.superAdmin);
      const [approval] = await tx`select rpc_confirm_manual_payment(${txn.id}, 'TEST-REF', 'test') as id`;

      try {
        await tx`select rpc_decide_admin_action(${approval.id}, 'approve')`;
        return "NO_ERROR";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });

    expect(message).toContain("A different admin must approve or reject this");
  });

  it("a distinct admin's approval funds the transaction with a balanced ledger", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [txn] = await tx`
        insert into service_transactions
          (customer_id, provider_id, service_id, category_id, pricing_model, fulfilment_mode, state,
           currency, service_amount_minor, platform_fee_minor, requested_at)
        values
          (${FIXTURES.customer}, ${FIXTURES.provider}, ${FIXTURES.service}, ${FIXTURES.category},
           'fixed', 'on_site_customer_absent', 'requested', 'KES', 600000, 48000, now())
        returning id
      `;

      await asUser(tx, FIXTURES.superAdmin);
      const [approval] = await tx`select rpc_confirm_manual_payment(${txn.id}, 'TEST-REF', 'test') as id`;
      await asPostgres(tx);

      await asUser(tx, FIXTURES.secondAdmin);
      await tx`select rpc_decide_admin_action(${approval.id}, 'approve')`;
      await asPostgres(tx);

      const [after] = await tx`select state from service_transactions where id = ${txn.id}`;
      const [ledger] = await tx`
        select coalesce(sum(case when direction = 'debit' then amount_minor else -amount_minor end), 0) as net
        from ledger_entries where transaction_id = ${txn.id}
      `;
      const [payment] = await tx`select count(*)::int as n from payments where transaction_id = ${txn.id} and state = 'funded'`;

      return { state: after.state, ledgerNet: Number(ledger.net), paymentCount: payment.n };
    });

    expect(outcome.state).toBe("funded");
    expect(outcome.ledgerNet).toBe(0);
    expect(outcome.paymentCount).toBe(1);
  });
});

describe.skipIf(!DB_URL)("dual control: _execute_* functions are not directly callable (SEC-013)", () => {
  it("anon/authenticated cannot execute _execute_refund, _execute_confirm_manual_payment, or _execute_force_resolve_stuck_transaction directly", async () => {
    const rows = await withRolledBackTransaction(async (tx) => {
      return tx`
        select p.proname, r.rolname, has_function_privilege(r.oid, p.oid, 'EXECUTE') as can_execute
        from pg_proc p
        cross join (select rolname, oid from pg_roles where rolname in ('anon', 'authenticated')) r
        where p.proname in (
          '_execute_refund', '_execute_suspend_customer', '_execute_suspend_provider',
          '_execute_category_pause', '_execute_confirm_manual_payment', '_execute_force_resolve_stuck_transaction'
        )
      `;
    });

    for (const row of rows) {
      expect(row.can_execute, `${row.proname} should not be executable by ${row.rolname}`).toBe(false);
    }
    // If this list ever comes back empty, the function names changed —
    // fail loudly rather than passing on nothing.
    expect(rows.length).toBeGreaterThan(0);
  });
});

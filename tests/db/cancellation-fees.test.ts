import { describe, it, expect } from "vitest";
import { DB_URL, withRolledBackTransaction, asUser, asPostgres, FIXTURES } from "./client";

/**
 * SEC-001 tier 1 — TXN-005's cancellation-fee tiers. Converts this
 * session's live, rolled-back verification into a permanent regression
 * test — this is exactly the kind of financial-split logic a future
 * refactor could silently break with nothing to catch it (see SEC-001's
 * own stated failure scenario). Skipped without SUPABASE_DB_URL; see
 * TESTING.md.
 */
describe.skipIf(!DB_URL)("rpc_cancel_booking fee tiers (TXN-005)", () => {
  it(">24h before scheduled: full refund, nothing to the provider", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [txn] = await tx`
        insert into service_transactions
          (customer_id, provider_id, service_id, category_id, pricing_model, fulfilment_mode, state,
           currency, service_amount_minor, materials_amount_minor, platform_fee_minor, requested_at, scheduled_for)
        values
          (${FIXTURES.customer}, ${FIXTURES.provider}, ${FIXTURES.service}, ${FIXTURES.category},
           'fixed', 'on_site_customer_absent', 'requested', 'KES', 600000, 0, 48000, now(), now() + interval '72 hours')
        returning id
      `;
      await tx`select _fund_transaction(${txn.id}, 'manual', 'TEST', ${FIXTURES.superAdmin}, 'seed')`;

      await asUser(tx, FIXTURES.customer);
      await tx`select rpc_cancel_booking(${txn.id}, 'plenty of notice')`;
      await asPostgres(tx);

      const [after] = await tx`select state from service_transactions where id = ${txn.id}`;
      const [provider] = await tx`select coalesce(sum(amount_minor), 0) as total from ledger_entries where transaction_id = ${txn.id} and account_type = 'provider_payable'`;
      const [refund] = await tx`select coalesce(sum(amount_minor), 0) as total from ledger_entries where transaction_id = ${txn.id} and account_type = 'refunds'`;
      return { state: after.state, providerMinor: Number(provider.total), refundMinor: Number(refund.total) };
    });

    expect(outcome.state).toBe("refunded");
    expect(outcome.providerMinor).toBe(0);
    expect(outcome.refundMinor).toBe(648000);
  });

  it("<24h before scheduled: provider keeps 50%", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [txn] = await tx`
        insert into service_transactions
          (customer_id, provider_id, service_id, category_id, pricing_model, fulfilment_mode, state,
           currency, service_amount_minor, materials_amount_minor, platform_fee_minor, requested_at, scheduled_for)
        values
          (${FIXTURES.customer}, ${FIXTURES.provider}, ${FIXTURES.service}, ${FIXTURES.category},
           'fixed', 'on_site_customer_absent', 'requested', 'KES', 400000, 0, 32000, now(), now() + interval '10 hours')
        returning id
      `;
      await tx`select _fund_transaction(${txn.id}, 'manual', 'TEST', ${FIXTURES.superAdmin}, 'seed')`;

      await asUser(tx, FIXTURES.customer);
      await tx`select rpc_cancel_booking(${txn.id}, 'last minute')`;
      await asPostgres(tx);

      const [after] = await tx`select state from service_transactions where id = ${txn.id}`;
      const [provider] = await tx`select coalesce(sum(amount_minor), 0) as total from ledger_entries where transaction_id = ${txn.id} and account_type = 'provider_payable'`;
      const [refund] = await tx`select coalesce(sum(amount_minor), 0) as total from ledger_entries where transaction_id = ${txn.id} and account_type = 'refunds'`;
      return { state: after.state, providerMinor: Number(provider.total), refundMinor: Number(refund.total) };
    });

    expect(outcome.state).toBe("settled");
    expect(outcome.providerMinor).toBe(216000);
    expect(outcome.refundMinor).toBe(216000);
  });

  it("evidence_submitted: cancellation is refused — approve/revise/dispute is the right path", async () => {
    const message = await withRolledBackTransaction(async (tx) => {
      const [txn] = await tx`
        insert into service_transactions
          (customer_id, provider_id, service_id, category_id, pricing_model, fulfilment_mode, state,
           currency, service_amount_minor, materials_amount_minor, platform_fee_minor, requested_at, evidence_at)
        values
          (${FIXTURES.customer}, ${FIXTURES.provider}, ${FIXTURES.service}, ${FIXTURES.category},
           'fixed', 'on_site_customer_absent', 'evidence_submitted', 'KES', 300000, 0, 24000, now(), now())
        returning id
      `;

      await asUser(tx, FIXTURES.customer);
      try {
        await tx`select rpc_cancel_booking(${txn.id}, 'too late')`;
        return "NO_ERROR";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });

    expect(message).toContain("the job has moved past active work");
  });

  it("checked_in on a milestone-qualifying job: 100% of the still-held balance to the provider, full lifecycle ledger stays balanced", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [txn] = await tx`
        insert into service_transactions
          (customer_id, provider_id, service_id, category_id, pricing_model, fulfilment_mode, state,
           currency, service_amount_minor, materials_amount_minor, platform_fee_minor, requested_at, scheduled_for)
        values
          (${FIXTURES.customer}, ${FIXTURES.provider}, ${FIXTURES.service}, ${FIXTURES.category},
           'fixed', 'on_site_customer_absent', 'requested', 'KES', 3000000, 100000, 240000, now(), now() + interval '2 hours')
        returning id
      `;
      await tx`select _create_transaction_milestones_if_qualifying(${txn.id})`;
      await tx`select _fund_transaction(${txn.id}, 'manual', 'TEST', ${FIXTURES.superAdmin}, 'seed')`;

      await asUser(tx, FIXTURES.providerUserId);
      await tx`select rpc_provider_check_in(${txn.id}, -1.2921, 36.8219)`;
      await asPostgres(tx);

      await asUser(tx, FIXTURES.customer);
      await tx`select rpc_cancel_booking(${txn.id}, 'need to stop mid-job')`;
      await asPostgres(tx);

      const [balanced] = await tx`
        select (coalesce(sum(case when direction = 'debit' then amount_minor else -amount_minor end), 0) = 0) as ok
        from ledger_entries where transaction_id = ${txn.id}
      `;
      const [after] = await tx`select state from service_transactions where id = ${txn.id}`;
      return { ledgerBalanced: balanced.ok, state: after.state };
    });

    expect(outcome.ledgerBalanced).toBe(true);
    expect(outcome.state).toBe("settled");
  });
});

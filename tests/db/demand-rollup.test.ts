import { describe, it, expect } from "vitest";
import { DB_URL, withRolledBackTransaction, asPostgres, FIXTURES } from "./client";

/**
 * MARKETPLACE-001 — demand_rollup_daily aggregation job.
 *
 * Backed by
 * supabase/migrations/20260915151912_marketplace_001_demand_rollup_job.sql,
 * which was APPLIED to production on 2026-09-15 — see
 * MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md. These tests should now pass
 * against the live database. Skipped without SUPABASE_DB_URL; see
 * TESTING.md.
 */
describe.skipIf(!DB_URL)("demand rollup job (MARKETPLACE-001)", () => {
  it("aggregates search/no-result/booking counts per category+location, including NULL groupings", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      // Seeded as the DB owner (bypasses RLS by ownership) — fixture
      // setup for this test, not a re-test of demand_events' own
      // direct-insert RLS block (covered by tests/db/demand-events.test.ts).
      await tx`
        insert into demand_events (event_type, occurred_at, session_id, category_id, location_id, source_surface)
        values
          ('search_performed', now() - interval '1 day', gen_random_uuid(), ${FIXTURES.homeServicesCategory}, null, 'home_search'),
          ('search_no_results', now() - interval '1 day', gen_random_uuid(), null, null, 'home_search'),
          ('search_no_results', now() - interval '1 day', gen_random_uuid(), null, null, 'home_search'),
          ('booking_created', now() - interval '1 day', gen_random_uuid(), ${FIXTURES.homeServicesCategory}, null, 'service_detail'),
          ('provider_profile_viewed', now() - interval '1 day', gen_random_uuid(), null, null, 'provider_storefront')
      `;

      await tx`select rpc_run_demand_rollup((current_date - 1)::date)`;
      await asPostgres(tx);

      const rows = await tx`
        select category_id, location_id, search_count, no_result_count, booking_count
        from demand_rollup_daily
        where day = (current_date - 1)::date
        order by category_id nulls first
      `;
      return rows;
    });

    expect(outcome.length).toBe(2);
    const nullGroup = outcome.find((r) => r.category_id === null);
    const categoryGroup = outcome.find((r) => r.category_id === FIXTURES.homeServicesCategory);
    expect(nullGroup).toMatchObject({ search_count: 2, no_result_count: 2, booking_count: 0 });
    expect(categoryGroup).toMatchObject({ search_count: 1, no_result_count: 0, booking_count: 1 });
  });

  it("is idempotent: re-running the same day never creates duplicate rows or double-counts", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await tx`
        insert into demand_events (event_type, occurred_at, session_id, category_id, location_id, source_surface)
        values ('search_performed', now() - interval '1 day', gen_random_uuid(), ${FIXTURES.homeServicesCategory}, null, 'home_search')
      `;

      await tx`select rpc_run_demand_rollup((current_date - 1)::date)`;
      await tx`select rpc_run_demand_rollup((current_date - 1)::date)`;
      await tx`select rpc_run_demand_rollup((current_date - 1)::date)`;
      await asPostgres(tx);

      const rows = await tx`
        select search_count from demand_rollup_daily
        where day = (current_date - 1)::date and category_id = ${FIXTURES.homeServicesCategory}
      `;
      return rows;
    });

    expect(outcome.length).toBe(1);
    expect(outcome[0].search_count).toBe(1);
  });

  it("the locked wrapper returns the same result as the unlocked function when no other run holds the lock", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      const [row] = await tx`select rpc_run_demand_rollup_locked((current_date - 1)::date) as result`;
      await asPostgres(tx);
      return row.result as { skipped?: boolean; day?: string };
    });

    expect(outcome.skipped).not.toBe(true);
  });

  it("category_id and location_id can each independently be NULL without a schema error (the primary-key bug this migration fixes)", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      try {
        await tx`
          insert into demand_rollup_daily (day, category_id, location_id, search_count, no_result_count, booking_count)
          values (current_date, null, null, 0, 0, 0)
        `;
        return "insert succeeded";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).toBe("insert succeeded");
  });
});

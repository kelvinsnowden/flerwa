import { describe, it, expect } from "vitest";
import { DB_URL, withRolledBackTransaction, asUser, asPostgres, FIXTURES } from "./client";

/**
 * MARKETPLACE-001 — demand-event instrumentation (Phase 3/7).
 *
 * Backed by
 * supabase/migrations/20260915143409_marketplace_001_demand_events.sql,
 * which was APPLIED to production on 2026-09-15 — see
 * MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md. These tests should now pass
 * against the live database. Skipped without SUPABASE_DB_URL; see
 * TESTING.md.
 */
describe.skipIf(!DB_URL)("demand events (MARKETPLACE-001)", () => {
  it("rpc_log_demand_event records an event and returns its id", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      const [row] =
        await tx`select rpc_log_demand_event('search_performed', gen_random_uuid(), 'home_search', null, null, null, null, 'test search', null, 3, null, null, '{}'::jsonb) as id`;
      await asPostgres(tx);
      return row.id as string | null;
    });
    expect(outcome).toBeTruthy();
  });

  it("a repeated dedup_key returns the SAME id and does not create a second row", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      const key = `test-dedup-${Date.now()}`;
      const [first] =
        await tx`select rpc_log_demand_event('service_viewed', gen_random_uuid(), 'service_detail', null, null, null, null, null, null, null, null, ${key}, '{}'::jsonb) as id`;
      const [second] =
        await tx`select rpc_log_demand_event('service_viewed', gen_random_uuid(), 'service_detail', null, null, null, null, null, null, null, null, ${key}, '{}'::jsonb) as id`;
      await asPostgres(tx);
      const rows = await tx`select id from demand_events where dedup_key = ${key}`;
      return { firstId: first.id, secondId: second.id, count: rows.length };
    });
    expect(outcome.firstId).toBe(outcome.secondId);
    expect(outcome.count).toBe(1);
  });

  it("a direct client INSERT into demand_events is rejected (no insert policy — RPC-only write path)", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      try {
        await tx`insert into demand_events (event_type, session_id, source_surface) values ('search_performed', gen_random_uuid(), 'direct_attempt')`;
        return "FAIL: insert succeeded";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).not.toBe("FAIL: insert succeeded");
    expect(outcome).toContain("row-level security policy");
  });

  it("a non-admin cannot SELECT demand_events (RLS filters silently, not an error)", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      const [row] =
        await tx`select rpc_log_demand_event('search_performed', gen_random_uuid(), 'home_search', null, null, null, null, null, null, null, null, null, '{}'::jsonb) as id`;
      const rows = await tx`select id from demand_events`;
      await asPostgres(tx);
      return { loggedAnId: !!row.id, visibleRowCount: rows.length };
    });
    expect(outcome.loggedAnId).toBe(true);
    expect(outcome.visibleRowCount).toBe(0);
  });

  it("an admin CAN select demand_events", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      await tx`select rpc_log_demand_event('search_performed', gen_random_uuid(), 'home_search', null, null, null, null, null, null, null, null, null, '{}'::jsonb)`;
      await asPostgres(tx);

      await asUser(tx, FIXTURES.superAdmin);
      const rows = await tx`select id from demand_events`;
      await asPostgres(tx);
      return rows.length;
    });
    expect(outcome).toBeGreaterThanOrEqual(1);
  });

  it("anon (not signed in) can also log a browsing event", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await tx`set local role anon`;
      const [row] =
        await tx`select rpc_log_demand_event('search_no_results', gen_random_uuid(), 'home_search', null, null, null, null, 'zzzznoresults', null, 0, null, null, '{}'::jsonb) as id`;
      await tx`reset role`;
      return row.id as string | null;
    });
    expect(outcome).toBeTruthy();
  });

  it("search_term longer than 200 characters is rejected by the length CHECK constraint", async () => {
    const outcome = await withRolledBackTransaction(async (tx) => {
      await asUser(tx, FIXTURES.customer);
      try {
        const longTerm = "a".repeat(201);
        await tx`select rpc_log_demand_event('search_performed', gen_random_uuid(), 'home_search', null, null, null, null, ${longTerm}, null, null, null, null, '{}'::jsonb)`;
        return "FAIL: long search term accepted";
      } catch (e) {
        return (e as Error).message;
      } finally {
        await asPostgres(tx);
      }
    });
    expect(outcome).not.toBe("FAIL: long search term accepted");
    expect(outcome).toContain("demand_events_search_term_length");
  });
});

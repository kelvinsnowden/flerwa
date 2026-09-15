import postgres from "postgres";

/**
 * SEC-001 tier 1: DB/RLS tests. Requires a direct Postgres connection
 * string (SUPABASE_DB_URL — the "Connection string" from Supabase
 * dashboard > Project Settings > Database, NOT the anon/service-role API
 * keys, which don't grant a raw SQL connection). Not set in the sandbox
 * this suite was originally written in — see TESTING.md for why, and
 * what running it for real requires. Every test in this tier must use
 * withRolledBackTransaction so nothing here ever touches real data.
 */
export const DB_URL = process.env.SUPABASE_DB_URL;

class RollbackSentinel extends Error {}

export async function withRolledBackTransaction<T>(
  fn: (tx: postgres.TransactionSql) => Promise<T>
): Promise<T> {
  if (!DB_URL) throw new Error("SUPABASE_DB_URL not set — see TESTING.md");
  const sql = postgres(DB_URL, { max: 1 });
  let result: T;
  try {
    try {
      await sql.begin(async (tx) => {
        result = await fn(tx);
        throw new RollbackSentinel();
      });
    } catch (e) {
      if (!(e instanceof RollbackSentinel)) throw e;
    }
  } finally {
    await sql.end();
  }
  return result!;
}

/** Same role-simulation pattern used manually throughout this project's
 * live verification: SET LOCAL role + request.jwt.claims, scoped to the
 * current transaction only. */
export async function asUser(tx: postgres.TransactionSql, userId: string) {
  await tx`set local role authenticated`;
  await tx`select set_config('request.jwt.claims', ${JSON.stringify({ sub: userId, role: "authenticated" })}, true)`;
}

export async function asPostgres(tx: postgres.TransactionSql) {
  await tx`reset role`;
}

/**
 * Stable fixture UUIDs already seeded in the live project (see
 * supabase/migrations/*qa_fixtures* and this session's own manual
 * verification transcripts, which used the same IDs throughout). A more
 * mature suite would create fully synthetic fixtures per test instead of
 * depending on specific seeded rows continuing to exist — tracked as a
 * known simplification in TESTING.md, not silently assumed.
 */
export const FIXTURES = {
  customer: "11111111-aaaa-0000-0000-000000000001",
  provider: "22222222-aaaa-0000-0000-000000000001",
  providerUserId: "11111111-aaaa-0000-0000-000000000002",
  service: "c47fced4-f9c1-4a53-8f82-ad5af74d71ce",
  category: "280de33a-6853-4aad-bcce-0018d4ae03c4",
  homeServicesCategory: "b8e3330d-9e01-4fa5-8bcd-63c93bcf17a9",
  superAdmin: "44444444-aaaa-0000-0000-000000000003",
  secondAdmin: "36839847-bd0f-49fd-aa3a-168dc11756f4",
  // QA Plumbing Pro: a real, live, standing test fixture (see
  // MARKETPLACE_REMEDIATION_REGISTER.md / SECURITY_READINESS_REGISTER.md)
  // — is_published=true, verification_status='submitted' (never
  // verified), is_accepting_work=true, is_suspended=false, cleared for
  // homeServicesCategory. Its real, current "unverified" state is what
  // MARKETPLACE-SECURITY-002's provider-eligibility tests exercise —
  // no fixture data was fabricated for this suite.
  qaPlumbingProvider: "aa332618-bf31-4af2-b699-f8bba7b47bdb",
  qaPlumbingProviderUserId: "113f57de-b636-4f5e-b819-54a5c556f94c",
  plumbingRepairService: "99cd48b5-1f08-4bc6-8422-227888c5d2f9",
} as const;

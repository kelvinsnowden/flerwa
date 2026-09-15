import { describe, it, expect } from "vitest";
import { checkProviderEligibility, rankEligibleProviders, type EligibilityInput } from "./provider-ranking";
import type { ReliabilityScore } from "./types";

function provider(overrides: Partial<EligibilityInput> = {}): EligibilityInput {
  return {
    is_published: true,
    verification_status: "verified",
    is_accepting_work: true,
    is_suspended: false,
    is_test_fixture: false,
    ...overrides,
  };
}

function reliability(overrides: Partial<ReliabilityScore> = {}): ReliabilityScore {
  return {
    provider_id: "p",
    jobs_completed: 0,
    jobs_accepted: 0,
    completion_rate: null,
    on_time_rate: null,
    cancellation_rate: null,
    dispute_count: 0,
    avg_rating: null,
    score: null,
    sample_size: 0,
    computed_at: "2026-01-01T00:00:00Z",
    ...overrides,
  };
}

describe("checkProviderEligibility", () => {
  it("a fully eligible provider passes with no reasons", () => {
    const result = checkProviderEligibility(provider(), true);
    expect(result.eligible).toBe(true);
    expect(result.reasons).toEqual([]);
  });

  it("excludes a test/QA fixture regardless of every other flag", () => {
    const result = checkProviderEligibility(provider({ is_test_fixture: true }), true);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Test/QA fixture account — never eligible for real customers");
  });

  it("excludes an unpublished provider", () => {
    const result = checkProviderEligibility(provider({ is_published: false }), true);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Not published");
  });

  it("excludes an unverified provider with a status-specific reason", () => {
    const result = checkProviderEligibility(provider({ verification_status: "submitted" }), true);
    expect(result.eligible).toBe(false);
    expect(result.reasons.some((r) => r.includes("submitted"))).toBe(true);
  });

  it("excludes a provider not accepting work", () => {
    const result = checkProviderEligibility(provider({ is_accepting_work: false }), true);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Not currently accepting work");
  });

  it("excludes a suspended provider", () => {
    const result = checkProviderEligibility(provider({ is_suspended: true }), true);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Suspended");
  });

  it("excludes a provider not cleared for the category", () => {
    const result = checkProviderEligibility(provider(), false);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Not cleared for this category");
  });

  it("reports every failing condition at once, not just the first", () => {
    const result = checkProviderEligibility(provider({ is_published: false, is_suspended: true }), false);
    expect(result.eligible).toBe(false);
    expect(result.reasons).toContain("Not published");
    expect(result.reasons).toContain("Suspended");
    expect(result.reasons).toContain("Not cleared for this category");
    expect(result.reasons.length).toBe(3);
  });
});

describe("rankEligibleProviders", () => {
  it("orders by score descending", () => {
    const entries = [
      { provider: { id: "low" }, reliability: reliability({ score: 40, sample_size: 5 }) },
      { provider: { id: "high" }, reliability: reliability({ score: 90, sample_size: 5 }) },
      { provider: { id: "mid" }, reliability: reliability({ score: 65, sample_size: 5 }) },
    ];
    const ranked = rankEligibleProviders(entries, "seed");
    expect(ranked.map((r) => r.provider.id)).toEqual(["high", "mid", "low"]);
  });

  it("treats a provider with no reliability_scores row as a neutral, non-bottom score", () => {
    const entries = [
      { provider: { id: "new" }, reliability: undefined },
      { provider: { id: "poor" }, reliability: reliability({ score: 10, sample_size: 5 }) },
    ];
    const ranked = rankEligibleProviders(entries, "seed");
    // Neutral (50) beats an established poor score (10) — new providers
    // are not penalized to the bottom for lack of history.
    expect(ranked[0].provider.id).toBe("new");
    expect(ranked[0].explanation[0]).toContain("New provider");
  });

  it("is deterministic: identical input and seed produce identical order every time", () => {
    const entries = [
      { provider: { id: "a" }, reliability: reliability({ score: 70, sample_size: 5 }) },
      { provider: { id: "b" }, reliability: reliability({ score: 70, sample_size: 5, computed_at: "2026-01-02T00:00:00Z" }) },
      { provider: { id: "c" }, reliability: reliability({ score: 55, sample_size: 5 }) },
    ];
    const run1 = rankEligibleProviders(entries, "same-seed").map((r) => r.provider.id);
    const run2 = rankEligibleProviders(entries, "same-seed").map((r) => r.provider.id);
    const run3 = rankEligibleProviders(entries, "same-seed").map((r) => r.provider.id);
    expect(run1).toEqual(run2);
    expect(run2).toEqual(run3);
  });

  it("ties on score break by earlier computed_at (longer track record wins)", () => {
    const entries = [
      { provider: { id: "newer" }, reliability: reliability({ score: 70, sample_size: 5, computed_at: "2026-02-01T00:00:00Z" }) },
      { provider: { id: "older" }, reliability: reliability({ score: 70, sample_size: 5, computed_at: "2026-01-01T00:00:00Z" }) },
    ];
    const ranked = rankEligibleProviders(entries, "seed");
    expect(ranked.map((r) => r.provider.id)).toEqual(["older", "newer"]);
  });

  it("falls back to provider id as the final deterministic tiebreaker", () => {
    const entries = [
      { provider: { id: "zzz" }, reliability: undefined },
      { provider: { id: "aaa" }, reliability: undefined },
    ];
    const ranked = rankEligibleProviders(entries, "seed");
    expect(ranked.map((r) => r.provider.id)).toEqual(["aaa", "zzz"]);
  });

  it("does not reserve an exploration slot when there are fewer than 5 eligible providers", () => {
    const entries = Array.from({ length: 4 }, (_, i) => ({
      provider: { id: `p${i}` },
      reliability: reliability({ score: 90 - i * 10, sample_size: 0 }),
    }));
    const ranked = rankEligibleProviders(entries, "seed");
    expect(ranked.every((r) => !r.isExplorationSlot)).toBe(true);
    // Still ordered by score even though exploration is skipped.
    expect(ranked.map((r) => r.provider.id)).toEqual(["p0", "p1", "p2", "p3"]);
  });

  it("reserves the 5th slot for a low-history provider when at least 5 are eligible", () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, i) => ({
        provider: { id: `established${i}` },
        reliability: reliability({ score: 90 - i, sample_size: 20 }),
      })),
      { provider: { id: "newcomer" }, reliability: reliability({ score: 30, sample_size: 0 }) },
    ];
    const ranked = rankEligibleProviders(entries, "seed");
    expect(ranked[4].isExplorationSlot).toBe(true);
    expect(ranked[4].provider.id).toBe("newcomer");
    expect(ranked[4].explanation.some((e) => e.includes("Exploration slot"))).toBe(true);
    // Nobody else claims the flag.
    expect(ranked.filter((r) => r.isExplorationSlot).length).toBe(1);
  });

  it("exploration slot selection is deterministic per seed but can differ across seeds", () => {
    const entries = [
      ...Array.from({ length: 5 }, (_, i) => ({
        provider: { id: `established${i}` },
        reliability: reliability({ score: 90 - i, sample_size: 20 }),
      })),
      { provider: { id: "newcomer1" }, reliability: reliability({ score: 20, sample_size: 0 }) },
      { provider: { id: "newcomer2" }, reliability: reliability({ score: 21, sample_size: 1 }) },
    ];
    const rankedSeedA1 = rankEligibleProviders(entries, "day-1");
    const rankedSeedA2 = rankEligibleProviders(entries, "day-1");
    expect(rankedSeedA1.map((r) => r.provider.id)).toEqual(rankedSeedA2.map((r) => r.provider.id));
  });
});

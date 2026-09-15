import type { Provider, ReliabilityScore } from "./types";

/**
 * MARKETPLACE-001 Phase 5 — explainable, deterministic first-generation
 * provider eligibility + ranking. This module is DISPLAY-ONLY: it
 * decides what order providers appear in and what the admin inspector
 * shows, never what a booking is allowed to do. The real security
 * boundary is unchanged — rpc_book_service/rpc_submit_quote/
 * rpc_accept_quote independently re-check eligibility against a locked
 * database row (see SECURITY_READINESS_REGISTER.md). This file's
 * checkProviderEligibility mirrors that same predicate for UI/ranking
 * purposes only, and must be kept in sync with it by hand — there is no
 * shared source of truth between SQL and TypeScript.
 */

export type EligibilityInput = Pick<
  Provider,
  "is_published" | "verification_status" | "is_accepting_work" | "is_suspended" | "is_test_fixture"
>;

export interface EligibilityCheck {
  eligible: boolean;
  /** Empty when eligible. One entry per failed condition, in a fixed, deterministic order. */
  reasons: string[];
}

/** Mirrors the eligibility predicate in rpc_book_service / rpc_submit_quote / rpc_accept_quote. */
export function checkProviderEligibility(provider: EligibilityInput, categoryCleared: boolean): EligibilityCheck {
  const reasons: string[] = [];
  if (provider.is_test_fixture) reasons.push("Test/QA fixture account — never eligible for real customers");
  if (!provider.is_published) reasons.push("Not published");
  if (provider.verification_status !== "verified") {
    reasons.push(`Verification status is "${provider.verification_status}", not verified`);
  }
  if (!provider.is_accepting_work) reasons.push("Not currently accepting work");
  if (provider.is_suspended) reasons.push("Suspended");
  if (!categoryCleared) reasons.push("Not cleared for this category");
  return { eligible: reasons.length === 0, reasons };
}

/**
 * Neutral prior for a provider with no reliability_scores row yet (no
 * completed jobs). Matches the "cold start" behavior already built into
 * reliability_scores.score's own Bayesian-shrinkage formula — a
 * sample_size of 0 there already shrinks fully to the prior, so a new
 * provider is never penalized to the bottom for lack of history.
 */
const NEUTRAL_SCORE = 50;

/** Below this sample_size, a provider is eligible for the exploration slot. */
const LOW_HISTORY_THRESHOLD = 3;

/** 1 in EXPLORATION_SLOT_RATIO ranked positions is reserved for a qualified-but-low-history provider. */
const EXPLORATION_SLOT_RATIO = 5;

export interface RankableEntry<T> {
  provider: T;
  reliability: ReliabilityScore | undefined;
}

export interface RankedEntry<T> {
  provider: T;
  score: number;
  sampleSize: number;
  explanation: string[];
  isExplorationSlot: boolean;
}

/** Small, stable string hash — used only to deterministically pick an exploration-slot candidate for a given seed, never for anything security-sensitive. */
function stableHash(input: string): number {
  let h = 0;
  for (let i = 0; i < input.length; i++) {
    h = (Math.imul(31, h) + input.charCodeAt(i)) | 0;
  }
  return Math.abs(h);
}

/**
 * Ranks a set of ALREADY-ELIGIBLE providers. Deterministic for a given
 * input + explorationSeed (same inputs -> same output, including tie
 * order) — required so the ordering is reproducible and testable, not
 * literally random on every render. explorationSeed should rotate over
 * time (e.g. category id + calendar day) so different low-history
 * providers get the exploration slot on different days, giving fair
 * rotating exposure without making the order non-reproducible within a
 * single day.
 */
export function rankEligibleProviders<T extends { id: string }>(
  entries: RankableEntry<T>[],
  explorationSeed: string
): RankedEntry<T>[] {
  const base: RankedEntry<T>[] = entries.map(({ provider, reliability }) => {
    const sampleSize = reliability?.sample_size ?? 0;
    const score = reliability?.score ?? NEUTRAL_SCORE;
    const explanation: string[] =
      reliability && sampleSize > 0
        ? [`Reliability score ${score.toFixed(0)}/100 from ${sampleSize} completed job${sampleSize === 1 ? "" : "s"}`]
        : ["New provider — no completed jobs yet, scored at the neutral baseline"];
    return { provider, score, sampleSize, explanation, isExplorationSlot: false };
  });

  // Deterministic sort: score desc, then computed_at asc (longer track
  // record wins a tie — a provider who has been stable at this score
  // for longer is preferred over one who just arrived at it), then
  // provider id asc as the final, always-available tiebreaker.
  const computedAtById = new Map(entries.map((e) => [e.provider.id, e.reliability?.computed_at ?? null]));
  base.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    const aAt = computedAtById.get(a.provider.id);
    const bAt = computedAtById.get(b.provider.id);
    if (aAt !== bAt) {
      if (!aAt) return 1;
      if (!bAt) return -1;
      if (aAt !== bAt) return aAt < bAt ? -1 : 1;
    }
    return a.provider.id.localeCompare(b.provider.id);
  });

  if (base.length < EXPLORATION_SLOT_RATIO) {
    // Too few eligible providers to reserve a slot without just
    // reordering the whole list arbitrarily — skip exploration below
    // this size, documented and tested behavior, not an oversight.
    return base;
  }

  const lowHistoryIds = new Set(
    entries.filter((e) => (e.reliability?.sample_size ?? 0) < LOW_HISTORY_THRESHOLD).map((e) => e.provider.id)
  );
  // Candidates for the exploration slot: low-history providers not
  // already occupying the reserved position by natural rank.
  const explorationSlotIndex = EXPLORATION_SLOT_RATIO - 1; // 0-indexed: 5th position
  const alreadyThere = lowHistoryIds.has(base[explorationSlotIndex].provider.id);
  if (alreadyThere) {
    base[explorationSlotIndex].isExplorationSlot = true;
    base[explorationSlotIndex].explanation.push("Exploration slot — reserved rotating visibility for a qualified new provider");
    return base;
  }

  const candidates = base.filter((e, i) => i !== explorationSlotIndex && lowHistoryIds.has(e.provider.id));
  if (candidates.length === 0) return base; // no eligible new provider to explore with

  const chosen = candidates[stableHash(explorationSeed) % candidates.length];
  const withoutChosen = base.filter((e) => e.provider.id !== chosen.provider.id);
  const result = [
    ...withoutChosen.slice(0, explorationSlotIndex),
    { ...chosen, isExplorationSlot: true, explanation: [...chosen.explanation, "Exploration slot — reserved rotating visibility for a qualified new provider"] },
    ...withoutChosen.slice(explorationSlotIndex),
  ];
  return result;
}

import { describe, expect, it, vi, beforeEach } from "vitest";
import { correctTransactionAmount, reassignProvider, forceResolveStuckTransaction } from "./repair-actions";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * SEC-001 tier 2 — TXN-010/OPS-002 repair tools. The KSh-to-minor-unit
 * conversion (`Math.round(kes * 100)`) happens in this JS layer, not in
 * the RPC, so it's the one piece of real logic worth unit-testing here;
 * everything else (fee recompute, dual-control gating, the split-must-
 * equal-held-amount invariant) lives in the RPCs — see tests/db/.
 */
describe("admin transaction repair actions", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  describe("correctTransactionAmount", () => {
    it("converts KSh to minor units before calling the RPC", async () => {
      rpc.mockResolvedValue({ error: null });
      await correctTransactionAmount("txn-1", 8000, 500, "price correction");
      expect(rpc).toHaveBeenCalledWith("rpc_admin_correct_transaction_amount", {
        p_transaction_id: "txn-1",
        p_new_service_amount_minor: 800000,
        p_new_materials_amount_minor: 50000,
        p_reason: "price correction",
      });
    });

    it("surfaces the post-funding guard error", async () => {
      rpc.mockResolvedValue({ error: { message: "Cannot correct the amount after funding." } });
      const res = await correctTransactionAmount("txn-1", 8000, 0, "reason");
      expect(res).toEqual({ error: "Cannot correct the amount after funding." });
    });
  });

  describe("reassignProvider", () => {
    it("passes the new provider id and reason through unchanged", async () => {
      rpc.mockResolvedValue({ error: null });
      await reassignProvider("txn-1", "provider-2", "mis-assigned");
      expect(rpc).toHaveBeenCalledWith("rpc_admin_reassign_provider", {
        p_transaction_id: "txn-1",
        p_new_provider_id: "provider-2",
        p_reason: "mis-assigned",
      });
    });
  });

  describe("forceResolveStuckTransaction", () => {
    it("converts both KSh amounts to minor units", async () => {
      rpc.mockResolvedValue({ error: null });
      await forceResolveStuckTransaction("txn-1", 15000, 6000, "provider went silent after check-in");
      expect(rpc).toHaveBeenCalledWith("rpc_admin_force_resolve_stuck_transaction", {
        p_transaction_id: "txn-1",
        p_provider_minor: 1500000,
        p_customer_refund_minor: 600000,
        p_resolution: "provider went silent after check-in",
      });
    });

    it("only proposes — a rejected/pending outcome is not an error, just no execution yet", async () => {
      // rpc_admin_force_resolve_stuck_transaction returns an approval id on
      // success; the action doesn't need to inspect it, only surface a
      // real error if one comes back.
      rpc.mockResolvedValue({ data: "approval-id-123", error: null });
      const res = await forceResolveStuckTransaction("txn-1", 0, 100, "full refund proposal");
      expect(res).toEqual({ success: true });
    });
  });
});

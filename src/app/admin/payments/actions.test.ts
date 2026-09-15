import { describe, expect, it, vi, beforeEach } from "vitest";
import { confirmPayment } from "./actions";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * SEC-001 tier 2 — PAY-004. As of the dual-control retrofit,
 * rpc_confirm_manual_payment now only PROPOSES (a second, different
 * finance admin must decide from /admin/approvals) — this action's job
 * is unchanged (call the RPC, surface any error), but it's worth
 * pinning down explicitly that nothing here assumes the call funds the
 * transaction synchronously.
 */
describe("confirmPayment", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  it("rejects an empty reference before ever calling the RPC", async () => {
    const res = await confirmPayment("txn-1", "   ", "notes");
    expect(rpc).not.toHaveBeenCalled();
    expect(res).toEqual({ error: "An M-Pesa reference or receipt note is required." });
  });

  it("calls rpc_confirm_manual_payment with the trimmed-irrelevant reference and notes", async () => {
    rpc.mockResolvedValue({ error: null });
    const res = await confirmPayment("txn-1", "QK12ABC3", "customer paid via till");
    expect(rpc).toHaveBeenCalledWith("rpc_confirm_manual_payment", {
      p_transaction_id: "txn-1",
      p_external_reference: "QK12ABC3",
      p_notes: "customer paid via till",
    });
    expect(res).toEqual({ success: true });
  });

  it("nulls empty notes rather than sending an empty string", async () => {
    rpc.mockResolvedValue({ error: null });
    await confirmPayment("txn-1", "QK12ABC3", "");
    expect(rpc).toHaveBeenCalledWith("rpc_confirm_manual_payment", {
      p_transaction_id: "txn-1",
      p_external_reference: "QK12ABC3",
      p_notes: null,
    });
  });

  it("surfaces the finance-admin-only guard error from the RPC", async () => {
    rpc.mockResolvedValue({ error: { message: "Only a finance admin may confirm a manual payment." } });
    const res = await confirmPayment("txn-1", "QK12ABC3", "");
    expect(res).toEqual({ error: "Only a finance admin may confirm a manual payment." });
  });
});

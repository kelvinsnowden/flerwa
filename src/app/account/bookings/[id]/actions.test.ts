import { describe, expect, it, vi, beforeEach } from "vitest";
import { approveBooking, openDispute, cancelBooking } from "./actions";

const rpc = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ rpc }),
}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));

/**
 * SEC-001 tier 2: these actions are thin RPC-calling wrappers — the real
 * authorization/financial logic lives in the Postgres functions (see
 * tests/db/ for that tier), so what's worth locking down here is the
 * boundary itself: the exact RPC name and params sent, and that a
 * database error is surfaced to the caller rather than swallowed or
 * thrown past the UI's error handling.
 */
describe("account booking actions", () => {
  beforeEach(() => {
    rpc.mockReset();
  });

  describe("approveBooking", () => {
    it("calls rpc_approve_and_release with the transaction id", async () => {
      rpc.mockResolvedValue({ error: null });
      const res = await approveBooking("txn-1");
      expect(rpc).toHaveBeenCalledWith("rpc_approve_and_release", { p_transaction_id: "txn-1" });
      expect(res).toEqual({ success: true });
    });

    it("surfaces a database error instead of throwing", async () => {
      rpc.mockResolvedValue({ error: { message: "Cannot approve from state disputed." } });
      const res = await approveBooking("txn-1");
      expect(res).toEqual({ error: "Cannot approve from state disputed." });
    });
  });

  describe("openDispute", () => {
    it("passes reason and description, nulling an empty description", async () => {
      rpc.mockResolvedValue({ error: null });
      await openDispute("txn-1", "work not done", "");
      expect(rpc).toHaveBeenCalledWith("rpc_open_dispute", {
        p_transaction_id: "txn-1",
        p_reason: "work not done",
        p_description: null,
      });
    });
  });

  describe("cancelBooking", () => {
    it("nulls an empty reason rather than sending an empty string", async () => {
      rpc.mockResolvedValue({ error: null });
      await cancelBooking("txn-1", "");
      expect(rpc).toHaveBeenCalledWith("rpc_cancel_booking", { p_transaction_id: "txn-1", p_reason: null });
    });

    it("surfaces the RPC's own cancellation-fee-policy error text unmodified", async () => {
      rpc.mockResolvedValue({ error: { message: "Cannot cancel from state evidence_submitted — the job has moved past active work." } });
      const res = await cancelBooking("txn-1", "changed my mind");
      expect(res).toEqual({ error: "Cannot cancel from state evidence_submitted — the job has moved past active work." });
    });
  });
});

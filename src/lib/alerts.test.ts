import { afterEach, describe, expect, it, vi } from "vitest";
import { sendOpsAlert } from "./alerts";

// The safety property this covers: an ops alert must never be able to
// block the check that's reporting through it. When unconfigured, it must
// no-op cleanly rather than throw — this is the path every environment
// without RESEND_API_KEY/ALERT_EMAIL_TO/ALERT_EMAIL_FROM set (e.g. this
// repo's own CI, and any deploy before those are configured) exercises on
// every single call.
describe("sendOpsAlert", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("no-ops and returns false when unconfigured, without throwing", async () => {
    delete process.env.RESEND_API_KEY;
    delete process.env.ALERT_EMAIL_TO;
    delete process.env.ALERT_EMAIL_FROM;
    const fetchSpy = vi.spyOn(global, "fetch");

    const sent = await sendOpsAlert({ subject: "test", body: "test" });

    expect(sent).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("no-ops when only partially configured", async () => {
    process.env.RESEND_API_KEY = "key";
    delete process.env.ALERT_EMAIL_TO;
    process.env.ALERT_EMAIL_FROM = "alerts@example.com";
    const fetchSpy = vi.spyOn(global, "fetch");

    const sent = await sendOpsAlert({ subject: "test", body: "test" });

    expect(sent).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("calls the Resend API with the right shape when fully configured", async () => {
    process.env.RESEND_API_KEY = "key123";
    process.env.ALERT_EMAIL_TO = "ops@example.com";
    process.env.ALERT_EMAIL_FROM = "alerts@example.com";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 200 }));

    const sent = await sendOpsAlert({ subject: "Ledger imbalance", body: "1 group affected" });

    expect(sent).toBe(true);
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.resend.com/emails",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer key123" }),
      })
    );
    const body = JSON.parse(fetchSpy.mock.calls[0][1]?.body as string);
    expect(body).toEqual({
      from: "alerts@example.com",
      to: ["ops@example.com"],
      subject: "Ledger imbalance",
      text: "1 group affected",
    });
  });

  it("returns false (does not throw) when the Resend API rejects the request", async () => {
    process.env.RESEND_API_KEY = "bad-key";
    process.env.ALERT_EMAIL_TO = "ops@example.com";
    process.env.ALERT_EMAIL_FROM = "alerts@example.com";
    vi.spyOn(global, "fetch").mockResolvedValue(new Response(null, { status: 401 }));

    await expect(sendOpsAlert({ subject: "test", body: "test" })).resolves.toBe(false);
  });

  it("returns false (does not throw) on a network error", async () => {
    process.env.RESEND_API_KEY = "key123";
    process.env.ALERT_EMAIL_TO = "ops@example.com";
    process.env.ALERT_EMAIL_FROM = "alerts@example.com";
    vi.spyOn(global, "fetch").mockRejectedValue(new Error("network down"));

    await expect(sendOpsAlert({ subject: "test", body: "test" })).resolves.toBe(false);
  });
});

import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { resendEmailAdapter } from "./resend-email";

/**
 * verifyInboundWebhook is the single most security-critical function in
 * the support system: get it wrong one way and forged "email received"
 * events create tickets as if they were real customer mail; get it wrong
 * the other way and every legitimate inbound reply silently vanishes.
 * These tests compute a real Svix-shaped signature by hand (same HMAC
 * construction documented in this file's own header comment) rather than
 * trusting the implementation to grade itself.
 */
function sign(secret: string, id: string, timestamp: string, body: string) {
  const secretBytes = Buffer.from(secret.split("_").slice(1).join("_"), "base64");
  const signedContent = `${id}.${timestamp}.${body}`;
  const sig = crypto.createHmac("sha256", secretBytes).update(signedContent).digest("base64");
  return `v1,${sig}`;
}

describe("resendEmailAdapter.verifyInboundWebhook", () => {
  const originalEnv = { ...process.env };
  const secret = "whsec_" + Buffer.from("test-signing-secret-bytes").toString("base64");

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("fails closed when RESEND_WEBHOOK_SECRET is not configured", () => {
    delete process.env.RESEND_WEBHOOK_SECRET;
    const headers = new Headers({ "svix-id": "id1", "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,bogus" });
    expect(resendEmailAdapter.verifyInboundWebhook("{}", headers)).toBe(false);
  });

  it("accepts a correctly signed payload", () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const body = JSON.stringify({ type: "email.received", data: { email_id: "abc" } });
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": sign(secret, id, timestamp, body) });

    expect(resendEmailAdapter.verifyInboundWebhook(body, headers)).toBe(true);
  });

  it("rejects a payload signed with the wrong secret", () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const wrongSecret = "whsec_" + Buffer.from("a-different-secret").toString("base64");
    const body = JSON.stringify({ type: "email.received", data: { email_id: "abc" } });
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": sign(wrongSecret, id, timestamp, body) });

    expect(resendEmailAdapter.verifyInboundWebhook(body, headers)).toBe(false);
  });

  it("rejects a tampered body even with a validly-formed signature", () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const originalBody = JSON.stringify({ type: "email.received", data: { email_id: "abc" } });
    const tamperedBody = JSON.stringify({ type: "email.received", data: { email_id: "attacker-controlled" } });
    const id = "msg_1";
    const timestamp = String(Math.floor(Date.now() / 1000));
    const headers = new Headers({ "svix-id": id, "svix-timestamp": timestamp, "svix-signature": sign(secret, id, timestamp, originalBody) });

    expect(resendEmailAdapter.verifyInboundWebhook(tamperedBody, headers)).toBe(false);
  });

  it("rejects a stale timestamp (replay protection)", () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const body = "{}";
    const id = "msg_1";
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes old
    const headers = new Headers({ "svix-id": id, "svix-timestamp": staleTimestamp, "svix-signature": sign(secret, id, staleTimestamp, body) });

    expect(resendEmailAdapter.verifyInboundWebhook(body, headers)).toBe(false);
  });

  it("rejects when a required header is missing", () => {
    process.env.RESEND_WEBHOOK_SECRET = secret;
    const headers = new Headers({ "svix-timestamp": String(Math.floor(Date.now() / 1000)), "svix-signature": "v1,bogus" });
    expect(resendEmailAdapter.verifyInboundWebhook("{}", headers)).toBe(false);
  });
});

describe("resendEmailAdapter.parseInboundEvent", () => {
  it("parses a valid email.received event", () => {
    const body = JSON.stringify({
      type: "email.received",
      data: { email_id: "email_123", from: "customer@example.com", to: ["support@ours.com"], subject: "[SUP-ABC123] Help" },
    });
    const parsed = resendEmailAdapter.parseInboundEvent(body);
    expect(parsed).toMatchObject({ fromEmail: "customer@example.com", subject: "[SUP-ABC123] Help", messageId: "email_123" });
  });

  it("returns null for an event type it doesn't act on", () => {
    const body = JSON.stringify({ type: "email.delivered", data: {} });
    expect(resendEmailAdapter.parseInboundEvent(body)).toBeNull();
  });

  it("returns null for malformed JSON rather than throwing", () => {
    expect(resendEmailAdapter.parseInboundEvent("not json")).toBeNull();
  });
});

describe("resendEmailAdapter.sendEmail", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns a clear error without throwing when RESEND_API_KEY is unset", async () => {
    delete process.env.RESEND_API_KEY;
    const result = await resendEmailAdapter.sendEmail({ to: "a@example.com", from: "b@example.com", subject: "s", text: "t" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/RESEND_API_KEY/);
  });

  it("sends In-Reply-To/References headers for threading when provided", async () => {
    process.env.RESEND_API_KEY = "key123";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "sent-1" }), { status: 200 }));

    const result = await resendEmailAdapter.sendEmail({
      to: "customer@example.com",
      from: "support@ours.com",
      subject: "Re: [SUP-ABC123] Help",
      text: "reply body",
      inReplyTo: "anchor-id",
      references: ["anchor-id"],
    });

    expect(result.ok).toBe(true);
    expect(result.providerMessageId).toBe("sent-1");
    const call = fetchSpy.mock.calls[0];
    expect(call[0]).toBe("https://api.resend.com/emails");
    const sentBody = JSON.parse((call[1]?.body as string) ?? "{}");
    expect(sentBody.headers).toEqual({ "In-Reply-To": "anchor-id", References: "anchor-id" });
  });
});

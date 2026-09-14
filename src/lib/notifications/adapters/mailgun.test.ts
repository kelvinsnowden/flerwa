import crypto from "crypto";
import { afterEach, describe, expect, it, vi } from "vitest";
import { mailgunAdapter } from "./mailgun";
import type { InboundWebhookBody } from "../email-provider";

/**
 * Same rigor as resend-email.test.ts's own header comment: this is the
 * function standing between a forged inbound POST and a fabricated
 * support ticket. Signatures are computed by hand here, not trusted to
 * the implementation grading itself.
 */
function sign(signingKey: string, timestamp: string, token: string) {
  return crypto.createHmac("sha256", signingKey).update(`${timestamp}${token}`).digest("hex");
}

type FormFile = { field: string; filename: string; contentType: string; bytes: Uint8Array };

function formBody(fields: Record<string, string>, files: FormFile[] = []): InboundWebhookBody {
  return { kind: "form", fields, files };
}

describe("mailgunAdapter.verifyInboundWebhook", () => {
  const originalEnv = { ...process.env };
  const signingKey = "test-signing-key";
  const headers = new Headers();

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("fails closed when MAILGUN_WEBHOOK_SIGNING_KEY is not configured", () => {
    delete process.env.MAILGUN_WEBHOOK_SIGNING_KEY;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = formBody({ timestamp, token: "tok", signature: sign(signingKey, timestamp, "tok") });
    expect(mailgunAdapter.verifyInboundWebhook(body, headers)).toBe(false);
  });

  it("rejects a \"text\" body — Mailgun always posts form data", () => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = signingKey;
    expect(mailgunAdapter.verifyInboundWebhook({ kind: "text", raw: "{}" }, headers)).toBe(false);
  });

  it("accepts a correctly signed payload", () => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = signingKey;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = "abc123";
    const body = formBody({ timestamp, token, signature: sign(signingKey, timestamp, token) });
    expect(mailgunAdapter.verifyInboundWebhook(body, headers)).toBe(true);
  });

  it("rejects a payload signed with the wrong key", () => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = signingKey;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = "abc123";
    const body = formBody({ timestamp, token, signature: sign("wrong-key", timestamp, token) });
    expect(mailgunAdapter.verifyInboundWebhook(body, headers)).toBe(false);
  });

  it("rejects a tampered token even with a validly-formed signature", () => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = signingKey;
    const timestamp = String(Math.floor(Date.now() / 1000));
    const body = formBody({ timestamp, token: "attacker-controlled", signature: sign(signingKey, timestamp, "original-token") });
    expect(mailgunAdapter.verifyInboundWebhook(body, headers)).toBe(false);
  });

  it("rejects a stale timestamp (replay protection)", () => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = signingKey;
    const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600); // 10 minutes old
    const token = "abc123";
    const body = formBody({ timestamp: staleTimestamp, token, signature: sign(signingKey, staleTimestamp, token) });
    expect(mailgunAdapter.verifyInboundWebhook(body, headers)).toBe(false);
  });

  it("rejects when a required field is missing", () => {
    process.env.MAILGUN_WEBHOOK_SIGNING_KEY = signingKey;
    const body = formBody({ timestamp: String(Math.floor(Date.now() / 1000)), token: "abc123", signature: "" });
    expect(mailgunAdapter.verifyInboundWebhook(body, headers)).toBe(false);
  });
});

describe("mailgunAdapter.parseInboundEvent", () => {
  it("parses a valid inbound route payload, including an inline attachment", () => {
    const body = formBody(
      {
        sender: "customer@example.com",
        from: '"Jane Customer" <customer@example.com>',
        recipient: "support@ours.com",
        subject: "[SUP-ABC123] Help",
        "body-plain": "full body",
        "stripped-text": "stripped body",
        "Message-Id": "<msg-1@mailgun.org>",
        "In-Reply-To": "<anchor@mailgun.org>",
        References: "<anchor@mailgun.org> <mid@mailgun.org>",
      },
      [{ field: "attachment-1", filename: "receipt.pdf", contentType: "application/pdf", bytes: new Uint8Array([1, 2, 3]) }]
    );

    const parsed = mailgunAdapter.parseInboundEvent(body);
    expect(parsed).toMatchObject({
      fromEmail: "customer@example.com",
      fromName: "Jane Customer",
      toEmail: "support@ours.com",
      subject: "[SUP-ABC123] Help",
      text: "stripped body",
      messageId: "<msg-1@mailgun.org>",
      inReplyTo: "<anchor@mailgun.org>",
      references: ["<anchor@mailgun.org>", "<mid@mailgun.org>"],
    });
    expect(parsed?.attachments).toHaveLength(1);
    expect(parsed?.attachments[0]).toMatchObject({ filename: "receipt.pdf", contentType: "application/pdf" });
  });

  it("returns null for a \"text\" body — Mailgun always posts form data", () => {
    expect(mailgunAdapter.parseInboundEvent({ kind: "text", raw: "{}" })).toBeNull();
  });

  it("returns null when there's no sender field at all", () => {
    expect(mailgunAdapter.parseInboundEvent(formBody({ subject: "no sender" }))).toBeNull();
  });
});

describe("mailgunAdapter.sendEmail", () => {
  const originalEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it("returns a clear error without throwing when MAILGUN_API_KEY/DOMAIN are unset", async () => {
    delete process.env.MAILGUN_API_KEY;
    delete process.env.MAILGUN_DOMAIN;
    const result = await mailgunAdapter.sendEmail({ to: "a@example.com", from: "b@example.com", subject: "s", text: "t" });
    expect(result.ok).toBe(false);
    expect(result.error).toMatch(/MAILGUN_API_KEY/);
  });

  it("sends via HTTP Basic auth against the account's domain endpoint", async () => {
    process.env.MAILGUN_API_KEY = "key123";
    process.env.MAILGUN_DOMAIN = "mg.ours.com";
    const fetchSpy = vi.spyOn(global, "fetch").mockResolvedValue(new Response(JSON.stringify({ id: "sent-1" }), { status: 200 }));

    const result = await mailgunAdapter.sendEmail({
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
    expect(call[0]).toBe("https://api.mailgun.net/v3/mg.ours.com/messages");
    const headers = call[1]?.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Basic ${Buffer.from("api:key123").toString("base64")}`);
    const sentBody = new URLSearchParams(call[1]?.body as string);
    expect(sentBody.get("h:In-Reply-To")).toBe("anchor-id");
    expect(sentBody.get("h:References")).toBe("anchor-id");
  });
});

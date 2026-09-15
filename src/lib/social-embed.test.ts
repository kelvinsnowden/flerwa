import { describe, it, expect } from "vitest";
import { validateSocialUrl } from "./social-embed";

describe("validateSocialUrl", () => {
  it("accepts a well-formed Instagram post URL", () => {
    const result = validateSocialUrl("instagram", "https://www.instagram.com/p/ABC123/");
    expect(result.ok).toBe(true);
    expect(result.normalizedUrl).toBe("https://www.instagram.com/p/ABC123/");
  });

  it("accepts instagram.com without the www subdomain", () => {
    const result = validateSocialUrl("instagram", "https://instagram.com/p/ABC123/");
    expect(result.ok).toBe(true);
  });

  it("accepts a well-formed TikTok post URL", () => {
    const result = validateSocialUrl("tiktok", "https://www.tiktok.com/@creator/video/123456789");
    expect(result.ok).toBe(true);
  });

  it("accepts a TikTok short-link host", () => {
    const result = validateSocialUrl("tiktok", "https://vm.tiktok.com/ZMabc123/");
    expect(result.ok).toBe(true);
  });

  it("rejects a non-Instagram host for the instagram platform", () => {
    const result = validateSocialUrl("instagram", "https://tiktok.com/@creator/video/123");
    expect(result.ok).toBe(false);
  });

  it("rejects a non-TikTok host for the tiktok platform", () => {
    const result = validateSocialUrl("tiktok", "https://instagram.com/p/ABC123/");
    expect(result.ok).toBe(false);
  });

  it("rejects a plain http:// URL (must be https)", () => {
    const result = validateSocialUrl("instagram", "http://www.instagram.com/p/ABC123/");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("https");
  });

  it("rejects a lookalike hostname (open-redirect / spoofing attempt)", () => {
    const result = validateSocialUrl("instagram", "https://instagram.com.evil.example/p/ABC123/");
    expect(result.ok).toBe(false);
  });

  it("rejects an unrelated domain entirely", () => {
    const result = validateSocialUrl("instagram", "https://example.com/not-instagram");
    expect(result.ok).toBe(false);
  });

  it("rejects a malformed URL", () => {
    const result = validateSocialUrl("instagram", "not a url at all");
    expect(result.ok).toBe(false);
  });

  it("rejects an empty string", () => {
    const result = validateSocialUrl("tiktok", "   ");
    expect(result.ok).toBe(false);
    expect(result.error).toContain("required");
  });

  it("strips a fragment from the normalized URL", () => {
    const result = validateSocialUrl("instagram", "https://www.instagram.com/p/ABC123/#evil-fragment");
    expect(result.ok).toBe(true);
    expect(result.normalizedUrl).not.toContain("#");
  });

  it("strips embedded credentials from the normalized URL", () => {
    const result = validateSocialUrl("instagram", "https://user:pass@www.instagram.com/p/ABC123/");
    expect(result.ok).toBe(true);
    expect(result.normalizedUrl).not.toContain("user");
    expect(result.normalizedUrl).not.toContain("pass");
  });

  it("is case-insensitive on the hostname", () => {
    const result = validateSocialUrl("instagram", "https://WWW.INSTAGRAM.COM/p/ABC123/");
    expect(result.ok).toBe(true);
  });
});

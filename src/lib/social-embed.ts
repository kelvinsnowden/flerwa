/**
 * Creator-authorized social proof (Instagram/TikTok) — URL validation.
 *
 * This is the REAL security boundary for social-highlight URLs, called
 * server-side from src/app/provider/social/actions.ts before any insert
 * or update (client-side validation, if any, is a UX convenience only —
 * never trusted). Deliberately conservative: only https, only a fixed
 * hostname allowlist per platform, no open-redirect surface, no
 * arbitrary embed HTML ever generated from this — the UI only ever
 * renders a plain link/card (see src/components/social/), never
 * dangerouslySetInnerHTML or an iframe built from user input.
 */

export type SocialPlatform = "instagram" | "tiktok";

const ALLOWED_HOSTNAMES: Record<SocialPlatform, string[]> = {
  instagram: ["instagram.com", "www.instagram.com"],
  tiktok: ["tiktok.com", "www.tiktok.com", "vm.tiktok.com", "vt.tiktok.com"],
};

export interface SocialUrlValidationResult {
  ok: boolean;
  /** Normalized URL (protocol forced to https, hash stripped) — only present when ok. */
  normalizedUrl?: string;
  error?: string;
}

/**
 * Validates and normalizes a creator-supplied post URL against the
 * allowed hostnames for the given platform. Rejects anything that isn't
 * a well-formed https URL on an approved host — this is what prevents
 * an arbitrary or malicious URL (open redirect, unrelated site, a
 * non-https scheme) from ever being stored as a "social highlight".
 */
export function validateSocialUrl(platform: SocialPlatform, rawUrl: string): SocialUrlValidationResult {
  const trimmed = rawUrl.trim();
  if (!trimmed) {
    return { ok: false, error: "A post URL is required." };
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return { ok: false, error: "That doesn't look like a valid URL." };
  }

  if (parsed.protocol !== "https:") {
    return { ok: false, error: "Only https:// links are allowed." };
  }

  const hostname = parsed.hostname.toLowerCase();
  const allowed = ALLOWED_HOSTNAMES[platform];
  if (!allowed.includes(hostname)) {
    return {
      ok: false,
      error: `That doesn't look like a ${platform === "instagram" ? "Instagram" : "TikTok"} link (allowed: ${allowed.join(", ")}).`,
    };
  }

  // Strip fragment/credentials — never needed for a public post link and
  // fragments/userinfo are a common open-redirect / spoofing vector.
  parsed.hash = "";
  parsed.username = "";
  parsed.password = "";

  return { ok: true, normalizedUrl: parsed.toString() };
}

export const SOCIAL_PLATFORM_LABEL: Record<SocialPlatform, string> = {
  instagram: "Instagram",
  tiktok: "TikTok",
};

"use client";

import { useState } from "react";
import { Icon } from "@/components/ui/icon";

/**
 * Storefront URLs are relative (/provider/[slug]) everywhere else in the
 * app, but a shareable link needs to be absolute. window.location.origin
 * is used rather than a hardcoded/env-configured domain so this is
 * correct on whichever host actually serves the page (production,
 * preview, etc.) — the same reasoning as the emailRedirectTo fix in
 * src/app/login/actions.ts.
 */
export function CopyStorefrontLink({ slug }: { slug: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    const url = `${window.location.origin}/provider/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      // Clipboard API can be unavailable (older browsers, non-secure
      // context); fall back to a manual-copy prompt rather than failing
      // silently.
      window.prompt("Copy your storefront link:", url);
      return;
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      type="button"
      onClick={copy}
      className="text-xs font-semibold inline-flex items-center gap-1 whitespace-nowrap"
      style={{ color: "var(--trust)" }}
    >
      <Icon name={copied ? "check" : "link"} size={14} />
      {copied ? "Copied!" : "Copy link"}
    </button>
  );
}

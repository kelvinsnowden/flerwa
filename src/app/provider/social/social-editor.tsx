"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import type { SocialHighlight } from "@/lib/types";
import { SOCIAL_PLATFORM_LABEL, type SocialPlatform } from "@/lib/social-embed";
import { addSocialHighlight, removeSocialHighlight, updateSocialHighlight } from "./actions";

const PLATFORMS: SocialPlatform[] = ["instagram", "tiktok"];

export function SocialEditor({ initialHighlights }: { initialHighlights: SocialHighlight[] }) {
  const [highlights, setHighlights] = useState(initialHighlights);
  const [platform, setPlatform] = useState<SocialPlatform>("instagram");
  const [postUrl, setPostUrl] = useState("");
  const [title, setTitle] = useState("");
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleAdd() {
    setError(null);
    if (!rightsConfirmed) {
      setError("Please confirm this is your own content, or you have permission to share it.");
      return;
    }
    startTransition(async () => {
      const result = await addSocialHighlight(platform, postUrl, title, rightsConfirmed);
      if (!result.success) {
        setError(result.error ?? "Something went wrong. Please try again.");
        return;
      }
      setHighlights((prev) => [
        ...prev,
        {
          id: result.id,
          provider_id: "",
          platform,
          post_url: postUrl.trim(),
          title: title.trim() || null,
          sort_order: prev.length,
          is_public: true,
          is_hidden: false,
          rights_confirmed: true,
          created_at: new Date().toISOString(),
        },
      ]);
      setPostUrl("");
      setTitle("");
      setRightsConfirmed(false);
    });
  }

  function handleRemove(id: string) {
    setHighlights((prev) => prev.filter((h) => h.id !== id));
    void removeSocialHighlight(id);
  }

  function handleTogglePublic(h: SocialHighlight) {
    const nextPublic = !h.is_public;
    setHighlights((prev) => prev.map((x) => (x.id === h.id ? { ...x, is_public: nextPublic } : x)));
    void updateSocialHighlight(h.id, h.title ?? "", nextPublic);
  }

  return (
    <div>
      <div className="flex flex-col gap-3 mb-6">
        {highlights.map((h) => (
          <div key={h.id} className="card p-3 flex items-center gap-3">
            <span
              className="h-9 w-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--trust-tint)", color: "var(--trust-dark)" }}
            >
              <Icon name={h.platform} size={16} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium truncate">{h.title || SOCIAL_PLATFORM_LABEL[h.platform] + " post"}</p>
              <p className="text-xs text-[var(--muted)] truncate">{h.post_url}</p>
            </div>
            <button type="button" onClick={() => handleTogglePublic(h)} className="text-xs text-[var(--muted)] flex-shrink-0">
              {h.is_public ? "Public" : "Private"}
            </button>
            <button
              type="button"
              onClick={() => handleRemove(h.id)}
              aria-label="Remove"
              className="h-7 w-7 rounded-full flex items-center justify-center bg-[var(--surface)] flex-shrink-0"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
        {highlights.length === 0 && <p className="text-sm text-[var(--muted)]">No social highlights yet.</p>}
      </div>

      <div className="card p-4">
        <h3 className="font-semibold mb-3 text-sm">Add a highlight</h3>
        <div className="flex flex-col gap-3">
          <div className="flex gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPlatform(p)}
                className="flex-1 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-1.5"
                style={
                  platform === p
                    ? { background: "var(--trust-dark)", color: "white" }
                    : { background: "var(--surface)", color: "var(--muted)" }
                }
              >
                <Icon name={p} size={14} />
                {SOCIAL_PLATFORM_LABEL[p]}
              </button>
            ))}
          </div>
          <label className="text-sm font-medium">
            Post link
            <input
              type="url"
              value={postUrl}
              onChange={(e) => setPostUrl(e.target.value)}
              placeholder={platform === "instagram" ? "https://www.instagram.com/p/…" : "https://www.tiktok.com/@you/video/…"}
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium">
            Title (optional)
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Behind the scenes" className="mt-1" />
          </label>
          <label className="flex items-start gap-2 text-xs text-[var(--muted)]">
            <input type="checkbox" checked={rightsConfirmed} onChange={(e) => setRightsConfirmed(e.target.checked)} className="mt-0.5" />
            This is my own post, or I have permission to share it here.
          </label>
        </div>
        {error && <p className="notice-error mt-2">{error}</p>}
        <button type="button" onClick={handleAdd} disabled={isPending || !postUrl} className="btn-primary w-full mt-3">
          {isPending ? "Adding…" : "Add highlight"}
        </button>
      </div>
    </div>
  );
}

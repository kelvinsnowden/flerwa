"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import type { PortfolioItem } from "@/lib/types";
import { addPortfolioItem, removePortfolioItem, updatePortfolioItem } from "./actions";

const MAX_BYTES = 8 * 1024 * 1024;

export function PortfolioManager({ initialItems }: { initialItems: PortfolioItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setError("Photo must be under 8MB.");
      return;
    }

    startTransition(async () => {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("You're not signed in.");
        return;
      }

      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `${user.id}/${Date.now()}.${ext}`;

      // RLS ("portfolio owner write") is what actually enforces that this
      // path can only be written under the caller's own auth.uid() — this
      // upload is rejected by the database, not just skipped by the UI,
      // if that ever stopped matching.
      const { error: uploadError } = await supabase.storage
        .from("provider-portfolio")
        .upload(path, file, { cacheControl: "3600" });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("provider-portfolio").getPublicUrl(path);
      const result = await addPortfolioItem(publicUrlData.publicUrl, "");
      if (!result.success) {
        setError(result.error);
        return;
      }
      setItems((prev) => [
        ...prev,
        {
          id: result.id,
          provider_id: "",
          photo_url: publicUrlData.publicUrl,
          caption: null,
          sort_order: prev.length,
          created_at: new Date().toISOString(),
          media_type: "image",
          video_url: null,
          reach_label: null,
          tag: null,
        },
      ]);
    });
  }

  function handleRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    void removePortfolioItem(id);
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.id} className="relative aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)]">
            <Image src={item.photo_url} alt={item.caption ?? "Portfolio photo"} fill className="object-cover" />
            {item.tag && (
              <span className="absolute bottom-1 left-1 text-[10px] font-semibold text-white bg-black/50 rounded-full px-1.5 py-0.5">
                {item.tag}
              </span>
            )}
            <button
              type="button"
              onClick={() => setEditingId(item.id)}
              aria-label="Edit details"
              className="absolute top-1 left-1 h-6 w-6 rounded-full flex items-center justify-center bg-black/60 text-white"
            >
              <Icon name="file-text" size={12} />
            </button>
            <button
              type="button"
              onClick={() => handleRemove(item.id)}
              aria-label="Remove photo"
              className="absolute top-1 right-1 h-6 w-6 rounded-full flex items-center justify-center bg-black/60 text-white"
            >
              <Icon name="x" size={13} />
            </button>
          </div>
        ))}
        <button
          type="button"
          disabled={isPending}
          onClick={() => inputRef.current?.click()}
          className="aspect-square rounded-[var(--radius-sm)] border-2 border-dashed border-[var(--border)] flex flex-col items-center justify-center gap-1 text-[var(--muted)] hover:border-[var(--trust)] transition-colors"
        >
          <Icon name="camera" size={20} />
          <span className="text-xs font-medium">{isPending ? "Uploading…" : "Add photo"}</span>
        </button>
      </div>
      {error && <p className="notice-error mt-2">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />

      {editingId && (
        <PortfolioItemEditor
          item={items.find((i) => i.id === editingId)!}
          onClose={() => setEditingId(null)}
          onSave={(patch) => {
            setItems((prev) => prev.map((i) => (i.id === editingId ? { ...i, ...patch } : i)));
          }}
        />
      )}
    </div>
  );
}

function PortfolioItemEditor({
  item,
  onClose,
  onSave,
}: {
  item: PortfolioItem;
  onClose: () => void;
  onSave: (patch: Partial<PortfolioItem>) => void;
}) {
  const [tag, setTag] = useState(item.tag ?? "");
  const [reachLabel, setReachLabel] = useState(item.reach_label ?? "");
  const [videoUrl, setVideoUrl] = useState(item.video_url ?? "");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSave() {
    setError(null);
    startTransition(async () => {
      const res = await updatePortfolioItem(item.id, { tag, reach_label: reachLabel, video_url: videoUrl });
      if (res.error) {
        setError(res.error);
        return;
      }
      onSave({ tag: tag || null, reach_label: reachLabel || null, video_url: videoUrl || null, media_type: videoUrl ? "video" : "image" });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card p-4 w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Photo details</h3>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Tag (used to group your portfolio, e.g. UGC, TikTok)
            <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. UGC" className="mt-1" />
          </label>
          <label className="text-sm font-medium">
            Reach (optional — your own number, e.g. views)
            <input type="text" value={reachLabel} onChange={(e) => setReachLabel(e.target.value)} placeholder="e.g. 125K views" className="mt-1" />
          </label>
          <label className="text-sm font-medium">
            Video link (optional — a TikTok, Instagram, or YouTube link)
            <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" className="mt-1" />
          </label>
        </div>
        {error && <p className="notice-error mt-2">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={onClose} className="btn-secondary flex-1">
            Cancel
          </button>
          <button type="button" onClick={handleSave} disabled={isPending} className="btn-primary flex-1">
            {isPending ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

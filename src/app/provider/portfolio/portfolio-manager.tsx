"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import type { PortfolioItem } from "@/lib/types";
import { addPortfolioItem, removePortfolioItem } from "./actions";

const MAX_BYTES = 8 * 1024 * 1024;

export function PortfolioManager({ initialItems }: { initialItems: PortfolioItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
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
      if (result.error) {
        setError(result.error);
        return;
      }
      setItems((prev) => [
        ...prev,
        { id: `pending-${Date.now()}`, provider_id: "", photo_url: publicUrlData.publicUrl, caption: null, sort_order: prev.length, created_at: new Date().toISOString() },
      ]);
    });
  }

  function handleRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    if (!id.startsWith("pending-")) {
      void removePortfolioItem(id);
    }
  }

  return (
    <div>
      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.id} className="relative aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)]">
            <Image src={item.photo_url} alt={item.caption ?? "Portfolio photo"} fill className="object-cover" />
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
    </div>
  );
}

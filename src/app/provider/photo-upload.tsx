"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { updateAvatar } from "./actions";
import { Avatar } from "@/components/ui/avatar";
import { Icon } from "@/components/ui/icon";

const MAX_BYTES = 5 * 1024 * 1024;

export function PhotoUpload({ name, initialPhotoUrl }: { name: string; initialPhotoUrl: string | null }) {
  const [photoUrl, setPhotoUrl] = useState(initialPhotoUrl);
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
      setError("Photo must be under 5MB.");
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
      const path = `${user.id}/avatar.${ext}`;

      // RLS ("avatars owner write/update") is what actually enforces that
      // this path can only be written under the caller's own auth.uid() —
      // this upload is rejected by the database, not just skipped by the
      // UI, if that ever stopped matching.
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, cacheControl: "3600" });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so next/image and the browser don't keep serving the
      // previous photo at the same path after an upsert.
      const bustUrl = `${publicUrlData.publicUrl}?v=${Date.now()}`;

      const result = await updateAvatar(bustUrl);
      if (result.error) {
        setError(result.error);
        return;
      }
      setPhotoUrl(bustUrl);
    });
  }

  return (
    <div className="relative flex-shrink-0" style={{ width: 64, height: 64 }}>
      <Avatar name={name} photoUrl={photoUrl} size="lg" />
      <button
        type="button"
        disabled={isPending}
        onClick={() => inputRef.current?.click()}
        aria-label={photoUrl ? "Change photo" : "Add photo"}
        className="absolute -bottom-1 -right-1 h-6 w-6 rounded-full flex items-center justify-center border-2"
        style={{ background: "var(--trust)", borderColor: "var(--card)", color: "#fff" }}
      >
        <Icon name="camera" size={12} />
      </button>
      {error && (
        <p
          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 w-32 text-center text-xs"
          style={{ color: "var(--danger)" }}
        >
          {error}
        </p>
      )}
      <input ref={inputRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
    </div>
  );
}

"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordEvidence } from "./actions";

interface Item {
  id: string;
  label: string;
  help_text: string | null;
  is_required: boolean;
  requires_photo: boolean;
}

export function ChecklistItemRow({
  transactionId,
  item,
  isComplete,
}: {
  transactionId: string;
  item: Item;
  isComplete: boolean;
}) {
  const [done, setDone] = useState(isComplete);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleFile(file: File) {
    setError(null);
    startTransition(async () => {
      let lat: number | null = null;
      let lng: number | null = null;
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) =>
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 4000 })
        );
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
      } catch {
        // Geolocation unavailable or denied — evidence is still recorded,
        // just without a geotag. Not a hard requirement at MVP.
      }

      const supabase = createClient();
      const ext = file.name.split(".").pop() ?? "jpg";
      const path = `${transactionId}/${item.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("transaction-evidence")
        .upload(path, file, { contentType: file.type });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const type = file.type.startsWith("video") ? "video" : "photo";
      const res = await recordEvidence({
        transactionId,
        checklistItemId: item.id,
        type,
        storagePath: path,
        description: "",
        geoLat: lat,
        geoLng: lng,
      });
      if (res?.error) setError(res.error);
      else setDone(true);
    });
  }

  return (
    <li className="flex items-start gap-3 py-3 border-b last:border-0">
      <div className="flex-1">
        <p className="text-sm font-medium flex items-center gap-2">
          {done && <span style={{ color: "var(--trust)" }}>✓</span>}
          {item.label}
          {item.is_required && !done && <span className="text-xs text-[var(--danger)]">required</span>}
        </p>
        {item.help_text && <p className="text-xs text-[var(--muted)] mt-0.5">{item.help_text}</p>}
        {error && <p className="text-xs text-[var(--danger)] mt-1">{error}</p>}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        capture="environment"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
      <button
        type="button"
        className="btn-secondary text-xs shrink-0"
        disabled={isPending}
        onClick={() => fileRef.current?.click()}
      >
        {isPending ? "Uploading…" : done ? "Replace" : "Capture"}
      </button>
    </li>
  );
}

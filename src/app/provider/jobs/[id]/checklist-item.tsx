"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordEvidence } from "./actions";
import { Icon } from "@/components/ui/icon";

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
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  function upload() {
    const file = pendingFile;
    if (!file) return;
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
        description,
        geoLat: lat,
        geoLng: lng,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      setPendingFile(null);
      setDescription("");
    });
  }

  return (
    <li className="flex flex-col gap-2 py-3 border-b last:border-0">
      <div className="flex items-start gap-3">
        <div className="flex-1">
          <p className="text-sm font-medium flex items-center gap-2">
            {done && <Icon name="check-circle" size={16} className="text-[var(--trust)]" />}
            {item.label}
            {item.is_required && !done && <span className="badge-warn">required</span>}
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
            if (file) {
              setPendingFile(file);
              setError(null);
            }
          }}
        />
        {!pendingFile && (
          <button
            type="button"
            className="btn-secondary text-xs shrink-0"
            disabled={isPending}
            onClick={() => fileRef.current?.click()}
          >
            {done ? "Replace" : "Capture"}
          </button>
        )}
      </div>

      {pendingFile && (
        <div className="flex flex-col gap-2 rounded-lg bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="camera" size={14} />
            {pendingFile.name}
          </p>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            placeholder="Add a description (optional)"
            className="text-sm"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary text-xs flex-1" disabled={isPending} onClick={upload}>
              {isPending ? "Uploading…" : "Upload evidence"}
            </button>
            <button
              type="button"
              className="btn-secondary text-xs"
              disabled={isPending}
              onClick={() => {
                setPendingFile(null);
                setDescription("");
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </li>
  );
}

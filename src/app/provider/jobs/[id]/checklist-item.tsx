"use client";

import { useRef, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";
import { recordEvidence } from "./actions";
import { Icon } from "@/components/ui/icon";
import { CameraCapture, type CaptureMethod } from "./camera-capture";

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
  const [pendingBlob, setPendingBlob] = useState<Blob | null>(null);
  const [pendingType, setPendingType] = useState<"photo" | "video">("photo");
  const [captureMethod, setCaptureMethod] = useState<CaptureMethod | null>(null);
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const videoFileRef = useRef<HTMLInputElement>(null);

  function upload() {
    const blob = pendingBlob;
    const method = captureMethod;
    if (!blob || !method) return;
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
      const ext = pendingType === "video" ? "mp4" : "jpg";
      const contentType = blob.type || (pendingType === "video" ? "video/mp4" : "image/jpeg");
      const path = `${transactionId}/${item.id}-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("transaction-evidence")
        .upload(path, blob, { contentType });
      if (uploadError) {
        setError(uploadError.message);
        return;
      }

      const res = await recordEvidence({
        transactionId,
        checklistItemId: item.id,
        type: pendingType,
        storagePath: path,
        description,
        geoLat: lat,
        geoLng: lng,
        captureMethod: method,
      });
      if (res?.error) {
        setError(res.error);
        return;
      }
      setDone(true);
      setPendingBlob(null);
      setCaptureMethod(null);
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
        {!pendingBlob && (
          <div className="flex flex-col items-end gap-1">
            <CameraCapture
              disabled={isPending}
              onCapture={(blob, method) => {
                setPendingBlob(blob);
                setPendingType("photo");
                setCaptureMethod(method);
                setError(null);
              }}
            />
            <input
              ref={videoFileRef}
              type="file"
              accept="video/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) {
                  setPendingBlob(file);
                  setPendingType("video");
                  setCaptureMethod("file_fallback");
                  setError(null);
                }
                e.target.value = "";
              }}
            />
            <button
              type="button"
              className="text-[10px] text-[var(--muted-2)] underline"
              disabled={isPending}
              onClick={() => videoFileRef.current?.click()}
            >
              Attach a video instead
            </button>
          </div>
        )}
      </div>

      {pendingBlob && (
        <div className="flex flex-col gap-2 rounded-lg bg-[var(--surface)] p-3">
          <p className="text-xs text-[var(--muted)] flex items-center gap-1.5">
            <Icon name="camera" size={14} />
            {pendingType === "video" ? "Video attached" : "Photo captured"}
            {captureMethod === "file_fallback" && (
              <span className="text-[var(--danger)]"> · not a verified in-app capture</span>
            )}
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
                setPendingBlob(null);
                setCaptureMethod(null);
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

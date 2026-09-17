"use client";

import { useEffect, useRef, useState } from "react";
import { Icon } from "@/components/ui/icon";
import { compressImageFile, scaleToFit } from "@/lib/client-image-compression";

export type CaptureMethod = "camera_stream" | "file_fallback";

/**
 * TSF-001: evidence capture enforcement. The old `<input type="file"
 * capture="environment">` is a weak, spoofable signal — most mobile
 * browsers still let the user pick an existing gallery photo through it,
 * and nothing distinguished that from a real capture (the server action
 * hardcoded captured_in_app: true regardless). This component captures
 * directly from a live getUserMedia stream via <video>/<canvas> — there
 * is no OS file/gallery picker anywhere in this path, so a captured
 * frame is genuinely a live camera frame, not a pre-existing file. Falls
 * back to the old file input, honestly labeled as the weaker path, only
 * when getUserMedia is unsupported or the user denies camera permission.
 */
export function CameraCapture({
  onCapture,
  disabled,
}: {
  onCapture: (blob: Blob, method: CaptureMethod) => void;
  disabled?: boolean;
}) {
  const [mode, setMode] = useState<"idle" | "streaming" | "unsupported">("idle");
  const [error, setError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function stopStream() {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }

  useEffect(() => stopStream, []);

  async function startCamera() {
    setError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setMode("unsupported");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setMode("streaming");
    } catch {
      // Permission denied, no camera, or blocked — fall back honestly
      // rather than blocking evidence capture entirely.
      setMode("unsupported");
    }
  }

  function capture() {
    const video = videoRef.current;
    if (!video) return;
    // Modern phone cameras stream well above what evidence review needs
    // (often 4K+) — capped here, at the point of capture, rather than
    // uploading the full stream frame and paying for it on every review.
    const { width, height } = scaleToFit(video.videoWidth, video.videoHeight, 1600);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.toBlob(
      (blob) => {
        if (blob) onCapture(blob, "camera_stream");
        stopStream();
        setMode("idle");
      },
      "image/jpeg",
      0.82
    );
  }

  if (mode === "streaming") {
    return (
      <div className="flex flex-col gap-2">
        <video ref={videoRef} playsInline muted className="w-full rounded-lg bg-black" style={{ maxHeight: 280 }} />
        <div className="flex gap-2">
          <button type="button" className="btn-primary text-xs flex-1" disabled={disabled} onClick={capture}>
            Capture
          </button>
          <button
            type="button"
            className="btn-secondary text-xs"
            onClick={() => {
              stopStream();
              setMode("idle");
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {error && <p className="text-xs text-[var(--danger)]">{error}</p>}
      <button type="button" className="btn-secondary text-xs shrink-0" disabled={disabled} onClick={startCamera}>
        <Icon name="camera" size={14} className="inline mr-1 -mt-0.5" />
        Capture
      </button>
      {mode === "unsupported" && (
        <div className="text-xs text-[var(--muted)]">
          <p>
            Live camera capture isn&apos;t available on this device/browser — falling back to your device&apos;s
            picker. This is a weaker guarantee and is flagged to admins as such.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              e.target.value = "";
              if (!file) return;
              const compressed = await compressImageFile(file, { maxDimension: 1600, quality: 0.82 });
              onCapture(compressed, "file_fallback");
            }}
          />
          <button type="button" className="btn-secondary text-xs mt-1" onClick={() => fileRef.current?.click()}>
            Choose from device
          </button>
        </div>
      )}
    </div>
  );
}

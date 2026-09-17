"use client";

import { useRef, useState, useTransition } from "react";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/ui/icon";
import type { PortfolioItem } from "@/lib/types";
import { addPortfolioItem, removePortfolioItem, updatePortfolioItem, type PortfolioItemFields } from "./actions";
import { compressImageFile, extensionForMimeType, scaleToFit } from "@/lib/client-image-compression";

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;
const ALLOWED_VIDEO_TYPES = ["video/mp4", "video/webm", "video/quicktime"];

/**
 * Captures a frame from a local video File as a JPEG Blob, entirely in
 * the browser — no server-side transcoding pipeline. Used as the
 * thumbnail for a native video upload, since the platform doesn't host
 * a separate thumbnail-generation service.
 */
function extractVideoThumbnail(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    video.preload = "metadata";
    video.muted = true;
    video.playsInline = true;
    const url = URL.createObjectURL(file);
    video.src = url;

    const cleanup = () => URL.revokeObjectURL(url);

    video.onloadedmetadata = () => {
      video.currentTime = Math.min(0.5, video.duration / 2 || 0);
    };
    video.onseeked = () => {
      // Capped to the same maxDimension as a real portfolio photo — a
      // thumbnail generated from a 4K video source has no reason to be
      // any larger than a directly-uploaded photo would be.
      const { width, height } = scaleToFit(video.videoWidth || 640, video.videoHeight || 360, 1600);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        cleanup();
        reject(new Error("Couldn't generate a thumbnail from this video."));
        return;
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          cleanup();
          if (blob) resolve(blob);
          else reject(new Error("Couldn't generate a thumbnail from this video."));
        },
        "image/jpeg",
        0.85
      );
    };
    video.onerror = () => {
      cleanup();
      reject(new Error("Couldn't read this video file."));
    };
  });
}

export function PortfolioManager({ initialItems }: { initialItems: PortfolioItem[] }) {
  const [items, setItems] = useState(initialItems);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [rightsConfirmed, setRightsConfirmed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setError(null);

    if (!rightsConfirmed) {
      setError("Please confirm you own the rights to this content first.");
      return;
    }

    const isImage = file.type.startsWith("image/");
    const isVideo = ALLOWED_VIDEO_TYPES.includes(file.type);
    if (!isImage && !isVideo) {
      setError("Please choose a JPEG/PNG/WebP photo or an MP4/WebM/MOV video.");
      return;
    }
    if (isImage && file.size > MAX_IMAGE_BYTES) {
      setError("Photo must be under 8MB.");
      return;
    }
    if (isVideo && file.size > MAX_VIDEO_BYTES) {
      setError("Video must be under 50MB.");
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

      try {
        if (isVideo) {
          const thumbnailBlob = await extractVideoThumbnail(file);
          const stamp = Date.now();
          const videoPath = `${user.id}/${stamp}.${file.name.split(".").pop()?.toLowerCase() || "mp4"}`;
          const thumbPath = `${user.id}/${stamp}-thumb.jpg`;

          // RLS ("portfolio owner write") is the real boundary here — both
          // uploads are rejected by the database, not just skipped by the
          // UI, if the path prefix ever stopped matching auth.uid().
          const { error: videoUploadError } = await supabase.storage
            .from("provider-portfolio")
            .upload(videoPath, file, { cacheControl: "3600" });
          if (videoUploadError) {
            setError(videoUploadError.message);
            return;
          }
          const { error: thumbUploadError } = await supabase.storage
            .from("provider-portfolio")
            .upload(thumbPath, thumbnailBlob, { cacheControl: "3600", contentType: "image/jpeg" });
          if (thumbUploadError) {
            setError(thumbUploadError.message);
            return;
          }

          const { data: videoUrlData } = supabase.storage.from("provider-portfolio").getPublicUrl(videoPath);
          const { data: thumbUrlData } = supabase.storage.from("provider-portfolio").getPublicUrl(thumbPath);

          const result = await addPortfolioItem(thumbUrlData.publicUrl, "", {
            rightsConfirmed: true,
            nativeVideoUrl: videoUrlData.publicUrl,
          });
          if (!result.success) {
            setError(result.error);
            return;
          }
          setItems((prev) => [
            ...prev,
            {
              id: result.id,
              provider_id: "",
              photo_url: thumbUrlData.publicUrl,
              caption: null,
              sort_order: prev.length,
              created_at: new Date().toISOString(),
              media_type: "video",
              video_url: videoUrlData.publicUrl,
              video_source: "native",
              reach_label: null,
              tag: null,
              project_type: null,
              client_name: null,
              is_public: true,
              is_hidden: false,
              is_featured: false,
              rights_confirmed: true,
            },
          ]);
        } else {
          const compressed = await compressImageFile(file, { maxDimension: 1600, quality: 0.82 });
          const ext = extensionForMimeType(compressed.type || file.type);
          const path = `${user.id}/${Date.now()}.${ext}`;

          const { error: uploadError } = await supabase.storage
            .from("provider-portfolio")
            .upload(path, compressed, { cacheControl: "3600", contentType: compressed.type || file.type });
          if (uploadError) {
            setError(uploadError.message);
            return;
          }

          const { data: publicUrlData } = supabase.storage.from("provider-portfolio").getPublicUrl(path);
          const result = await addPortfolioItem(publicUrlData.publicUrl, "", { rightsConfirmed: true });
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
              video_source: null,
              reach_label: null,
              tag: null,
              project_type: null,
              client_name: null,
              is_public: true,
              is_hidden: false,
              is_featured: false,
              rights_confirmed: true,
            },
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Something went wrong uploading that file.");
      }
    });
  }

  function handleRemove(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
    void removePortfolioItem(id);
  }

  return (
    <div>
      <label className="mb-3 flex items-start gap-2 text-xs text-[var(--muted)]">
        <input
          type="checkbox"
          checked={rightsConfirmed}
          onChange={(e) => setRightsConfirmed(e.target.checked)}
          className="mt-0.5"
        />
        I created this content myself, or have permission to share it on my profile.
      </label>

      <div className="grid grid-cols-3 gap-2">
        {items.map((item) => (
          <div key={item.id} className="relative aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)]">
            <Image src={item.photo_url} alt={item.caption ?? "Portfolio photo"} fill className="object-cover" />
            {item.media_type === "video" && (
              <span className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <span className="h-7 w-7 rounded-full flex items-center justify-center bg-black/50 text-white">
                  <Icon name="video" size={14} />
                </span>
              </span>
            )}
            {!item.is_public && (
              <span className="absolute bottom-1 right-1 text-[10px] font-semibold text-white bg-black/60 rounded-full px-1.5 py-0.5">
                Private
              </span>
            )}
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
              aria-label="Remove"
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
          <span className="text-xs font-medium text-center px-1">{isPending ? "Uploading…" : "Add photo or video"}</span>
        </button>
      </div>
      {error && <p className="notice-error mt-2">{error}</p>}
      <input ref={inputRef} type="file" accept="image/*,video/mp4,video/webm,video/quicktime" onChange={onPick} className="hidden" />

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
  const [videoUrl, setVideoUrl] = useState(item.video_source === "external" ? item.video_url ?? "" : "");
  const [projectType, setProjectType] = useState(item.project_type ?? "");
  const [clientName, setClientName] = useState(item.client_name ?? "");
  const [isPublic, setIsPublic] = useState(item.is_public);
  const [isFeatured, setIsFeatured] = useState(item.is_featured);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isNativeVideo = item.video_source === "native";

  function handleSave() {
    setError(null);
    const fields: PortfolioItemFields = {
      tag,
      reachLabel,
      videoUrl: isNativeVideo ? "" : videoUrl,
      projectType,
      clientName,
      isPublic,
      isFeatured,
    };
    startTransition(async () => {
      const res = await updatePortfolioItem(item.id, fields);
      if (res.error) {
        setError(res.error);
        return;
      }
      onSave({
        tag: tag || null,
        reach_label: reachLabel || null,
        video_url: isNativeVideo ? item.video_url : videoUrl || null,
        media_type: isNativeVideo ? "video" : videoUrl ? "video" : "image",
        video_source: isNativeVideo ? "native" : videoUrl ? "external" : null,
        project_type: projectType || null,
        client_name: clientName || null,
        is_public: isPublic,
        is_featured: isFeatured,
      });
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 bg-black/40 flex items-end sm:items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="card p-4 w-full max-w-sm max-h-[85vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <h3 className="font-semibold mb-3">Portfolio item details</h3>
        <div className="flex flex-col gap-3">
          <label className="text-sm font-medium">
            Category (used to group your portfolio, e.g. UGC, Product Photography)
            <input type="text" value={tag} onChange={(e) => setTag(e.target.value)} placeholder="e.g. UGC" className="mt-1" />
          </label>
          <label className="text-sm font-medium">
            Project type (optional)
            <input
              type="text"
              value={projectType}
              onChange={(e) => setProjectType(e.target.value)}
              placeholder="e.g. Product review video"
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium">
            Brand or client name (optional — only shown if you fill this in)
            <input type="text" value={clientName} onChange={(e) => setClientName(e.target.value)} placeholder="e.g. Acme Co." className="mt-1" />
          </label>
          <label className="text-sm font-medium">
            Reach (optional — your own number, e.g. views)
            <input type="text" value={reachLabel} onChange={(e) => setReachLabel(e.target.value)} placeholder="e.g. 125K views" className="mt-1" />
          </label>
          {!isNativeVideo && (
            <label className="text-sm font-medium">
              External video link (optional — a TikTok, Instagram, or YouTube link)
              <input type="url" value={videoUrl} onChange={(e) => setVideoUrl(e.target.value)} placeholder="https://…" className="mt-1" />
            </label>
          )}
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isPublic} onChange={(e) => setIsPublic(e.target.checked)} />
            Visible on my public profile
          </label>
          <label className="flex items-center gap-2 text-sm font-medium">
            <input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} />
            Feature this item at the top of my portfolio
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

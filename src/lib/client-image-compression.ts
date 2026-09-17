"use client";

/**
 * Every browser-side photo upload in this app (avatar, portfolio, job
 * evidence) runs through here before the bytes ever reach
 * `supabase.storage.upload()`. Without this, a raw phone-camera photo
 * (routinely 3-8MB) gets stored and re-downloaded at full size on every
 * view — storage is cheap, but repeated egress at that size is not. See
 * the cost audit this was written for: compressing at the point of
 * upload divides both storage AND every future view's egress by roughly
 * the same ratio, for free, regardless of Supabase plan tier.
 */

export interface CompressImageOptions {
  /** Longest edge, in pixels, after resizing. Images already smaller are left at their own size. */
  maxDimension: number;
  /** 0-1, passed straight to canvas.toBlob. */
  quality: number;
  mimeType?: "image/jpeg" | "image/webp";
}

const DEFAULT_OPTIONS: CompressImageOptions = { maxDimension: 1600, quality: 0.82, mimeType: "image/jpeg" };

/**
 * Resizes + re-encodes an image file/blob entirely client-side via
 * canvas. Falls back to returning the original, untouched file if
 * decoding fails (an exotic format `createImageBitmap` can't handle) or
 * if re-encoding somehow produced a larger file than the source — a
 * slightly larger upload beats a broken or counterproductive one.
 */
export async function compressImageFile(file: File | Blob, options: Partial<CompressImageOptions> = {}): Promise<Blob> {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  try {
    const bitmap = await createImageBitmap(file);
    const { width, height } = scaleToFit(bitmap.width, bitmap.height, opts.maxDimension);
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();

    const blob: Blob | null = await new Promise((resolve) => canvas.toBlob(resolve, opts.mimeType, opts.quality));
    if (!blob) return file;
    return blob.size < file.size ? blob : file;
  } catch {
    return file;
  }
}

/** Scales width/height down so the longest edge is at most maxDimension — never scales up. */
export function scaleToFit(width: number, height: number, maxDimension: number): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxDimension || longest === 0) return { width, height };
  const scale = maxDimension / longest;
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/** File extension matching a compressed blob's real MIME type — never trust the original filename's extension once the bytes have been re-encoded. */
export function extensionForMimeType(mimeType: string): string {
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/png") return "png";
  return "jpg";
}

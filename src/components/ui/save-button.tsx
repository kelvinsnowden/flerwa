"use client";

import { useState, useTransition } from "react";
import { saveProvider, unsaveProvider } from "@/app/providers/actions";
import { Icon } from "./icon";

export function SaveButton({
  providerId,
  initialSaved,
  size = "md",
}: {
  providerId: string;
  initialSaved: boolean;
  size?: "sm" | "md";
}) {
  const [saved, setSaved] = useState(initialSaved);
  const [isPending, startTransition] = useTransition();

  const dims = size === "sm" ? "h-8 w-8" : "h-10 w-10";
  const iconSize = size === "sm" ? 16 : 18;

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={saved ? "Remove from saved pros" : "Save pro"}
      disabled={isPending}
      onClick={(e) => {
        e.preventDefault();
        e.stopPropagation();
        const next = !saved;
        setSaved(next);
        startTransition(async () => {
          const result = next ? await saveProvider(providerId) : await unsaveProvider(providerId);
          if (result.error) setSaved(!next); // roll back on a real RLS/DB failure
        });
      }}
      className={`${dims} flex-shrink-0 rounded-full flex items-center justify-center border transition-colors ${
        saved
          ? "border-[var(--trust)] bg-[var(--trust-tint)] text-[var(--trust)]"
          : "border-[var(--border)] bg-[var(--card)] text-[var(--muted)]"
      }`}
    >
      <Icon name="heart" size={iconSize} className={saved ? "fill-current" : ""} />
    </button>
  );
}

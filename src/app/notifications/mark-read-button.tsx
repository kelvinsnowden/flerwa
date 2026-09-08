"use client";

import { useTransition } from "react";
import { markNotificationRead } from "./actions";

export function MarkReadButton({ notificationId }: { notificationId: string }) {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      className="text-xs font-semibold whitespace-nowrap"
      style={{ color: "var(--trust)" }}
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          void markNotificationRead(notificationId);
        })
      }
    >
      {isPending ? "…" : "Mark read"}
    </button>
  );
}

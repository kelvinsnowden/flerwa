"use client";

import { useTransition } from "react";
import { markNotificationRead, markAllNotificationsRead } from "./actions";

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

export function MarkAllReadButton() {
  const [isPending, startTransition] = useTransition();
  return (
    <button
      className="text-xs font-semibold whitespace-nowrap"
      style={{ color: "var(--trust)" }}
      disabled={isPending}
      onClick={() =>
        startTransition(() => {
          void markAllNotificationsRead();
        })
      }
    >
      {isPending ? "…" : "Mark all read"}
    </button>
  );
}

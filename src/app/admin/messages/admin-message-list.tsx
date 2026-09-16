"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { Message } from "@/lib/types";

export interface AdminThreadEntry {
  type: "t" | "c";
  id: string;
  customerName: string;
  providerName: string;
  serviceLabel: string;
  statusLabel: string;
  latest: Message;
}

export function AdminMessageList({ threads }: { threads: AdminThreadEntry[] }) {
  const pathname = usePathname();
  // A thread is open once the path goes past /admin/messages itself. On
  // mobile there's only room for one pane at a time, so the list yields
  // to the open thread (which gets its own "back to list" link) rather
  // than both trying to share a too-narrow screen.
  const threadOpen = pathname !== "/admin/messages";

  return (
    <div className={`${threadOpen ? "hidden md:block" : "block"} w-full md:w-72 flex-shrink-0 border-r border-[var(--border)] overflow-y-auto`}>
      {!threads.length && <p className="text-sm text-[var(--muted)] p-4">No conversations yet.</p>}
      {threads.map((t) => {
        const href = `/admin/messages/${t.type}/${t.id}`;
        const isActive = pathname === href;
        return (
          <Link
            key={`${t.type}:${t.id}`}
            href={href}
            className="block px-3.5 py-3 border-b border-[var(--border)] hover:bg-[var(--surface)] transition-colors"
            data-active={isActive}
            style={isActive ? { background: "var(--trust-tint)" } : undefined}
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold truncate">
                {t.customerName} <span className="font-normal text-[var(--muted)]">↔</span> {t.providerName}
              </p>
              <span className="text-[10px] text-[var(--muted-2)] whitespace-nowrap flex-shrink-0">
                {new Date(t.latest.created_at).toLocaleDateString("en-KE", { day: "numeric", month: "short" })}
              </span>
            </div>
            {t.serviceLabel && <p className="text-xs text-[var(--muted)] truncate">{t.serviceLabel}</p>}
            <p className="text-xs text-[var(--muted)] truncate mt-0.5">{t.latest.body}</p>
            <span className="badge-muted mt-1 inline-flex">{t.statusLabel}</span>
          </Link>
        );
      })}
    </div>
  );
}

import type { ReactNode } from "react";
import Image from "next/image";

export function EmptyState({
  icon,
  illustration,
  title,
  body,
  action,
}: {
  /** A small inline icon glyph — used when no dedicated illustration exists. */
  icon?: ReactNode;
  /** Path to one of the /public/images/empty-states/*.svg illustrations. Takes precedence over `icon` when both are given. */
  illustration?: string;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-8 text-center flex flex-col items-center gap-2">
      {illustration ? (
        <Image src={illustration} alt="" width={140} height={112} className="mb-1" />
      ) : (
        icon && (
          <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--surface)] text-[var(--muted)] mb-1">
            {icon}
          </div>
        )
      )}
      <p className="font-semibold">{title}</p>
      {body && <p className="text-sm text-[var(--muted)] max-w-xs">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

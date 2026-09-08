import type { ReactNode } from "react";

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon?: ReactNode;
  title: string;
  body?: string;
  action?: ReactNode;
}) {
  return (
    <div className="card p-8 text-center flex flex-col items-center gap-2">
      {icon && (
        <div className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--surface)] text-[var(--muted)] mb-1">
          {icon}
        </div>
      )}
      <p className="font-semibold">{title}</p>
      {body && <p className="text-sm text-[var(--muted)] max-w-xs">{body}</p>}
      {action && <div className="mt-3">{action}</div>}
    </div>
  );
}

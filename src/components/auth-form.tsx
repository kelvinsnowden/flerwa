"use client";

import { useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";

type ActionResult = { error?: string } | undefined;

export function AuthForm({
  action,
  submitLabel,
  showName = false,
  next,
  className = "",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  showName?: boolean;
  next?: string;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className={`flex flex-col gap-4 ${className}`}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      {next && <input type="hidden" name="next" value={next} />}
      {showName && (
        <label className="text-sm font-medium">
          Full name
          <input name="full_name" required className="mt-1" autoComplete="name" placeholder="e.g. James Mwangi" />
        </label>
      )}
      <label className="text-sm font-medium">
        Email
        <input name="email" type="email" required className="mt-1" autoComplete="email" placeholder="you@email.com" />
      </label>
      <label className="text-sm font-medium">
        Password
        <input
          name="password"
          type="password"
          required
          minLength={8}
          className="mt-1"
          autoComplete={showName ? "new-password" : "current-password"}
        />
      </label>
      {error && (
        <p className="notice-error">{error}</p>
      )}
      <button type="submit" disabled={isPending} className="btn-primary mt-1">
        {isPending ? "Please wait…" : submitLabel}
      </button>
      <p className="flex items-start gap-2 text-xs text-[var(--muted)] bg-[var(--trust-tint)] rounded-lg p-3">
        <Icon name="shield-check" size={16} className="text-[var(--trust)] flex-shrink-0 mt-0.5" />
        Your information is protected. We never share it without your consent.
      </p>
    </form>
  );
}

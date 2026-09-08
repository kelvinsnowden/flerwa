"use client";

import { useState, useTransition } from "react";

type ActionResult = { error?: string } | undefined;

export function AuthForm({
  action,
  submitLabel,
  showName = false,
  className = "",
}: {
  action: (formData: FormData) => Promise<ActionResult>;
  submitLabel: string;
  showName?: boolean;
  className?: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className={`flex flex-col gap-3 ${className}`}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await action(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      {showName && (
        <label className="text-sm font-medium">
          Full name
          <input name="full_name" required className="mt-1" autoComplete="name" />
        </label>
      )}
      <label className="text-sm font-medium">
        Email
        <input name="email" type="email" required className="mt-1" autoComplete="email" />
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
        <p className="text-sm rounded-lg bg-red-50 text-[var(--danger)] px-3 py-2">{error}</p>
      )}
      <button type="submit" disabled={isPending} className="btn-primary mt-1">
        {isPending ? "Please wait…" : submitLabel}
      </button>
    </form>
  );
}

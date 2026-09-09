"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { sendOtp } from "./phone-actions";

export function PhoneForm({ next }: { next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await sendOtp(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      {next && <input type="hidden" name="next" value={next} />}
      <label className="text-sm font-medium">
        Phone number
        <div className="mt-1 flex gap-2">
          <span className="flex items-center gap-1 px-3 rounded-[var(--radius-sm)] border border-[var(--border)] bg-[var(--card)] text-sm font-medium whitespace-nowrap">
            🇰🇪 +254
          </span>
          <input
            name="phone"
            type="tel"
            inputMode="tel"
            required
            placeholder="712 345 678"
            autoComplete="tel-national"
            className="flex-1"
          />
        </div>
      </label>

      {error && <p className="notice-error">{error}</p>}

      <button type="submit" disabled={isPending} className="btn-primary justify-between">
        {isPending ? "Sending…" : "Send OTP"}
        {!isPending && <Icon name="chevron-right" size={18} />}
      </button>

      <div className="flex items-center gap-3 text-xs text-[var(--muted-2)]">
        <div className="flex-1 h-px bg-[var(--border)]" />
        or
        <div className="flex-1 h-px bg-[var(--border)]" />
      </div>

      <Link href={`/login/email${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="btn-secondary">
        <Icon name="user" size={18} className="mr-1" />
        Continue with email instead
      </Link>

      <p className="flex items-start gap-2 text-xs text-[var(--muted)] bg-[var(--trust-tint)] rounded-lg p-3">
        <Icon name="shield-check" size={16} className="text-[var(--trust)] flex-shrink-0 mt-0.5" />
        Your information is protected. We never share it without your consent.
      </p>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { updateProfile } from "./actions";

export function ProfileForm({
  fullName,
  phone,
}: {
  fullName: string | null;
  phone: string | null;
}) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        setSaved(false);
        startTransition(async () => {
          const res = await updateProfile(formData);
          if (res?.error) setError(res.error);
          else setSaved(true);
        });
      }}
    >
      <label className="text-sm font-medium">
        Full name
        <input name="full_name" defaultValue={fullName ?? ""} className="mt-1" autoComplete="name" />
      </label>
      <label className="text-sm font-medium">
        Phone
        <input name="phone" type="tel" defaultValue={phone ?? ""} className="mt-1" placeholder="07XX XXX XXX" autoComplete="tel" />
      </label>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      {saved && !error && <p className="text-sm" style={{ color: "var(--trust)" }}>Saved.</p>}
      <button type="submit" disabled={isPending} className="btn-secondary self-start">
        {isPending ? "Saving…" : "Save changes"}
      </button>
    </form>
  );
}

"use client";

import { useState, useTransition } from "react";
import { applyAsProvider } from "./actions";

export function ApplyForm({ locations }: { locations: { id: string; ward: string | null; town: string }[] }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await applyAsProvider(formData);
          if (res?.error) setError(res.error);
        });
      }}
    >
      <label className="text-sm font-medium">
        Display name
        <input name="display_name" required className="mt-1" />
      </label>
      <label className="text-sm font-medium">
        Headline
        <input name="headline" placeholder="e.g. Property Verification · Nairobi" className="mt-1" />
      </label>
      <label className="text-sm font-medium">
        Base location
        <select name="location_id" className="mt-1" defaultValue="">
          <option value="">Select an area…</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.ward ? `${l.ward}, ${l.town}` : l.town}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-medium">
        About you
        <textarea name="bio" rows={3} className="mt-1" />
      </label>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Submitting…" : "Apply as a provider"}
      </button>
    </form>
  );
}

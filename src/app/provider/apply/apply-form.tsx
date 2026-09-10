"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/ui/combobox";
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
        <Combobox
          name="location_id"
          placeholder="Type an area…"
          options={locations.map((l) => ({
            value: l.id,
            label: l.ward ? `${l.ward}, ${l.town}` : l.town,
          }))}
        />
      </label>
      <label className="text-sm font-medium">
        About you
        <textarea name="bio" rows={3} className="mt-1" />
      </label>
      {error && <p className="text-sm text-[var(--danger)]">{error}</p>}
      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Submitting…" : "Start selling"}
      </button>
    </form>
  );
}

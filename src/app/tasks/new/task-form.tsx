"use client";

import { useState, useTransition } from "react";
import { Combobox } from "@/components/ui/combobox";
import { postTask } from "./actions";

export function TaskForm({
  categories,
  locations,
}: {
  categories: { id: string; name: string }[];
  locations: { id: string; ward: string | null; town: string }[];
}) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-3"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const res = await postTask(formData);
          if (res?.error) setError(res.error);
        });
      }}
    >
      <label className="text-sm font-medium">
        What do you need done?
        <input name="title" required placeholder="e.g. Inspect a house before I put down a deposit" className="mt-1" />
      </label>

      <label className="text-sm font-medium">
        Category
        <select name="category_id" required className="mt-1" defaultValue="">
          <option value="" disabled>
            Choose a category…
          </option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        Where
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
        Details
        <textarea
          name="description"
          required
          rows={4}
          placeholder="What exactly do you need, when, and anything a professional should know before quoting."
          className="mt-1"
        />
      </label>

      <label className="text-sm font-medium">
        Budget in KES (optional)
        <input name="budget_hint" type="number" min="0" step="1" placeholder="e.g. 3000" className="mt-1" />
      </label>

      <label className="text-sm font-medium">
        Contact phone
        <input name="contact_phone" type="tel" required placeholder="07XX XXX XXX" className="mt-1" />
      </label>

      {error && <p className="notice-error">{error}</p>}

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Posting…" : "Post task"}
      </button>
    </form>
  );
}

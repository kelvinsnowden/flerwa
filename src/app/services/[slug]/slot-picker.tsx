"use client";

import { useEffect, useState, useTransition } from "react";
import { getAvailableSlots } from "./actions";

function todayISODate(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(isoDate + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function SlotPicker({
  providerId,
  serviceId,
  maxAdvanceDays,
  selected,
  onSelect,
}: {
  providerId: string;
  serviceId: string;
  maxAdvanceDays: number;
  selected: string | null;
  onSelect: (iso: string | null) => void;
}) {
  const [date, setDate] = useState(() => addDays(todayISODate(), 1));
  const [slots, setSlots] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    onSelect(null);
    setError(null);
    startTransition(async () => {
      const res = await getAvailableSlots(providerId, serviceId, date);
      if (res.error) {
        setError(res.error);
        setSlots([]);
      } else {
        setSlots(res.slots ?? []);
      }
    });
    // Re-fetch whenever the provider or the chosen date changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [providerId, serviceId, date]);

  const min = todayISODate();
  const max = addDays(todayISODate(), maxAdvanceDays);

  return (
    <div>
      <label className="text-sm font-medium">
        Choose a date
        <input
          type="date"
          value={date}
          min={min}
          max={max}
          onChange={(e) => setDate(e.target.value)}
          className="mt-1"
        />
      </label>

      <div className="mt-3">
        {isPending && <p className="text-sm text-[var(--muted)]">Checking availability…</p>}
        {error && <p className="notice-error">{error}</p>}
        {!isPending && !error && slots.length === 0 && (
          <p className="text-sm text-[var(--muted)]">
            No open times on this date — try another day.
          </p>
        )}
        {!isPending && slots.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {slots.map((iso) => {
              const isSelected = iso === selected;
              return (
                <button
                  key={iso}
                  type="button"
                  onClick={() => onSelect(isSelected ? null : iso)}
                  className={`rounded-[var(--radius-sm)] border px-2 py-2 text-sm font-medium transition-colors ${
                    isSelected
                      ? "border-[var(--trust)] bg-[var(--trust-tint)] text-[var(--trust)]"
                      : "border-[var(--border)] hover:border-[var(--trust)]"
                  }`}
                >
                  {new Date(iso).toLocaleTimeString("en-KE", { hour: "numeric", minute: "2-digit" })}
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

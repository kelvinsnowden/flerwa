"use client";

import { useState, useTransition } from "react";
import type { AvailabilityRule, BlockedSlot } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { saveAvailabilityRules, addBlockedSlot, removeBlockedSlot } from "./actions";

const DAYS = [
  { value: 0, label: "Sunday" },
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
] as const;

type DayRow = { enabled: boolean; start_time: string; end_time: string };

function rowsFromRules(rules: AvailabilityRule[]): DayRow[] {
  return DAYS.map(({ value }) => {
    const rule = rules.find((r) => r.day_of_week === value);
    return rule
      ? { enabled: true, start_time: rule.start_time.slice(0, 5), end_time: rule.end_time.slice(0, 5) }
      : { enabled: false, start_time: "09:00", end_time: "17:00" };
  });
}

export function AvailabilityEditor({
  initialRules,
  initialBlockedSlots,
}: {
  initialRules: AvailabilityRule[];
  initialBlockedSlots: BlockedSlot[];
}) {
  const [rows, setRows] = useState<DayRow[]>(() => rowsFromRules(initialRules));
  const [blockedSlots, setBlockedSlots] = useState(initialBlockedSlots);
  const [hoursError, setHoursError] = useState<string | null>(null);
  const [hoursSaved, setHoursSaved] = useState(false);
  const [isSavingHours, startSavingHours] = useTransition();

  const [blockStart, setBlockStart] = useState("");
  const [blockEnd, setBlockEnd] = useState("");
  const [blockReason, setBlockReason] = useState("");
  const [blockError, setBlockError] = useState<string | null>(null);
  const [isAddingBlock, startAddingBlock] = useTransition();

  function updateRow(index: number, patch: Partial<DayRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
    setHoursSaved(false);
  }

  function handleSaveHours() {
    setHoursError(null);
    const rules = rows
      .map((r, i) => ({ ...r, day_of_week: DAYS[i].value }))
      .filter((r) => r.enabled)
      .map(({ day_of_week, start_time, end_time }) => ({ day_of_week, start_time, end_time }));

    startSavingHours(async () => {
      const res = await saveAvailabilityRules(rules);
      if (res.error) {
        setHoursError(res.error);
      } else {
        setHoursSaved(true);
      }
    });
  }

  function handleAddBlock() {
    setBlockError(null);
    startAddingBlock(async () => {
      const res = await addBlockedSlot(blockStart, blockEnd, blockReason);
      if (res.error) {
        setBlockError(res.error);
        return;
      }
      setBlockStart("");
      setBlockEnd("");
      setBlockReason("");
      // Optimistic — the actual row (with its real id) will show up after
      // revalidation; a temp local entry keeps the list feeling responsive.
      setBlockedSlots((prev) => [
        ...prev,
        { id: `pending-${Date.now()}`, provider_id: "", starts_at: blockStart, ends_at: blockEnd, reason: blockReason || null },
      ]);
    });
  }

  function handleRemoveBlock(id: string) {
    setBlockedSlots((prev) => prev.filter((b) => b.id !== id));
    if (!id.startsWith("pending-")) {
      void removeBlockedSlot(id);
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h2 className="font-semibold mb-1">Weekly hours</h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          Customers booking a scheduled service can only pick times inside these hours.
        </p>
        <div className="flex flex-col gap-2">
          {rows.map((row, i) => (
            <div key={DAYS[i].value} className="card p-3 flex items-center gap-3">
              <label className="flex items-center gap-2 w-28 flex-shrink-0 text-sm font-medium">
                <input
                  type="checkbox"
                  checked={row.enabled}
                  onChange={(e) => updateRow(i, { enabled: e.target.checked })}
                />
                {DAYS[i].label}
              </label>
              {row.enabled ? (
                <div className="flex items-center gap-2 flex-1">
                  <input
                    type="time"
                    value={row.start_time}
                    onChange={(e) => updateRow(i, { start_time: e.target.value })}
                    className="flex-1 min-w-0"
                  />
                  <span className="text-[var(--muted)]">to</span>
                  <input
                    type="time"
                    value={row.end_time}
                    onChange={(e) => updateRow(i, { end_time: e.target.value })}
                    className="flex-1 min-w-0"
                  />
                </div>
              ) : (
                <span className="text-sm text-[var(--muted)]">Closed</span>
              )}
            </div>
          ))}
        </div>
        {hoursError && <p className="notice-error mt-2">{hoursError}</p>}
        <button
          type="button"
          onClick={handleSaveHours}
          disabled={isSavingHours}
          className="btn-primary mt-3"
        >
          {isSavingHours ? "Saving…" : hoursSaved ? "Saved ✓" : "Save weekly hours"}
        </button>
      </div>

      <div>
        <h2 className="font-semibold mb-1">Time off</h2>
        <p className="text-sm text-[var(--muted)] mb-3">
          Block a specific date range — customers won&apos;t be able to book you during it.
        </p>
        <div className="flex flex-col gap-2 mb-3">
          {blockedSlots.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No time off blocked.</p>
          )}
          {blockedSlots.map((b) => (
            <div key={b.id} className="card p-3 flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-sm font-medium truncate">
                  {new Date(b.starts_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                  {" – "}
                  {new Date(b.ends_at).toLocaleString("en-KE", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}
                </p>
                {b.reason && <p className="text-xs text-[var(--muted)] truncate">{b.reason}</p>}
              </div>
              <button
                type="button"
                onClick={() => handleRemoveBlock(b.id)}
                className="flex-shrink-0 text-[var(--muted)] hover:text-red-600"
                aria-label="Remove"
              >
                <Icon name="x" size={16} />
              </button>
            </div>
          ))}
        </div>

        <div className="card p-3 flex flex-col gap-2">
          <div className="grid grid-cols-2 gap-2">
            <label className="text-xs font-medium">
              From
              <input
                type="datetime-local"
                value={blockStart}
                onChange={(e) => setBlockStart(e.target.value)}
                className="mt-1"
              />
            </label>
            <label className="text-xs font-medium">
              To
              <input
                type="datetime-local"
                value={blockEnd}
                onChange={(e) => setBlockEnd(e.target.value)}
                className="mt-1"
              />
            </label>
          </div>
          <input
            type="text"
            value={blockReason}
            onChange={(e) => setBlockReason(e.target.value)}
            placeholder="Reason (optional)"
          />
          {blockError && <p className="notice-error">{blockError}</p>}
          <button
            type="button"
            onClick={handleAddBlock}
            disabled={isAddingBlock || !blockStart || !blockEnd}
            className="btn-secondary self-start text-sm px-3 py-1.5"
          >
            {isAddingBlock ? "Adding…" : "Block this time"}
          </button>
        </div>
      </div>
    </div>
  );
}

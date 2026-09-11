"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { getMonthAvailability } from "./actions";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

type DayStatus = "available" | "booked" | "unavailable";

export function AvailabilityCalendar({ providerId }: { providerId: string }) {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1); // 1-12
  const [days, setDays] = useState<Record<string, DayStatus>>({});
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    startTransition(async () => {
      const res = await getMonthAvailability(providerId, year, month);
      if (res.error) {
        setError(res.error);
        return;
      }
      setError(null);
      setDays(Object.fromEntries((res.days ?? []).map((d) => [d.day, d.status])));
    });
  }, [providerId, year, month]);

  function changeMonth(delta: number) {
    let m = month + delta;
    let y = year;
    if (m < 1) {
      m = 12;
      y -= 1;
    } else if (m > 12) {
      m = 1;
      y += 1;
    }
    setMonth(m);
    setYear(y);
  }

  const firstOfMonth = new Date(year, month - 1, 1);
  const daysInMonth = new Date(year, month, 0).getDate();
  // JS getDay(): 0=Sun..6=Sat; we want a Mon-first grid.
  const leadingBlanks = (firstOfMonth.getDay() + 6) % 7;
  const cells: (number | null)[] = [...Array(leadingBlanks).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];

  function statusFor(dayNum: number): DayStatus | undefined {
    const key = `${year}-${String(month).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
    return days[key];
  }

  const dotStyle: Record<DayStatus, { bg: string; fg: string }> = {
    available: { bg: "var(--trust-tint)", fg: "var(--trust-dark)" },
    booked: { bg: "var(--danger-tint)", fg: "var(--danger)" },
    unavailable: { bg: "transparent", fg: "var(--muted-2)" },
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <button type="button" onClick={() => changeMonth(-1)} aria-label="Previous month" className="p-1 text-[var(--muted)]">
          <Icon name="chevron-right" size={16} className="rotate-180" />
        </button>
        <p className="font-semibold text-sm">
          {MONTH_NAMES[month - 1]} {year}
        </p>
        <button type="button" onClick={() => changeMonth(1)} aria-label="Next month" className="p-1 text-[var(--muted)]">
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1 text-center text-xs text-[var(--muted)] mb-1">
        {WEEKDAY_LABELS.map((d) => (
          <span key={d}>{d}</span>
        ))}
      </div>

      <div className={`grid grid-cols-7 gap-1 ${isPending ? "opacity-50" : ""}`}>
        {cells.map((dayNum, i) => {
          if (dayNum === null) return <span key={`b${i}`} />;
          const status = statusFor(dayNum);
          const style = status ? dotStyle[status] : dotStyle.unavailable;
          return (
            <div
              key={dayNum}
              className="aspect-square rounded-full flex items-center justify-center text-xs font-medium"
              style={{ background: style.bg, color: style.fg }}
            >
              {dayNum}
            </div>
          );
        })}
      </div>

      {error && <p className="notice-error mt-2">{error}</p>}

      <div className="flex items-center gap-4 mt-3 text-xs text-[var(--muted)]">
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--trust-tint)" }} />
          Available
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: "var(--danger-tint)" }} />
          Booked
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full border border-[var(--border)]" />
          Unavailable
        </span>
      </div>
    </div>
  );
}

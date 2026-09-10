"use client";

import { useState, useTransition } from "react";
import { Icon, type IconName } from "@/components/ui/icon";
import { setIntent } from "./actions";

const OPTIONS: { value: "buyer" | "seller" | "both"; icon: IconName; title: string; body: string }[] = [
  {
    value: "buyer",
    icon: "search",
    title: "Find someone to help me",
    body: "Book services, hire professionals and get things done.",
  },
  {
    value: "seller",
    icon: "briefcase",
    title: "Offer my services",
    body: "Sell your skills and get hired by customers.",
  },
  {
    value: "both",
    icon: "user",
    title: "Both",
    body: "I want to hire people and offer my own services.",
  },
];

export function OnboardingForm() {
  const [selected, setSelected] = useState<"buyer" | "seller" | "both" | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex flex-col gap-3">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => setSelected(opt.value)}
          className="card p-4 flex items-center gap-3 text-left transition-colors"
          style={selected === opt.value ? { borderColor: "var(--trust)", background: "var(--trust-tint)" } : undefined}
        >
          <span
            className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--trust-tint)", color: "var(--trust)" }}
          >
            <Icon name={opt.icon} size={20} />
          </span>
          <span className="min-w-0">
            <span className="block font-semibold">{opt.title}</span>
            <span className="block text-sm text-[var(--muted)] mt-0.5">{opt.body}</span>
          </span>
          {selected === opt.value && (
            <span className="ml-auto flex-shrink-0" style={{ color: "var(--trust)" }}>
              <Icon name="check-circle" size={20} />
            </span>
          )}
        </button>
      ))}

      <button
        type="button"
        disabled={!selected || isPending}
        className="btn-primary mt-3"
        onClick={() => {
          if (!selected) return;
          startTransition(() => setIntent(selected));
        }}
      >
        {isPending ? "Continuing…" : "Continue"}
      </button>
    </div>
  );
}

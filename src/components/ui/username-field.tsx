"use client";

import { useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const USERNAME_FORMAT = /^[a-z][a-z0-9_]{2,29}$/;

type Status = "idle" | "invalid" | "checking" | "available" | "taken" | "same" | "error";

/**
 * Debounced live availability check against rpc_username_available, so
 * someone finds out a handle is taken while they're still typing it, not
 * after submitting the whole form. Renders as a plain named input
 * (name="username") so it still works inside a native
 * `<form action={serverAction}>` — the live check is purely UI feedback;
 * the server action is still the real source of truth and still handles
 * a same-instant collision via the unique-constraint error.
 */
export function UsernameField({
  defaultValue = "",
  currentUsername = null,
  required = false,
  helpText,
}: {
  defaultValue?: string;
  /** The signed-in user's own current username, if any — typing back to
   * this exact value is always fine, never flagged as taken since it's
   * already theirs. */
  currentUsername?: string | null;
  required?: boolean;
  helpText?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  const [status, setStatus] = useState<Status>("idle");
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    const trimmed = value.trim().toLowerCase();

    if (!trimmed) {
      setStatus("idle");
      return;
    }
    if (currentUsername && trimmed === currentUsername.toLowerCase()) {
      setStatus("same");
      return;
    }
    if (!USERNAME_FORMAT.test(trimmed)) {
      setStatus("invalid");
      return;
    }

    setStatus("checking");
    const myRequestId = ++requestIdRef.current;
    timeoutRef.current = setTimeout(async () => {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("rpc_username_available", { p_username: trimmed });
      // A newer keystroke already started its own check — this response
      // is stale, discard it rather than let it flash an outdated status.
      if (myRequestId !== requestIdRef.current) return;
      if (error) {
        setStatus("error");
        return;
      }
      setStatus(data ? "available" : "taken");
    }, 450);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [value, currentUsername]);

  const message: Partial<Record<Status, { text: string; tone: "muted" | "trust" | "danger" }>> = {
    invalid: { text: "3-30 characters, lowercase letters/numbers/underscores, must start with a letter.", tone: "muted" },
    checking: { text: "Checking availability…", tone: "muted" },
    available: { text: "Available", tone: "trust" },
    taken: { text: "That username is already taken.", tone: "danger" },
    error: { text: "Couldn't check availability right now.", tone: "muted" },
  };
  const shown = message[status];

  return (
    <label className="text-sm font-medium">
      Username{!required && " (optional)"}
      <div className="mt-1 flex items-center gap-1">
        <span className="text-[var(--muted)]">@</span>
        <input
          name="username"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          className="flex-1"
          placeholder="e.g. kelvinkimathi"
          pattern="[a-z][a-z0-9_]{2,29}"
          title="3-30 characters, lowercase letters/numbers/underscores, must start with a letter"
          autoCapitalize="none"
          autoCorrect="off"
          required={required}
        />
      </div>
      {shown && (
        <span
          className="text-xs mt-1 flex items-center gap-1"
          style={{ color: shown.tone === "danger" ? "var(--danger)" : shown.tone === "trust" ? "var(--trust)" : "var(--muted)" }}
        >
          {status === "available" && "✓ "}
          {shown.text}
        </span>
      )}
      {!shown && helpText && <span className="text-xs text-[var(--muted)] mt-1 block">{helpText}</span>}
    </label>
  );
}

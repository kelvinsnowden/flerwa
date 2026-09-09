"use client";

import { useEffect, useState, useTransition } from "react";
import { Icon } from "@/components/ui/icon";
import { OtpInput } from "@/components/ui/otp-input";
import { verifyOtp, resendOtp } from "../phone-actions";

const RESEND_SECONDS = 30;

export function VerifyForm({ phone, next }: { phone: string; next?: string }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resendState, setResendState] = useState<"idle" | "sending" | "sent">("idle");

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  function handleResend() {
    setResendState("sending");
    setError(null);
    startTransition(async () => {
      const res = await resendOtp(phone);
      if (res?.error) {
        setError(res.error);
        setResendState("idle");
      } else {
        setResendState("sent");
        setSecondsLeft(RESEND_SECONDS);
      }
    });
  }

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await verifyOtp(formData);
          if (result?.error) setError(result.error);
        });
      }}
    >
      <input type="hidden" name="phone" value={phone} />
      {next && <input type="hidden" name="next" value={next} />}

      <OtpInput />

      {error && <p className="notice-error">{error}</p>}

      <button type="submit" disabled={isPending} className="btn-primary justify-between">
        {isPending ? "Verifying…" : "Verify code"}
        {!isPending && <Icon name="chevron-right" size={18} />}
      </button>

      <p className="text-sm text-center text-[var(--muted)]">
        Didn&apos;t receive the code?{" "}
        {secondsLeft > 0 ? (
          <span>
            Resend in <span className="font-semibold text-[var(--foreground)]">00:{String(secondsLeft).padStart(2, "0")}</span>
          </span>
        ) : (
          <button
            type="button"
            onClick={handleResend}
            disabled={isPending || resendState === "sending"}
            className="font-semibold"
            style={{ color: "var(--trust)" }}
          >
            {resendState === "sending" ? "Sending…" : resendState === "sent" ? "Code resent" : "Resend"}
          </button>
        )}
      </p>
    </form>
  );
}

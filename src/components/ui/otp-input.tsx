"use client";

import { useRef, useState } from "react";

const LENGTH = 6;

/**
 * Six individually-boxed digits matching design-references/mobile/
 * 02-otp.png. Writes the assembled code into a hidden input named
 * `token` so it submits with the surrounding form — this component holds
 * no opinion about what happens with the code, it only collects it.
 */
export function OtpInput({ autoFocus = true }: { autoFocus?: boolean }) {
  const [digits, setDigits] = useState<string[]>(Array(LENGTH).fill(""));
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  function setDigit(index: number, value: string) {
    const next = [...digits];
    next[index] = value;
    setDigits(next);
  }

  function handleChange(index: number, value: string) {
    const clean = value.replace(/\D/g, "");
    if (!clean) {
      setDigit(index, "");
      return;
    }
    if (clean.length > 1) {
      // Pasted or autofilled a run of digits starting at this box.
      const chars = clean.slice(0, LENGTH - index).split("");
      const next = [...digits];
      chars.forEach((c, i) => (next[index + i] = c));
      setDigits(next);
      const lastFilled = Math.min(index + chars.length, LENGTH - 1);
      inputRefs.current[lastFilled]?.focus();
      return;
    }
    setDigit(index, clean);
    if (index < LENGTH - 1) inputRefs.current[index + 1]?.focus();
  }

  function handleKeyDown(index: number, e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  return (
    <div>
      <input type="hidden" name="token" value={digits.join("")} />
      <div className="flex gap-2 justify-between">
        {digits.map((digit, i) => (
          <input
            key={i}
            ref={(el) => {
              inputRefs.current[i] = el;
            }}
            type="text"
            inputMode="numeric"
            autoComplete={i === 0 ? "one-time-code" : "off"}
            maxLength={LENGTH}
            autoFocus={autoFocus && i === 0}
            value={digit}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            className="w-full text-center text-lg font-semibold"
            style={{ minHeight: "3.25rem", padding: 0 }}
            aria-label={`Digit ${i + 1} of ${LENGTH}`}
          />
        ))}
      </div>
    </div>
  );
}

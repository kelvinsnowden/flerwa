/**
 * Kenya-only launch (see BUILD_PLAN.md / ARCHITECTURE.md) — this
 * normalizer deliberately only handles Kenyan numbers rather than a full
 * international phone library, matching the fixed "+254" prefix shown in
 * design-references/mobile/01-login.png. Accepts what a user is likely to
 * type: "0712345678", "712345678", "+254712345678", with spaces.
 */
export function normalizeKenyanPhone(input: string): string | null {
  const digits = input.replace(/[^\d]/g, "");
  let national: string | null = null;

  if (digits.length === 9 && /^[17]/.test(digits)) {
    national = digits;
  } else if (digits.length === 10 && digits.startsWith("0")) {
    national = digits.slice(1);
  } else if (digits.length === 12 && digits.startsWith("254")) {
    national = digits.slice(3);
  }

  if (!national || !/^[17]\d{8}$/.test(national)) return null;
  return `+254${national}`;
}

/** For display: "+254712345678" -> "+254 712 345 678" */
export function formatKenyanPhoneDisplay(e164: string): string {
  const match = /^\+254(\d{3})(\d{3})(\d{3})$/.exec(e164);
  if (!match) return e164;
  return `+254 ${match[1]} ${match[2]} ${match[3]}`;
}

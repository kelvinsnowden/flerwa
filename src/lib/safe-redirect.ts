/**
 * Only ever redirect to a same-origin relative path from a "next" field —
 * it round-trips through a form field / query param a browser (or a
 * crafted link) controls, so treating it as a safe absolute/external
 * target would be an open-redirect hole. Not a server action itself (a
 * "use server" file may only export async functions), so this lives in
 * its own plain module shared by the email and phone/OTP auth actions.
 */
export function safeNext(next: FormDataEntryValue | string | null, fallback = "/"): string {
  const value = String(next ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
}

"use server";

/**
 * Phone + OTP is the primary authentication experience (see
 * design-references/mobile/01-login.png, 02-otp.png). This file is the
 * one place the app talks to Supabase Auth's phone/SMS API — everything
 * above it (the UI) only ever sees "sent" / "verified" / an error
 * message, never a provider name. That's the whole abstraction: which
 * SMS vendor actually delivers the message (Twilio, MessageBird, Vonage,
 * ...) is configured entirely inside the Supabase dashboard under
 * Authentication → Providers → Phone, using real account credentials —
 * never in this codebase. See SECURITY.md "Phone + OTP authentication"
 * for what has to be configured there before this works in production,
 * and for Supabase's own Test Phone Numbers mechanism for QA — the only
 * sanctioned way to test this flow without sending a real SMS. Nothing
 * here fakes a verification result or hardcodes a code: every call below
 * is the real Supabase Auth API, and a misconfigured/unconfigured SMS
 * provider surfaces as a real error from that API, not a silent success.
 */

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { normalizeKenyanPhone } from "@/lib/phone";
import { safeNext } from "@/lib/safe-redirect";

export async function sendOtp(formData: FormData) {
  const raw = String(formData.get("phone") ?? "");
  const phone = normalizeKenyanPhone(raw);
  if (!phone) return { error: "Enter a valid Kenyan phone number, e.g. 0712 345 678." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: error.message };

  const next = safeNext(formData.get("next"));
  redirect(`/login/verify?phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
}

export async function resendOtp(phone: string) {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) return { error: error.message };
  return { success: true as const };
}

export async function verifyOtp(formData: FormData) {
  const phone = String(formData.get("phone") ?? "");
  const token = String(formData.get("token") ?? "");
  if (!phone || token.length !== 6) return { error: "Enter the 6-digit code." };

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) return { error: error.message };

  redirect(safeNext(formData.get("next")));
}

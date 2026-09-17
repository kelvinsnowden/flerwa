"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";
import { checkRateLimit } from "@/lib/rate-limit";

// Supabase's dashboard-configured Site URL currently points at a stale
// Vercel project (flerwa-kelvins-projects-85e09e17.vercel.app, which no
// longer resolves to a real deployment) — confirmed live during the
// production-parity audit: a real confirmation link 404s instead of
// returning to the app. Passing emailRedirectTo explicitly overrides that
// default for this call, using the actual request's host so it's correct
// on whichever domain the signup happened on (production or a preview).
// This alone is NOT sufficient — Supabase only honors emailRedirectTo
// values that are also present in the project's Auth → URL Configuration
// → Redirect URLs allow-list, which still needs updating in the
// dashboard (see VERIFICATION_MODEL_AUDIT.md / this commit's message).
async function currentOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return host ? `${proto}://${host}` : undefined;
}

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(safeNext(formData.get("next")));
}

const USERNAME_FORMAT = /^[a-z][a-z0-9_]{2,29}$/;

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  const usernameRaw = String(formData.get("username") ?? "").trim().toLowerCase();
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };
  if (usernameRaw && !USERNAME_FORMAT.test(usernameRaw)) {
    return {
      error: "Username must be 3-30 characters, start with a letter, and contain only lowercase letters, numbers, and underscores.",
    };
  }

  const { allowed } = await checkRateLimit("signup", { max: 5, windowSeconds: 3600 });
  if (!allowed) return { error: "Too many signups from this connection recently — please try again later." };

  const supabase = await createClient();
  const origin = await currentOrigin();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // trg_handle_new_user reads username out of this same metadata and
      // sets it on the new profiles row — a same-instant collision there
      // falls back to leaving it null rather than failing signup outright
      // (see that trigger's own comment); this form's live availability
      // check (UsernameField) is what actually prevents that in practice.
      data: { full_name: fullName, ...(usernameRaw ? { username: usernameRaw } : {}) },
      ...(origin ? { emailRedirectTo: `${origin}/login/email` } : {}),
    },
  });
  if (error) return { error: error.message };

  // trg_handle_new_user (server-side trigger) creates the profiles row with
  // role='customer' automatically — the client never sets a role. See
  // supabase/migrations/20260908134556_transactions_payments_trust.sql.

  // A null session means email confirmation is required before this
  // account can log in — Supabase created the user but did NOT start an
  // authenticated session. Previously this silently redirected to the
  // homepage still logged out, with zero indication anything happened;
  // found by an actual signup during a live audit. Send them somewhere
  // that says so instead of pretending nothing changed.
  if (!data.session) {
    redirect(`/signup/check-email?email=${encodeURIComponent(email)}`);
  }

  redirect(safeNext(formData.get("next")));
}

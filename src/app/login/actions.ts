"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { safeNext } from "@/lib/safe-redirect";

export async function login(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Email and password are required." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: error.message };

  redirect(safeNext(formData.get("next")));
}

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
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

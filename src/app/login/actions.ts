"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

// Only ever redirect to a same-origin relative path from the "next" field —
// it round-trips through a form field that a browser (or a crafted link to
// /login?next=...) controls, so treating it as a safe absolute/external
// target would be an open-redirect hole.
function safeNext(next: FormDataEntryValue | null, fallback = "/"): string {
  const value = String(next ?? "");
  return value.startsWith("/") && !value.startsWith("//") ? value : fallback;
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

export async function signup(formData: FormData) {
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const fullName = String(formData.get("full_name") ?? "");
  if (!email || !password) return { error: "Email and password are required." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
  if (error) return { error: error.message };

  // trg_handle_new_user (server-side trigger) creates the profiles row with
  // role='customer' automatically — the client never sets a role. See
  // supabase/migrations/20260908134556_transactions_payments_trust.sql.
  redirect(safeNext(formData.get("next")));
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function postTask(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in to post a task." };

  const categoryId = String(formData.get("category_id") ?? "");
  const locationId = String(formData.get("location_id") ?? "");
  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const budgetRaw = String(formData.get("budget_hint") ?? "").trim();

  if (!categoryId) return { error: "Choose a category." };
  if (!title) return { error: "Tell us what you need in a few words." };
  if (!description) return { error: "Add a bit more detail so professionals know what's involved." };

  const budgetHintMinor = budgetRaw ? Math.round(Number(budgetRaw) * 100) : null;
  if (budgetRaw && (!Number.isFinite(budgetHintMinor) || (budgetHintMinor ?? 0) < 0)) {
    return { error: "Budget must be a positive number." };
  }

  const contactPhone = String(formData.get("contact_phone") ?? "").trim();
  if (!contactPhone) return { error: "A contact phone number is required." };

  // RLS ("requests customer read/write own") is what actually enforces
  // that a request can only be created for the signed-in customer —
  // this insert would be rejected by the database, not just the UI, if
  // customer_id didn't match auth.uid().
  const { data, error } = await supabase
    .from("service_requests")
    .insert({
      customer_id: user.id,
      category_id: categoryId,
      location_id: locationId || null,
      title,
      description,
      budget_hint_minor: budgetHintMinor,
      contact_phone: contactPhone,
    })
    .select("id")
    .single();
  if (error) return { error: error.message };

  redirect(`/tasks/${data.id}`);
}

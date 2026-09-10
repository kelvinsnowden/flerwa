"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";

export async function submitDealDeskRequest(formData: FormData) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in as a provider first." };

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!provider) return { error: "You need a provider profile first — apply as a provider." };

  const customerEmail = String(formData.get("customer_email") ?? "").trim();
  const customerPhone = String(formData.get("customer_phone") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const amountKes = Number(formData.get("amount_kes") ?? 0);

  if (!description) return { error: "Describe the job you already agreed with your customer." };
  if (!customerEmail && !customerPhone) return { error: "A way to reach your customer is required." };

  const { error } = await supabase.from("deal_desk_requests").insert({
    provider_id: provider.id,
    customer_email: customerEmail || null,
    customer_phone: customerPhone || null,
    description,
    // proposed_amount_minor is minor units (cents) despite the form
    // taking whole KES — this used to divide back out by 100 right after
    // multiplying, silently storing whole KES into a "minor units" column.
    proposed_amount_minor: amountKes > 0 ? Math.round(amountKes * 100) : null,
  });
  if (error) return { error: error.message };

  redirect("/provider?deal_desk=submitted");
}

"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function setIntent(intent: "buyer" | "seller" | "both") {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  // Purely a preference for which CTA to lead with — never gates access.
  // Selling capability is still entirely governed by the providers table.
  await supabase.from("profiles").update({ intent }).eq("id", user.id);

  redirect(intent === "seller" ? "/provider/apply" : "/");
}

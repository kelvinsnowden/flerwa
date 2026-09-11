"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// FAQs are replaced wholesale on save — same pattern as
// saveAvailabilityRules / provider_service_areas — RLS ("faqs self
// write") already scopes both the delete and the insert to the caller's
// own provider_id.
export async function saveFaqs(items: { question: string; answer: string }[]) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Please log in first." };

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) return { error: "You don't have a professional profile yet." };

  const cleaned = items
    .map((i) => ({ question: i.question.trim(), answer: i.answer.trim() }))
    .filter((i) => i.question && i.answer);

  const { error: delError } = await supabase.from("provider_faqs").delete().eq("provider_id", provider.id);
  if (delError) return { error: delError.message };

  if (cleaned.length > 0) {
    const { error: insError } = await supabase
      .from("provider_faqs")
      .insert(cleaned.map((f, i) => ({ provider_id: provider.id, question: f.question, answer: f.answer, sort_order: i })));
    if (insError) return { error: insError.message };
  }

  revalidatePath("/provider/faq");
  return { success: true as const };
}

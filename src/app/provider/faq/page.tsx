import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { ProviderFaq } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { FaqEditor } from "./faq-editor";

export default async function ProviderFaqPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/faq");

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) redirect("/provider/apply");

  const { data: faqs } = await supabase
    .from("provider_faqs")
    .select("*")
    .eq("provider_id", provider.id)
    .order("sort_order")
    .returns<ProviderFaq[]>();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <Link href="/provider" className="text-sm text-[var(--muted)] flex items-center gap-1 mb-4">
        <Icon name="chevron-right" size={14} className="rotate-180" />
        Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-1">FAQ</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Answer the questions customers ask most — shown on your profile.
      </p>

      <FaqEditor initialFaqs={faqs ?? []} />
    </div>
  );
}

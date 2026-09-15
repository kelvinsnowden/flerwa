import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { SocialHighlight } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { SocialEditor } from "./social-editor";

export default async function ProviderSocialPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/social");

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) redirect("/provider/apply");

  const { data: highlights } = await supabase
    .from("provider_social_highlights")
    .select("*")
    .eq("provider_id", provider.id)
    .order("sort_order")
    .returns<SocialHighlight[]>();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <Link href="/provider" className="text-sm text-[var(--muted)] flex items-center gap-1 mb-4">
        <Icon name="chevron-right" size={14} className="rotate-180" />
        Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-1">Social highlights</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Link an Instagram or TikTok post you made — customers see a card on your profile with a link to
        view it on the original platform. This is supplementary to your Portfolio, which stays the main
        way customers see your work.
      </p>

      <SocialEditor initialHighlights={highlights ?? []} />
    </div>
  );
}

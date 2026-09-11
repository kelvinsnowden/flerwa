import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PortfolioItem } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { PortfolioManager } from "./portfolio-manager";

export default async function ProviderPortfolioPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/portfolio");

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) redirect("/provider/apply");

  const { data: items } = await supabase
    .from("provider_portfolio_items")
    .select("*")
    .eq("provider_id", provider.id)
    .order("sort_order")
    .returns<PortfolioItem[]>();

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <Link href="/provider" className="text-sm text-[var(--muted)] flex items-center gap-1 mb-4">
        <Icon name="chevron-right" size={14} className="rotate-180" />
        Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-1">Portfolio</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Real photos of your work — customers see these on your profile.
      </p>

      <PortfolioManager initialItems={items ?? []} />
    </div>
  );
}

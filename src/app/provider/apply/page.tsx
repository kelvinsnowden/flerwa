import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { Wizard } from "./wizard";

export default async function ProviderApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/apply");

  const [{ data: provider }, { data: profile }, { data: categories }, { data: services }, { data: locations }] =
    await Promise.all([
      supabase
        .from("providers")
        .select(
          "*, provider_categories(category_id, attributes), provider_services(service_id, price_minor), provider_service_areas(location_id)"
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase.from("profiles").select("avatar_url, full_name").eq("id", user.id).single(),
      supabase.from("categories").select("id, slug, name").eq("is_active", true).order("sort_order"),
      supabase.from("services").select("id, category_id, name, base_price_minor, currency").eq("is_active", true),
      supabase.from("locations").select("id, ward, town").order("ward"),
    ]);

  // Already verified/submitted sellers manage things from the dashboard —
  // the wizard is for first-time setup and edits while still pending.
  if (provider && provider.verification_status !== "pending") redirect("/provider");

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <div className="relative h-32 rounded-2xl overflow-hidden mb-6">
        <Image
          src="/images/photos/provider-at-work.jpg"
          alt="A professional photographing a kitchen while completing a structured checklist"
          fill
          sizes="(min-width: 640px) 512px, 100vw"
          className="object-cover"
        />
      </div>
      <h1 className="text-2xl font-bold">Sell your services</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        Get discovered. Get paid securely. Every completed job builds your professional record.
      </p>

      <div className="mt-6">
        <Wizard
          provider={provider}
          profile={profile ?? null}
          categories={categories ?? []}
          services={services ?? []}
          locations={locations ?? []}
        />
      </div>
    </div>
  );
}

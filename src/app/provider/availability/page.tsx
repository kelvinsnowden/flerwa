import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AvailabilityRule, BlockedSlot } from "@/lib/types";
import { Icon } from "@/components/ui/icon";
import { AvailabilityEditor } from "./availability-editor";

export default async function ProviderAvailabilityPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/availability");

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) redirect("/provider/apply");

  // This page only matters for services that actually use a real
  // calendar — a provider who only offers request/none-mode services has
  // nothing to configure here, so tell them that instead of showing an
  // editor for a feature their services don't use.
  const { data: scheduledServices } = await supabase
    .from("provider_services")
    .select("services!inner(name)")
    .eq("provider_id", provider.id)
    .eq("is_active", true)
    .eq("services.scheduling_mode", "scheduled")
    .returns<{ services: { name: string } | null }[]>();

  const hasScheduledService = (scheduledServices ?? []).length > 0;

  const [{ data: rules }, { data: blocked }] = await Promise.all([
    supabase
      .from("provider_availability_rules")
      .select("*")
      .eq("provider_id", provider.id)
      .order("day_of_week")
      .returns<AvailabilityRule[]>(),
    supabase
      .from("provider_blocked_slots")
      .select("*")
      .eq("provider_id", provider.id)
      .order("starts_at")
      .returns<BlockedSlot[]>(),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <Link href="/provider" className="text-sm text-[var(--muted)] flex items-center gap-1 mb-4">
        <Icon name="chevron-right" size={14} className="rotate-180" />
        Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-1">Availability</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Set the hours customers can book you for scheduled services.
      </p>

      {!hasScheduledService && (
        <div className="rounded-lg bg-[var(--surface)] p-4 text-sm mb-6">
          None of your current services use a real calendar yet, so this
          won&apos;t affect anything you offer right now. You can still set
          your hours here in advance — they&apos;ll apply automatically if
          you add a scheduled service later.
        </div>
      )}

      <AvailabilityEditor initialRules={rules ?? []} initialBlockedSlots={blocked ?? []} />
    </div>
  );
}

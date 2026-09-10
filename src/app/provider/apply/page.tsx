import { redirect } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import { ApplyForm } from "./apply-form";

export default async function ProviderApplyPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/apply");

  const { data: existing } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (existing) redirect("/provider");

  const { data: locations } = await supabase.from("locations").select("id, ward, town").order("ward");

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <div className="relative h-40 rounded-2xl overflow-hidden mb-6">
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
        Get discovered. Get paid securely. Every completed job builds your
        professional record — not just another listing.
      </p>
      <div className="mt-6 card p-5">
        <ApplyForm locations={locations ?? []} />
      </div>
      <p className="mt-4 text-xs text-[var(--muted)]">
        After applying, our team reviews your identity and completes
        verification before your profile goes live. This is a manual review
        today — see docs/06-trust-architecture.md on what our verification
        badges actually mean.
      </p>
    </div>
  );
}

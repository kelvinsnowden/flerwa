import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { DealDeskCard } from "./deal-desk-card";

interface RequestRow {
  id: string;
  provider_id: string;
  customer_email: string | null;
  customer_phone: string | null;
  description: string;
  proposed_amount_minor: number | null;
  state: string;
  created_at: string;
  providers: { display_name: string } | null;
}

export default async function AdminDealDeskPage() {
  const supabase = await createClient();

  const [{ data: requests, error }, { data: categories }] = await Promise.all([
    supabase
      .from("deal_desk_requests")
      .select("*, providers(display_name)")
      .eq("state", "pending")
      .order("created_at")
      .returns<RequestRow[]>(),
    supabase.from("categories").select("id, name").eq("is_active", true).order("sort_order"),
  ]);

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Deal Desk</h1>
        <ErrorNotice message="We couldn't load the Deal Desk queue. Please refresh — this is not the same as there being nothing pending." />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Deal Desk</h1>
      <p className="text-sm text-[var(--muted)] mb-4">
        Pros submit jobs they already arranged with a customer directly.
        Converting one requires the customer to already have an account —
        look them up by the phone or email they gave the pro.
      </p>
      {!requests?.length && <p className="text-sm text-[var(--muted)]">No pending Deal Desk requests.</p>}
      <div className="flex flex-col gap-4">
        {requests?.map((r) => (
          <DealDeskCard
            key={r.id}
            request={{
              id: r.id,
              providerName: r.providers?.display_name ?? "Pro",
              customerEmail: r.customer_email,
              customerPhone: r.customer_phone,
              description: r.description,
              proposedAmountMinor: r.proposed_amount_minor,
              createdAt: r.created_at,
            }}
            categories={categories ?? []}
          />
        ))}
      </div>
    </div>
  );
}

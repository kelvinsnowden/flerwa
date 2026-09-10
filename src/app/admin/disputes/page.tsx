import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { DisputeCard } from "./dispute-card";

interface DisputeRow {
  id: string;
  transaction_id: string;
  opened_by: string;
  reason: string;
  description: string | null;
  state: string;
  created_at: string;
  service_transactions: {
    id: string;
    service_amount_minor: number;
    currency: string;
    services: { name: string } | null;
    providers: { display_name: string } | null;
    profiles: { full_name: string | null } | null;
  } | null;
}

export default async function AdminDisputesPage() {
  const supabase = await createClient();

  const { data: disputes, error } = await supabase
    .from("disputes")
    .select(
      "*, service_transactions(id, service_amount_minor, currency, services(name), providers(display_name), profiles:customer_id(full_name))"
    )
    .in("state", ["open", "under_review"])
    .order("created_at")
    .returns<DisputeRow[]>();

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Disputes</h1>
        <ErrorNotice message="We couldn't load the dispute queue. Please refresh — this is not the same as there being no open disputes." />
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Disputes</h1>
      {!disputes?.length && <p className="text-sm text-[var(--muted)]">No open disputes.</p>}
      <div className="flex flex-col gap-4">
        {disputes?.map((d) => (
          <DisputeCard
            key={d.id}
            dispute={{
              id: d.id,
              reason: d.reason,
              description: d.description,
              createdAt: d.created_at,
              serviceAmountMinor: d.service_transactions?.service_amount_minor ?? 0,
              currency: d.service_transactions?.currency ?? "KES",
              serviceName: d.service_transactions?.services?.name ?? "Service",
              providerName: d.service_transactions?.providers?.display_name ?? "Provider",
              customerName: d.service_transactions?.profiles?.full_name ?? "Customer",
            }}
          />
        ))}
      </div>
    </div>
  );
}

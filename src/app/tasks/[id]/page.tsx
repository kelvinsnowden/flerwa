import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { QuoteList, type QuoteRow } from "./quote-list";

const STATE_COPY: Record<string, string> = {
  open: "Searching for professionals",
  quoted: "Searching for professionals",
  awarded: "Booked",
  expired: "Expired — no responses in time",
  cancelled: "Cancelled",
};

export default async function TaskDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/tasks/${id}`);

  const { data: request } = await supabase
    .from("service_requests")
    .select("*, categories(name), locations(ward, town)")
    .eq("id", id)
    .eq("customer_id", user.id)
    .maybeSingle();
  if (!request) notFound();

  const { data: quotes } = await supabase
    .from("quotes")
    .select(
      "id, amount_minor, message, state, providers(display_name, slug, headline, verification_status, profiles:user_id(avatar_url), reliability_scores(avg_rating, jobs_completed))"
    )
    .eq("request_id", id)
    .order("created_at", { ascending: false })
    .returns<QuoteRow[]>();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
      <p className="text-sm text-[var(--muted)]">{request.categories?.name}</p>
      <h1 className="text-xl font-bold mt-1">{request.title}</h1>
      <span className={request.state === "awarded" ? "badge-trust inline-flex mt-2" : "badge-warn inline-flex mt-2"}>
        {STATE_COPY[request.state] ?? request.state}
      </span>

      <div className="mt-4 card p-4 flex flex-col gap-2 text-sm">
        <p className="whitespace-pre-wrap">{request.description}</p>
        <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-1">
          {request.locations && (
            <span className="inline-flex items-center gap-1">
              <Icon name="map-pin" size={12} />
              {request.locations.ward ? `${request.locations.ward}, ${request.locations.town}` : request.locations.town}
            </span>
          )}
          {request.budget_hint_minor && (
            <span className="inline-flex items-center gap-1">
              <Icon name="wallet" size={12} />
              Budget {formatMoney(request.budget_hint_minor)}
            </span>
          )}
        </div>
      </div>

      {request.state === "awarded" && request.transaction_id ? (
        <Link href={`/account/bookings/${request.transaction_id}`} className="btn-primary w-full mt-6">
          View booking
        </Link>
      ) : (
        <div className="mt-6">
          <h2 className="font-semibold mb-3">Responses</h2>
          <QuoteList requestId={request.id} quotes={quotes ?? []} />
        </div>
      )}
    </div>
  );
}

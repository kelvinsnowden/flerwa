import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { Icon } from "@/components/ui/icon";
import { QuoteForm } from "./quote-form";

export default async function TaskRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/provider/requests/${id}`);

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) redirect("/provider/apply");

  const { data: request } = await supabase
    .from("service_requests")
    .select("*, categories(name), locations(ward, town)")
    .eq("id", id)
    .maybeSingle();
  if (!request) notFound();

  const { data: myQuote } = await supabase
    .from("quotes")
    .select("id, amount_minor, state")
    .eq("request_id", id)
    .eq("provider_id", provider.id)
    .maybeSingle();

  const { data: eligible } = await supabase
    .from("provider_categories")
    .select("category_id")
    .eq("provider_id", provider.id)
    .eq("category_id", request.category_id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
      <Link href="/provider/requests" className="text-sm text-[var(--muted)] inline-flex items-center gap-1">
        <Icon name="chevron-right" size={14} className="rotate-180" />
        Task requests
      </Link>

      <h1 className="text-xl font-bold mt-3">{request.title}</h1>
      <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-1">
        <span className="inline-flex items-center gap-1">
          <Icon name="briefcase" size={12} />
          {request.categories?.name}
        </span>
        {request.locations && (
          <span className="inline-flex items-center gap-1">
            <Icon name="map-pin" size={12} />
            {request.locations.ward ? `${request.locations.ward}, ${request.locations.town}` : request.locations.town}
          </span>
        )}
      </div>

      <p className="mt-4 text-sm whitespace-pre-wrap">{request.description}</p>

      {request.budget_hint_minor && (
        <p className="mt-2 text-sm font-medium">Customer's budget: {formatMoney(request.budget_hint_minor)}</p>
      )}

      <div className="mt-6">
        {request.state !== "open" ? (
          <p className="badge-warn inline-flex">This task is no longer open</p>
        ) : !eligible ? (
          <p className="notice-error">
            Add {request.categories?.name} to your profile before quoting on this.{" "}
            <Link href="/provider/apply" className="font-semibold">
              Update your profile
            </Link>
          </p>
        ) : myQuote ? (
          <p className="badge-trust inline-flex">
            You quoted {formatMoney(myQuote.amount_minor)} — {myQuote.state}
          </p>
        ) : (
          <QuoteForm requestId={request.id} />
        )}
      </div>
    </div>
  );
}

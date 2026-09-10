import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";

export default async function TaskRequestsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/requests");

  const { data: provider } = await supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle();
  if (!provider) redirect("/provider/apply");

  const { data: myCategories } = await supabase
    .from("provider_categories")
    .select("category_id")
    .eq("provider_id", provider.id);
  const categoryIds = (myCategories ?? []).map((c) => c.category_id);

  if (categoryIds.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
        <h1 className="text-xl font-bold">Task requests</h1>
        <div className="mt-6">
          <EmptyState
            illustration="/images/empty-states/empty-search.svg"
            title="Add a category first"
            body="Choose which categories you offer in the seller wizard so we can show you matching task requests."
            action={
              <Link href="/provider/apply" className="btn-secondary">
                Update your profile
              </Link>
            }
          />
        </div>
      </div>
    );
  }

  const [{ data: requests, error }, { data: myQuotes }] = await Promise.all([
    supabase
      .from("service_requests")
      .select("*, categories(name), locations(ward, town)")
      .eq("state", "open")
      .gt("expires_at", new Date().toISOString())
      .in("category_id", categoryIds)
      .order("created_at", { ascending: false }),
    supabase.from("quotes").select("request_id").eq("provider_id", provider.id),
  ]);
  const quotedIds = new Set((myQuotes ?? []).map((q) => q.request_id));

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
      <h1 className="text-xl font-bold">Task requests</h1>
      <p className="text-sm text-[var(--muted)] mt-1">Open requests from customers in your categories.</p>

      {error && <ErrorNotice message="We couldn't load task requests right now. Please refresh." />}

      {!error && !requests?.length && (
        <div className="mt-6">
          <EmptyState
            illustration="/images/empty-states/empty-search.svg"
            title="No open requests right now"
            body="Check back later — new requests in your categories will show up here."
          />
        </div>
      )}

      {!error && !!requests?.length && (
        <div className="mt-6 flex flex-col gap-2">
          {requests.map((r) => (
            <Link
              key={r.id}
              href={`/provider/requests/${r.id}`}
              className="card p-4 flex flex-col gap-1 hover:border-[var(--trust)] transition-colors"
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold text-sm">{r.title}</p>
                {quotedIds.has(r.id) && <span className="badge-trust text-xs">Quoted</span>}
              </div>
              <p className="text-xs text-[var(--muted)] line-clamp-2">{r.description}</p>
              <div className="flex items-center gap-3 text-xs text-[var(--muted)] mt-1">
                <span className="inline-flex items-center gap-1">
                  <Icon name="briefcase" size={12} />
                  {r.categories?.name}
                </span>
                {r.locations && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="map-pin" size={12} />
                    {r.locations.ward ? `${r.locations.ward}, ${r.locations.town}` : r.locations.town}
                  </span>
                )}
                {r.budget_hint_minor && (
                  <span className="inline-flex items-center gap-1">
                    <Icon name="wallet" size={12} />
                    Budget {formatMoney(r.budget_hint_minor)}
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

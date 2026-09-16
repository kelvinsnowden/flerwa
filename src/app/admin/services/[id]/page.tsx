import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type PricingModel, type TxnState } from "@/lib/types";
import { Icon } from "@/components/ui/icon";

const PRICING_LABEL: Record<PricingModel, string> = {
  fixed: "Fixed price",
  quote: "Custom quote",
  hourly: "Hourly",
  recurring: "Recurring",
  application: "Application",
};

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function AdminServiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: service } = await supabase
    .from("services")
    .select("*, categories(id, name, vertical)")
    .eq("id", id)
    .maybeSingle();

  if (!service) notFound();

  const [{ data: scopeItems }, { data: providerServices }, { data: recentBookings }] = await Promise.all([
    supabase.from("service_scope_items").select("id, label, included, sort_order").eq("service_id", id).order("sort_order"),
    supabase
      .from("provider_services")
      .select("id, price_minor, is_active, providers(id, display_name, verification_status, is_suspended, profiles:user_id(avatar_url))")
      .eq("service_id", id)
      .returns<
        {
          id: string;
          price_minor: number | null;
          is_active: boolean;
          providers: {
            id: string;
            display_name: string;
            verification_status: string;
            is_suspended: boolean;
            profiles: { avatar_url: string | null } | null;
          } | null;
        }[]
      >(),
    supabase
      .from("service_transactions")
      .select("id, state, total_amount_minor, currency, requested_at, profiles:customer_id(full_name)")
      .eq("service_id", id)
      .order("requested_at", { ascending: false })
      .limit(20)
      .returns<
        {
          id: string;
          state: TxnState;
          total_amount_minor: number;
          currency: string;
          requested_at: string;
          profiles: { full_name: string | null } | null;
        }[]
      >(),
  ]);

  // Reviews aren't linked to a service directly — only to a transaction,
  // which links to a service. Real reviews for THIS service are looked up
  // through the same recent-bookings window above rather than a second,
  // unbounded query across the service's entire booking history.
  const bookingIds = (recentBookings ?? []).map((b) => b.id);
  const { data: reviews } = bookingIds.length
    ? await supabase
        .from("reviews")
        .select("id, transaction_id, rating, comment, is_customer_review, is_hidden, created_at")
        .in("transaction_id", bookingIds)
        .order("created_at", { ascending: false })
    : { data: [] as { id: string; transaction_id: string; rating: number; comment: string | null; is_customer_review: boolean; is_hidden: boolean; created_at: string }[] };

  const [{ count: allBookingsCount }] = await Promise.all([
    supabase.from("service_transactions").select("id", { count: "exact", head: true }).eq("service_id", id),
  ]);

  return (
    <div>
      <Link href="/admin/services" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] mb-3 inline-flex items-center gap-1">
        <Icon name="chevron-right" size={14} className="rotate-180" /> Back to Services
      </Link>

      <div className="flex items-start justify-between gap-4 mb-6">
        <div>
          <h1 className="text-xl font-bold">{service.name}</h1>
          <p className="text-sm text-[var(--muted)] mt-1">
            {service.categories?.name ?? "Uncategorized"}
            {service.is_active ? <span className="badge-trust ml-2">Active</span> : <span className="badge-muted ml-2">Paused</span>}
          </p>
        </div>
        <a href={`/services/${service.slug}`} target="_blank" rel="noreferrer" className="btn-secondary text-sm flex-shrink-0">
          View live page <Icon name="external-link" size={14} />
        </a>
      </div>

      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="stat-tile">
          <p className="text-xs text-[var(--muted)]">Base price</p>
          <p className="text-lg font-bold">{formatMoney(service.base_price_minor, service.currency)}</p>
          <p className="text-xs text-[var(--muted)]">{PRICING_LABEL[service.pricing_model as PricingModel]}</p>
        </div>
        <div className="stat-tile">
          <p className="text-xs text-[var(--muted)]">Providers offering it</p>
          <p className="text-lg font-bold">{(providerServices ?? []).filter((p) => p.is_active).length}</p>
        </div>
        <div className="stat-tile">
          <p className="text-xs text-[var(--muted)]">Total bookings</p>
          <p className="text-lg font-bold">{allBookingsCount ?? 0}</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Service information</h2>
          <dl className="text-sm space-y-2">
            <div>
              <dt className="text-xs text-[var(--muted)]">Summary</dt>
              <dd>{service.summary}</dd>
            </div>
            {service.description && (
              <div>
                <dt className="text-xs text-[var(--muted)]">Description</dt>
                <dd>{service.description}</dd>
              </div>
            )}
            <div className="flex gap-6">
              <div>
                <dt className="text-xs text-[var(--muted)]">Fulfilment</dt>
                <dd>{service.fulfilment_mode.replace(/_/g, " ")}</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Turnaround</dt>
                <dd>{service.turnaround_hours}h</dd>
              </div>
              <div>
                <dt className="text-xs text-[var(--muted)]">Requires location</dt>
                <dd>{service.requires_location ? "Yes" : "No"}</dd>
              </div>
            </div>
            <div>
              <dt className="text-xs text-[var(--muted)]">Created</dt>
              <dd>{new Date(service.created_at).toLocaleDateString("en-KE")}</dd>
            </div>
          </dl>
          {!!scopeItems?.length && (
            <div className="mt-4">
              <p className="text-xs font-medium text-[var(--muted)] mb-1.5">Scope</p>
              <ul className="text-sm space-y-1">
                {scopeItems.map((item) => (
                  <li key={item.id} className="flex items-center gap-1.5">
                    <Icon name={item.included ? "check" : "x"} size={13} className={item.included ? "text-[var(--trust)]" : "text-[var(--muted-2)]"} />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>

        <section className="card p-4">
          <h2 className="text-sm font-semibold mb-3">Providers offering this service</h2>
          {!providerServices?.length && <p className="text-sm text-[var(--muted)]">No provider has added this service yet.</p>}
          <div className="space-y-2">
            {providerServices?.map((ps) => (
              <Link
                key={ps.id}
                href={ps.providers ? `/admin/providers/${ps.providers.id}` : "#"}
                className="flex items-center justify-between gap-3 py-1.5"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {ps.providers?.profiles?.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={ps.providers.profiles.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover flex-shrink-0" />
                  ) : (
                    <span className="avatar h-7 w-7 text-xs flex-shrink-0">{initialsOf(ps.providers?.display_name ?? "?")}</span>
                  )}
                  <span className="min-w-0">
                    <span className="block text-sm font-medium truncate">{ps.providers?.display_name ?? "Unknown"}</span>
                    <span className="block text-xs text-[var(--muted)]">
                      {ps.providers?.verification_status}
                      {ps.providers?.is_suspended && " · suspended"}
                      {!ps.is_active && " · paused"}
                    </span>
                  </span>
                </div>
                <span className="text-sm font-medium whitespace-nowrap">
                  {ps.price_minor != null ? formatMoney(ps.price_minor, service.currency) : "base price"}
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Recent bookings</h2>
          {!recentBookings?.length && <p className="text-sm text-[var(--muted)]">No bookings for this service yet.</p>}
          {!!recentBookings?.length && (
            <div className="overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Customer</th>
                    <th>Status</th>
                    <th>Amount</th>
                    <th>Requested</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {recentBookings.map((b) => (
                    <tr key={b.id}>
                      <td className="text-sm">{b.profiles?.full_name ?? "Unknown"}</td>
                      <td>
                        <span className="badge-info">{TXN_STATE_LABELS[b.state]}</span>
                      </td>
                      <td className="text-sm">{formatMoney(b.total_amount_minor, b.currency)}</td>
                      <td className="text-sm text-[var(--muted)] whitespace-nowrap">{new Date(b.requested_at).toLocaleDateString("en-KE")}</td>
                      <td>
                        <Link href={`/admin/bookings/${b.id}`} className="btn-secondary text-xs px-3 py-1.5">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {(allBookingsCount ?? 0) > (recentBookings?.length ?? 0) && (
            <p className="text-xs text-[var(--muted)] mt-2">
              Showing the {recentBookings?.length ?? 0} most recent of {allBookingsCount} total bookings.
            </p>
          )}
        </section>

        <section className="card p-4 lg:col-span-2">
          <h2 className="text-sm font-semibold mb-3">Reviews</h2>
          <p className="text-xs text-[var(--muted)] mb-3">Reviews are shown only for this service&apos;s {recentBookings?.length ?? 0} most recent bookings.</p>
          {!reviews?.length && <p className="text-sm text-[var(--muted)]">No reviews on these bookings yet.</p>}
          <div className="space-y-3">
            {reviews?.map((r) => (
              <div key={r.id} className="border-t border-[var(--border)] pt-2.5 first:border-0 first:pt-0">
                <p className="text-sm flex items-center gap-0.5">
                  {Array.from({ length: 5 }, (_, i) => (
                    <Icon key={i} name="star" size={13} className={i < r.rating ? "text-[var(--warn)]" : "text-[var(--border)]"} />
                  ))}
                  {r.is_hidden && <span className="badge-danger ml-2">Hidden</span>}
                </p>
                {r.comment && <p className="text-sm mt-1">{r.comment}</p>}
                <p className="text-xs text-[var(--muted-2)] mt-0.5">
                  {r.is_customer_review ? "Customer review" : "Provider review"} · {new Date(r.created_at).toLocaleDateString("en-KE")}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

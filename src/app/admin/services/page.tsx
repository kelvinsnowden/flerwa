import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import type { PricingModel } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { Icon } from "@/components/ui/icon";

/**
 * There was no admin catalog view at all before this — /admin/categories
 * only ever managed category-level emergency pause. This is the actual
 * "what does the marketplace sell" surface: one row per row in `services`.
 *
 * "Providers offering it" and "Bookings" are both real batched counts, not
 * head-count queries per row (which wouldn't scale to a full page of rows)
 * — same pattern as the reliability-score batch on the Providers page:
 * fetch the raw rows for just the services on this page and reduce
 * client-side. There is no "subcategory" concept anywhere in the schema
 * (categories only has a flat `vertical` grouping) — not shown, not
 * invented.
 */
const PAGE_SIZE = 50;

const PRICING_LABEL: Record<PricingModel, string> = {
  fixed: "Fixed price",
  quote: "Custom quote",
  hourly: "Hourly",
  recurring: "Recurring",
  application: "Application",
};

export default async function AdminServicesPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; status?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("services")
    .select("id, name, summary, pricing_model, base_price_minor, currency, is_active, created_at, categories(id, name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.q) query = query.ilike("name", `%${params.q}%`);
  if (params.category) query = query.eq("category_id", params.category);
  if (params.status === "active") query = query.eq("is_active", true);
  else if (params.status === "paused") query = query.eq("is_active", false);

  const { data: services, count, error } = await query.returns<
    {
      id: string;
      name: string;
      summary: string;
      pricing_model: PricingModel;
      base_price_minor: number;
      currency: string;
      is_active: boolean;
      created_at: string;
      categories: { id: string; name: string } | null;
    }[]
  >();

  const serviceIds = (services ?? []).map((s) => s.id);

  const [{ data: providerRows }, { data: bookingRows }, { data: categories }] = await Promise.all([
    serviceIds.length
      ? supabase.from("provider_services").select("service_id").in("service_id", serviceIds).eq("is_active", true)
      : Promise.resolve({ data: [] as { service_id: string }[] }),
    serviceIds.length
      ? supabase.from("service_transactions").select("service_id").in("service_id", serviceIds)
      : Promise.resolve({ data: [] as { service_id: string }[] }),
    supabase.from("categories").select("id, name").order("sort_order"),
  ]);

  const providerCountByService = new Map<string, number>();
  for (const r of providerRows ?? []) providerCountByService.set(r.service_id, (providerCountByService.get(r.service_id) ?? 0) + 1);
  const bookingCountByService = new Map<string, number>();
  for (const r of bookingRows ?? []) bookingCountByService.set(r.service_id, (bookingCountByService.get(r.service_id) ?? 0) + 1);

  const [{ count: allCount }, { count: activeCount }, { count: pausedCount }] = await Promise.all([
    supabase.from("services").select("id", { count: "exact", head: true }),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", true),
    supabase.from("services").select("id", { count: "exact", head: true }).eq("is_active", false),
  ]);

  const TABS = [
    { key: undefined, label: "All", count: allCount ?? 0 },
    { key: "active", label: "Active", count: activeCount ?? 0 },
    { key: "paused", label: "Paused", count: pausedCount ?? 0 },
  ];

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const hasFilters = !!(params.q || params.category || params.status);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Services</h1>

      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {TABS.map((t) => (
          <Link
            key={t.label}
            href={t.key ? `/admin/services?status=${t.key}` : "/admin/services"}
            className="pill-tab flex-shrink-0 whitespace-nowrap"
            data-active={(params.status ?? undefined) === t.key}
          >
            {t.label} <span className="opacity-70">{t.count}</span>
          </Link>
        ))}
      </div>

      <form method="GET" className="flex flex-wrap gap-2 mb-4 text-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
          <input type="text" name="q" defaultValue={params.q ?? ""} placeholder="Search by service name" className="w-full pl-9 !min-h-0 !py-2 text-sm" />
        </div>
        <select name="category" defaultValue={params.category ?? ""} className="!min-h-0 !py-2 text-sm">
          <option value="">All categories</option>
          {(categories ?? []).map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        {params.status && <input type="hidden" name="status" value={params.status} />}
        <button type="submit" className="btn-secondary text-sm">
          Search
        </button>
        {hasFilters && (
          <Link href="/admin/services" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] px-2 self-center">
            Reset filters
          </Link>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load services. Please refresh." />}
      {!error && !services?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">{hasFilters ? "No services match these filters" : "No services yet"}</p>
        </div>
      )}
      {!error && !!services?.length && (
        <>
          <div className="card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Service</th>
                  <th>Category</th>
                  <th>Providers</th>
                  <th>Price</th>
                  <th>Bookings</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {services.map((s) => (
                  <tr key={s.id}>
                    <td>
                      <Link href={`/admin/services/${s.id}`} className="block max-w-[220px]">
                        <span className="block text-sm font-semibold truncate">{s.name}</span>
                        <span className="block text-xs text-[var(--muted)] truncate">{s.summary}</span>
                      </Link>
                    </td>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">{s.categories?.name ?? "—"}</td>
                    <td className="text-sm whitespace-nowrap">{providerCountByService.get(s.id) ?? 0}</td>
                    <td className="text-sm whitespace-nowrap">
                      {formatMoney(s.base_price_minor, s.currency)}
                      <span className="block text-xs text-[var(--muted)]">{PRICING_LABEL[s.pricing_model]}</span>
                    </td>
                    <td className="text-sm whitespace-nowrap">{bookingCountByService.get(s.id) ?? 0}</td>
                    <td>{s.is_active ? <span className="badge-trust">Active</span> : <span className="badge-muted">Paused</span>}</td>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">{new Date(s.created_at).toLocaleDateString("en-KE")}</td>
                    <td>
                      <Link href={`/admin/services/${s.id}`} className="btn-secondary text-xs px-3 py-1.5">
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4 text-sm">
              <span className="text-[var(--muted)]">
                Page {page} of {totalPages} ({count} total)
              </span>
              <div className="flex gap-2">
                {page > 1 && (
                  <a href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`} className="px-3 py-1 border rounded hover:bg-[var(--surface)]">
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`} className="px-3 py-1 border rounded hover:bg-[var(--surface)]">
                    Next
                  </a>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

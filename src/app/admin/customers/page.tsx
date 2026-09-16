import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { Icon } from "@/components/ui/icon";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md CUST-D1: there was no
 * customer-management surface at all before this — every customer-related
 * admin need was served by direct database access. "read own profile" RLS
 * already grants admins unconditional read on every profile row.
 *
 * Deliberately does NOT show an "Orders" or "Total Spent" column — there
 * is no cheap per-customer aggregate query available yet (would need a
 * grouped count/sum, which Supabase's client can't express without a new
 * view or RPC). Rather than fake those numbers or run an N+1 query per
 * row, they're left out until a real aggregate exists.
 */
const PAGE_SIZE = 50;

function initialsOf(name: string) {
  return name.split(" ").map((p) => p[0]).filter(Boolean).slice(0, 2).join("").toUpperCase();
}

export default async function AdminCustomersPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; suspended?: string; page?: string }>;
}) {
  const params = await searchParams;
  const page = Math.max(1, Number(params.page) || 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const supabase = await createClient();

  let query = supabase
    .from("profiles")
    .select("id, full_name, phone, email, avatar_url, is_suspended, created_at", { count: "exact" })
    .eq("role", "customer")
    .order("created_at", { ascending: false })
    .range(from, to);

  if (params.q) query = query.or(`full_name.ilike.%${params.q}%,phone.ilike.%${params.q}%`);
  if (params.suspended === "true") query = query.eq("is_suspended", true);

  const { data: customers, count, error } = await query;

  const totalPages = count ? Math.ceil(count / PAGE_SIZE) : 1;
  const hasFilters = !!(params.q || params.suspended);

  return (
    <div>
      <h1 className="text-xl font-bold mb-4">Customers</h1>

      <form method="GET" className="flex flex-wrap gap-2 mb-4 text-sm">
        <div className="relative flex-1 min-w-[200px]">
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
          <input type="text" name="q" defaultValue={params.q ?? ""} placeholder="Search by name or phone" className="w-full pl-9 !min-h-0 !py-2 text-sm" />
        </div>
        <label className="flex items-center gap-2 text-sm px-2">
          <input type="checkbox" name="suspended" value="true" defaultChecked={params.suspended === "true"} />
          Suspended only
        </label>
        <button type="submit" className="btn-secondary text-sm">
          Search
        </button>
        {hasFilters && (
          <Link href="/admin/customers" className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] px-2 self-center">
            Reset filters
          </Link>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load customers. Please refresh." />}
      {!error && !customers?.length && (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium">{hasFilters ? "No customers match these filters" : "No customers yet"}</p>
        </div>
      )}
      {!error && !!customers?.length && (
        <>
          <div className="card overflow-x-auto">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Customer</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id}>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-2.5">
                        {c.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={c.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <span className="avatar h-8 w-8 text-xs flex-shrink-0">{initialsOf(c.full_name ?? "?")}</span>
                        )}
                        <span className="text-sm font-semibold truncate">{c.full_name ?? "Unnamed"}</span>
                      </Link>
                    </td>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">{c.phone ?? c.email ?? "—"}</td>
                    <td>{c.is_suspended ? <span className="badge-danger">Suspended</span> : <span className="badge-trust">Active</span>}</td>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">{new Date(c.created_at).toLocaleDateString("en-KE")}</td>
                    <td>
                      <Link href={`/admin/customers/${c.id}`} className="btn-secondary text-xs px-3 py-1.5">
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

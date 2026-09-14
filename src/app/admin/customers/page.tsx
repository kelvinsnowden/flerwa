import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md CUST-D1: there was no
 * customer-management surface at all before this — every customer-related
 * admin need was served by direct database access. "read own profile" RLS
 * already grants admins unconditional read on every profile row.
 */
const PAGE_SIZE = 50;

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
    .select("id, full_name, phone, is_suspended, created_at", { count: "exact" })
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
      <h1 className="text-xl font-bold mb-6">Customers</h1>

      <form method="GET" className="flex flex-wrap gap-3 mb-6 text-sm">
        <input
          type="text"
          name="q"
          defaultValue={params.q ?? ""}
          placeholder="Search by name or phone"
          className="border rounded px-3 py-1.5 flex-1 min-w-[220px]"
        />
        <label className="flex items-center gap-2 px-3 py-1.5">
          <input type="checkbox" name="suspended" value="true" defaultChecked={params.suspended === "true"} />
          Suspended only
        </label>
        <button type="submit" className="btn-primary px-4 py-1.5 rounded">
          Filter
        </button>
        {hasFilters && (
          <a href="/admin/customers" className="text-[var(--muted)] hover:underline self-center">
            Clear
          </a>
        )}
      </form>

      {error && <ErrorNotice message="We couldn't load customers. Please refresh." />}
      {!error && !customers?.length && (
        <p className="text-sm text-[var(--muted)]">{hasFilters ? "No customers match these filters." : "No customers yet."}</p>
      )}
      {!error && !!customers?.length && (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-[var(--muted)] border-b">
                  <th className="py-2 pr-4">Name</th>
                  <th className="py-2 pr-4">Phone</th>
                  <th className="py-2 pr-4">Status</th>
                  <th className="py-2">Joined</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c) => (
                  <tr key={c.id} className="border-b last:border-0">
                    <td className="py-2 pr-4">
                      <Link href={`/admin/customers/${c.id}`} className="font-medium hover:underline">
                        {c.full_name ?? "Unnamed"}
                      </Link>
                    </td>
                    <td className="py-2 pr-4">{c.phone ?? "—"}</td>
                    <td className="py-2 pr-4">
                      {c.is_suspended ? <span className="text-[var(--danger)]">Suspended</span> : "Active"}
                    </td>
                    <td className="py-2 text-xs text-[var(--muted)]">{new Date(c.created_at).toLocaleDateString("en-KE")}</td>
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
                  <a
                    href={`?${new URLSearchParams({ ...params, page: String(page - 1) }).toString()}`}
                    className="px-3 py-1 border rounded hover:bg-[var(--surface)]"
                  >
                    Previous
                  </a>
                )}
                {page < totalPages && (
                  <a
                    href={`?${new URLSearchParams({ ...params, page: String(page + 1) }).toString()}`}
                    className="px-3 py-1 border rounded hover:bg-[var(--surface)]"
                  >
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

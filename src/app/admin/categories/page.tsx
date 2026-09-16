import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { PauseControl } from "./pause-control";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md EMG-R1: the register's TSF-014
 * finding named this as "the fastest, smallest fix" for category-level
 * emergency pause — categories.is_active already exists and is already
 * enforced by RLS ("categories readable": is_active OR is_admin(), so a
 * paused category simply becomes invisible to everyone but admins), it
 * just had no admin control surface. Still deliberately narrow: this is
 * the emergency pause switch + a real read-only summary of the catalog,
 * not a category editor — full CRUD (create/rename/re-sort a category)
 * is a separate, larger piece of work this page doesn't attempt. Pausing
 * already goes through a required-reason + dual-control-approval flow
 * (rpc_admin_set_category_active, GOV-P4), which doubles as this page's
 * confirmation step for a destructive action — not re-implemented as a
 * separate modal.
 *
 * "# providers" = providers cleared to work this category
 * (provider_categories.is_cleared = true), not every provider who has
 * ever touched it — the number that actually answers "who can be booked
 * here right now."
 */
export default async function AdminCategoriesPage() {
  const supabase = await createClient();

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, slug, vertical, is_active, requires_clearance, created_at")
    .order("sort_order");

  const categoryIds = (categories ?? []).map((c) => c.id);
  const [{ data: services }, { data: clearances }] = await Promise.all([
    categoryIds.length
      ? supabase.from("services").select("category_id").in("category_id", categoryIds)
      : Promise.resolve({ data: [] as { category_id: string }[] }),
    categoryIds.length
      ? supabase.from("provider_categories").select("category_id").in("category_id", categoryIds).eq("is_cleared", true)
      : Promise.resolve({ data: [] as { category_id: string }[] }),
  ]);

  const serviceCountByCategory = new Map<string, number>();
  for (const s of services ?? []) serviceCountByCategory.set(s.category_id, (serviceCountByCategory.get(s.category_id) ?? 0) + 1);
  const providerCountByCategory = new Map<string, number>();
  for (const c of clearances ?? []) providerCountByCategory.set(c.category_id, (providerCountByCategory.get(c.category_id) ?? 0) + 1);

  const activeCount = (categories ?? []).filter((c) => c.is_active).length;
  const pausedCount = (categories ?? []).length - activeCount;

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Categories</h1>
      <p className="text-sm text-[var(--muted)] mb-4">
        Pausing a category immediately hides it from customers (services in it stop being bookable) without
        deleting anything — resume at any time. Requires a reason and a second admin&apos;s approval, both logged.
      </p>

      <div className="flex gap-3 mb-4 text-sm">
        <span className="stat-tile !py-2 !px-3">
          <span className="text-xs text-[var(--muted)] block">Active</span>
          <span className="font-bold">{activeCount}</span>
        </span>
        <span className="stat-tile !py-2 !px-3">
          <span className="text-xs text-[var(--muted)] block">Paused</span>
          <span className="font-bold">{pausedCount}</span>
        </span>
      </div>

      {error && <ErrorNotice message="We couldn't load categories. Please refresh." />}
      {!error && (
        <div className="card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Category</th>
                <th>Vertical</th>
                <th>Services</th>
                <th>Cleared providers</th>
                <th>Status</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {categories?.map((c) => (
                <tr key={c.id}>
                  <td>
                    <span className="block text-sm font-semibold">{c.name}</span>
                    {c.requires_clearance && <span className="text-xs text-[var(--muted)]">Requires provider clearance</span>}
                  </td>
                  <td className="text-sm text-[var(--muted)] whitespace-nowrap">{c.vertical}</td>
                  <td className="text-sm">{serviceCountByCategory.get(c.id) ?? 0}</td>
                  <td className="text-sm">{providerCountByCategory.get(c.id) ?? 0}</td>
                  <td>{c.is_active ? <span className="badge-trust">Active</span> : <span className="badge-danger">Paused</span>}</td>
                  <td className="text-sm text-[var(--muted)] whitespace-nowrap">{new Date(c.created_at).toLocaleDateString("en-KE")}</td>
                  <td>
                    <PauseControl categoryId={c.id} isActive={c.is_active} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

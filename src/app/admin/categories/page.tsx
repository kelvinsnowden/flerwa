import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { PauseControl } from "./pause-control";

/**
 * MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md EMG-R1: the register's TSF-014
 * finding named this as "the fastest, smallest fix" for category-level
 * emergency pause — categories.is_active already exists and is already
 * enforced by RLS ("categories readable": is_active OR is_admin(), so a
 * paused category simply becomes invisible to everyone but admins), it
 * just had no admin control surface. Deliberately narrow: this is the
 * emergency pause switch, not a catalog editor — full CRUD (CAT-G1-G7:
 * create/edit services, pricing, effective-dating) is a separate, larger
 * piece of work with its own design questions this page doesn't answer.
 */
export default async function AdminCategoriesPage() {
  const supabase = await createClient();

  const { data: categories, error } = await supabase
    .from("categories")
    .select("id, name, slug, vertical, is_active, requires_clearance")
    .order("sort_order");

  const categoryIds = (categories ?? []).map((c) => c.id);
  const { data: services } = categoryIds.length
    ? await supabase.from("services").select("category_id").in("category_id", categoryIds)
    : { data: [] as { category_id: string }[] };
  const serviceCountByCategory = new Map<string, number>();
  for (const s of services ?? []) {
    serviceCountByCategory.set(s.category_id, (serviceCountByCategory.get(s.category_id) ?? 0) + 1);
  }

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Categories</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Pausing a category immediately hides it from customers (services in it stop being bookable) without
        deleting anything — resume at any time. Requires a reason, logged to the audit trail.
      </p>

      {error && <ErrorNotice message="We couldn't load categories. Please refresh." />}
      {!error && (
        <div className="space-y-3">
          {categories?.map((c) => (
            <div key={c.id} className="card p-4 flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">
                  {c.name}
                  {!c.is_active && (
                    <span className="ml-2 text-xs font-semibold px-2 py-0.5 rounded-full bg-[var(--danger-tint)] text-[var(--danger)]">
                      Paused
                    </span>
                  )}
                </p>
                <p className="text-xs text-[var(--muted)]">
                  {c.vertical} · {serviceCountByCategory.get(c.id) ?? 0} services
                  {c.requires_clearance && " · requires provider clearance"}
                </p>
              </div>
              <PauseControl categoryId={c.id} isActive={c.is_active} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

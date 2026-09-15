import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Service } from "@/lib/types";

/**
 * MARKETPLACE-001 Phase 6 — admin matching-oversight index. Links to
 * the per-service inspector (/admin/matching/[serviceId]).
 */
export default async function AdminMatchingIndexPage() {
  const supabase = await createClient();
  const { data: services } = await supabase
    .from("services")
    .select("id, name, slug, category_id, categories(name)")
    .eq("is_active", true)
    .order("name")
    .returns<(Pick<Service, "id" | "name" | "slug" | "category_id"> & { categories: { name: string } | null })[]>();

  return (
    <div>
      <h1 className="text-xl font-bold mb-2">Matching oversight</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        For each service, see exactly which providers would be shown to a customer right now, in what
        order and why, and which providers with this category are excluded and why. This mirrors the
        real customer-facing query and ranking (src/lib/provider-ranking.ts) — it is a read-only
        inspector, not a separate decision-making system.
      </p>
      <div className="card divide-y">
        {(services ?? []).map((s) => (
          <Link key={s.id} href={`/admin/matching/${s.id}`} className="flex items-center justify-between p-3 hover:bg-black/5 text-sm">
            <span className="font-medium">{s.name}</span>
            <span className="text-[var(--muted)]">{s.categories?.name ?? "—"}</span>
          </Link>
        ))}
        {(!services || services.length === 0) && <p className="p-4 text-sm text-[var(--muted)]">No active services.</p>}
      </div>
    </div>
  );
}

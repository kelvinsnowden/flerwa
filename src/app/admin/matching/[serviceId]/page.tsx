import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Provider, ReliabilityScore, Service } from "@/lib/types";
import { checkProviderEligibility, rankEligibleProviders } from "@/lib/provider-ranking";

/**
 * MARKETPLACE-001 Phase 6 — per-service matching inspector. Shows
 * exactly what the real customer-facing query
 * (src/app/services/[slug]/page.tsx) would return right now: the
 * eligible, ranked list with score breakdown, PLUS every other
 * provider who has this category on their profile but is excluded,
 * with the specific reason(s) — something the customer-facing page
 * itself never needs to compute or expose.
 *
 * Honesty note (see MARKETPLACE_DEMAND_INTELLIGENCE_AUDIT.md /
 * PROVIDER_MATCHING_AND_RANKING_AUDIT.md): this platform has no
 * automated-matching or manual-override mechanism at all today — a
 * customer always picks their own provider from this same list. This
 * page is a read-only mirror of that list for admin oversight, not a
 * view onto a decision log, because no such decision is made or stored
 * anywhere yet. Building the override mechanism itself is listed as
 * future work in the audit, not fabricated here.
 */
export default async function AdminMatchingServicePage({ params }: { params: Promise<{ serviceId: string }> }) {
  const { serviceId } = await params;
  const supabase = await createClient();

  const { data: service } = await supabase.from("services").select("*").eq("id", serviceId).single<Service>();
  if (!service) notFound();

  const { data: candidates } = await supabase
    .from("provider_categories")
    .select(
      "is_cleared, providers(*, reliability_scores(*), profiles:user_id(avatar_url))"
    )
    .eq("category_id", service.category_id)
    .returns<{ is_cleared: boolean; providers: (Provider & { reliability_scores: ReliabilityScore[] }) | null }[]>();

  const rows = (candidates ?? [])
    .filter((c): c is { is_cleared: boolean; providers: Provider & { reliability_scores: ReliabilityScore[] } } => !!c.providers)
    .map((c) => {
      const eligibility = checkProviderEligibility(c.providers, c.is_cleared);
      return { provider: c.providers, eligibility, reliability: c.providers.reliability_scores?.[0] };
    });

  const eligibleRows = rows.filter((r) => r.eligibility.eligible);
  const excludedRows = rows.filter((r) => !r.eligibility.eligible);

  const today = new Date().toISOString().slice(0, 10);
  const ranked = rankEligibleProviders(
    eligibleRows.map((r) => ({ provider: r.provider, reliability: r.reliability })),
    `${service.category_id}:${today}`
  );

  return (
    <div>
      <p className="text-xs text-[var(--muted)] mb-1">
        <Link href="/admin/matching" className="hover:underline">
          Matching oversight
        </Link>{" "}
        / {service.name}
      </p>
      <h1 className="text-xl font-bold mb-6">{service.name}</h1>

      <section className="mb-8">
        <h2 className="font-semibold text-sm mb-3">
          Eligible &amp; ranked ({ranked.length}) — this is exactly what a customer sees today, in order
        </h2>
        {ranked.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No eligible providers for this category. This service shows zero professionals to book right now.
          </p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)] border-b">
                  <th className="p-3">#</th>
                  <th className="p-3">Provider</th>
                  <th className="p-3">Score</th>
                  <th className="p-3">Why</th>
                </tr>
              </thead>
              <tbody>
                {ranked.map((r, i) => (
                  <tr key={r.provider.id} className={`border-b last:border-0 ${r.isExplorationSlot ? "bg-amber-50" : ""}`}>
                    <td className="p-3">{i + 1}</td>
                    <td className="p-3 font-medium">
                      <Link href={`/provider/${r.provider.slug}`} className="hover:underline">
                        {r.provider.display_name}
                      </Link>
                    </td>
                    <td className="p-3">{r.score.toFixed(0)}</td>
                    <td className="p-3 text-[var(--muted)]">{r.explanation.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-semibold text-sm mb-3">
          Excluded ({excludedRows.length}) — has this category on their profile but is not eligible
        </h2>
        {excludedRows.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">None.</p>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-[var(--muted)] border-b">
                  <th className="p-3">Provider</th>
                  <th className="p-3">Reason(s) excluded</th>
                </tr>
              </thead>
              <tbody>
                {excludedRows.map((r) => (
                  <tr key={r.provider.id} className="border-b last:border-0">
                    <td className="p-3 font-medium">
                      <Link href={`/admin/providers/${r.provider.id}`} className="hover:underline">
                        {r.provider.display_name}
                      </Link>
                    </td>
                    <td className="p-3 text-[var(--danger)]">{r.eligibility.reasons.join("; ")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <p className="mt-8 text-xs text-[var(--muted)]">
        This platform has no automated matching or manual-override mechanism yet — a customer always
        picks a provider from the eligible/ranked list above themselves. Nothing here represents a
        stored decision; it is computed fresh from the current live data on every load.
      </p>
    </div>
  );
}

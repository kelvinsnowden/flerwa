import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import type { Provider, ReliabilityScore, Service } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";

export default async function ProviderStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("*, reliability_scores(*), locations:base_location_id(ward, town)")
    .eq("slug", slug)
    .single<Provider & { reliability_scores: ReliabilityScore[]; locations: { ward: string | null; town: string } | null }>();

  if (providerError && providerError.code !== "PGRST116") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorNotice message="We couldn't load this provider's profile right now. Please refresh." />
      </div>
    );
  }
  if (!provider) notFound();

  // A provider viewing their own unpublished/unverified profile can preview
  // it; anyone else gets 404 for a non-public profile — mirrors the RLS
  // "providers public read" policy so the UI and the database agree.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isOwner = user?.id === provider.user_id;
  if (!isOwner && !(provider.is_published && provider.verification_status === "verified")) {
    notFound();
  }

  const { data: services } = await supabase
    .from("provider_services")
    .select("*, services(*)")
    .eq("provider_id", provider.id)
    .eq("is_active", true)
    .returns<{ price_minor: number | null; services: Service }[]>();

  const reliability = provider.reliability_scores?.[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      {isOwner && !(provider.is_published && provider.verification_status === "verified") && (
        <div className="mb-4 badge-warn inline-flex">Preview only — not yet public</div>
      )}
      <div className="flex items-center gap-2">
        <h1 className="text-2xl font-bold">{provider.display_name}</h1>
        {provider.verification_status === "verified" && (
          <span className="badge-trust">✓ Verified</span>
        )}
      </div>
      {provider.headline && <p className="text-[var(--muted)] mt-1">{provider.headline}</p>}
      {provider.locations && (
        <p className="text-sm text-[var(--muted)] mt-1">
          {provider.locations.ward ?? provider.locations.town}
        </p>
      )}

      <div className="mt-4 flex gap-4 text-sm">
        <span>
          <strong>{reliability?.jobs_completed ?? 0}</strong>{" "}
          <span className="text-[var(--muted)]">jobs completed</span>
        </span>
        {reliability?.avg_rating != null && (
          <span>
            <strong>★ {reliability.avg_rating.toFixed(1)}</strong>
          </span>
        )}
        {reliability?.completion_rate != null && (
          <span>
            <strong>{reliability.completion_rate}%</strong>{" "}
            <span className="text-[var(--muted)]">on-time</span>
          </span>
        )}
      </div>

      {provider.bio && <p className="mt-4 text-sm leading-relaxed">{provider.bio}</p>}

      {services && services.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Services</h2>
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <Link
                key={s.services.id}
                href={`/services/${s.services.slug}`}
                className="card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors"
              >
                <span className="font-medium">{s.services.name}</span>
                <span className="font-bold text-sm" style={{ color: "var(--trust)" }}>
                  {formatMoney(s.price_minor ?? s.services.base_price_minor, s.services.currency)}
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

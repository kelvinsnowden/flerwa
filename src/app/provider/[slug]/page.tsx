import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import type { Provider, ReliabilityScore, Service } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { Avatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { Rating } from "@/components/ui/rating";
import { Icon } from "@/components/ui/icon";
import { SaveButton } from "@/components/ui/save-button";

export default async function ProviderStorefrontPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: provider, error: providerError } = await supabase
    .from("providers")
    .select("*, reliability_scores(*), locations:base_location_id(ward, town), profiles:user_id(avatar_url)")
    .eq("slug", slug)
    .single<
      Provider & {
        reliability_scores: ReliabilityScore[];
        locations: { ward: string | null; town: string } | null;
        profiles: { avatar_url: string | null } | null;
      }
    >();

  if (providerError && providerError.code !== "PGRST116") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorNotice message="We couldn't load this professional's profile right now. Please refresh." />
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
  const isLive = provider.is_published && provider.verification_status === "verified";
  if (!isOwner && !isLive) {
    notFound();
  }

  let isSaved = false;
  if (user && !isOwner) {
    const { data: saved } = await supabase
      .from("saved_providers")
      .select("provider_id")
      .eq("customer_id", user.id)
      .eq("provider_id", provider.id)
      .maybeSingle();
    isSaved = Boolean(saved);
  }

  const { data: services } = await supabase
    .from("provider_services")
    .select("*, services(*)")
    .eq("provider_id", provider.id)
    .eq("is_active", true)
    .returns<{ price_minor: number | null; services: Service }[]>();

  const reliability = provider.reliability_scores?.[0];

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      {isOwner && !isLive && (
        <div className="mb-4 badge-warn inline-flex">Preview only — not yet public</div>
      )}

      <div className="flex items-center gap-3">
        <Avatar name={provider.display_name} photoUrl={provider.profiles?.avatar_url} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <h1 className="text-xl font-bold">{provider.display_name}</h1>
            <VerificationBadge status={provider.verification_status} />
          </div>
          {provider.headline && <p className="text-[var(--muted)] text-sm mt-0.5">{provider.headline}</p>}
          {provider.locations && (
            <p className="text-sm text-[var(--muted)] mt-0.5 flex items-center gap-1">
              <Icon name="map-pin" size={13} />
              {provider.locations.ward ?? provider.locations.town}
            </p>
          )}
        </div>
        {user && !isOwner && <SaveButton providerId={provider.id} initialSaved={isSaved} />}
      </div>

      <div className="mt-5 grid grid-cols-3 gap-3">
        <div className="stat-tile">
          <p className="text-lg font-bold">{reliability?.jobs_completed ?? 0}</p>
          <p className="text-xs text-[var(--muted)]">jobs done</p>
        </div>
        <div className="stat-tile">
          <p className="text-lg font-bold">
            {reliability?.avg_rating != null ? <Rating value={reliability.avg_rating} size="md" /> : "New"}
          </p>
          <p className="text-xs text-[var(--muted)]">rating</p>
        </div>
        <div className="stat-tile">
          <p className="text-lg font-bold">
            {reliability?.completion_rate != null ? `${reliability.completion_rate}%` : "—"}
          </p>
          <p className="text-xs text-[var(--muted)]">on-time</p>
        </div>
      </div>

      {provider.bio && <p className="mt-6 text-sm leading-relaxed">{provider.bio}</p>}

      {services && services.length > 0 && (
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Services</h2>
          <div className="flex flex-col gap-2">
            {services.map((s) => (
              <Link
                key={s.services.id}
                href={`/services/${s.services.slug}?provider=${provider.id}#book`}
                className="card card-shadow p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors"
              >
                <span className="font-medium">{s.services.name}</span>
                <span className="flex items-center gap-2">
                  <span className="font-bold text-sm" style={{ color: "var(--trust)" }}>
                    {formatMoney(s.price_minor ?? s.services.base_price_minor, s.services.currency)}
                  </span>
                  <span className="btn-primary text-xs px-3 py-1.5">Book now</span>
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

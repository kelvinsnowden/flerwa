import { notFound } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import Image from "next/image";
import type { IconName } from "@/components/ui/icon";
import type { Provider, ReliabilityScore, Service, PortfolioItem } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { Rating } from "@/components/ui/rating";
import { Icon } from "@/components/ui/icon";
import { SaveButton } from "@/components/ui/save-button";
import { MessageButton } from "@/components/ui/message-button";
import { ReadMore } from "@/components/ui/read-more";
import { HeroGallery } from "./hero-gallery";
import { StorefrontQuickNav } from "./storefront-tabs";
import { AvailabilityCalendar } from "./availability-calendar";
import { ServiceAreaVisual } from "./service-area-visual";

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

  const [
    { data: isSavedRow },
    { data: services },
    { data: reviews },
    { count: reviewCount },
    { data: portfolioItems },
    { data: serviceAreas },
    { data: scheduledServices },
    { data: responseMinutes },
  ] = await Promise.all([
    user && !isOwner
      ? supabase
          .from("saved_providers")
          .select("provider_id")
          .eq("customer_id", user.id)
          .eq("provider_id", provider.id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from("provider_services")
      .select("*, services(*, categories(name, icon))")
      .eq("provider_id", provider.id)
      .eq("is_active", true)
      .returns<{ price_minor: number | null; services: Service & { categories: { name: string; icon: string | null } | null } }[]>(),
    // reviews.reviewer_id references auth.users, not profiles (the same
    // PostgREST-embedding limitation fixed for providers/service_transactions
    // in 20260910240000 — not yet applied here), so reviewer names are
    // fetched with a second query instead of a `profiles:reviewer_id(...)`
    // embed rather than tripping the same PGRST200 class of failure.
    supabase
      .from("reviews")
      .select("id, rating, comment, tags, would_book_again, created_at, reviewer_id")
      .eq("reviewee_id", provider.user_id)
      .eq("is_customer_review", true)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("reviews")
      .select("id", { count: "exact", head: true })
      .eq("reviewee_id", provider.user_id)
      .eq("is_customer_review", true),
    supabase
      .from("provider_portfolio_items")
      .select("*")
      .eq("provider_id", provider.id)
      .order("sort_order")
      .returns<PortfolioItem[]>(),
    supabase
      .from("provider_service_areas")
      .select("locations(ward, town)")
      .eq("provider_id", provider.id)
      .returns<{ locations: { ward: string | null; town: string } | null }[]>(),
    supabase
      .from("provider_services")
      .select("services!inner(name)")
      .eq("provider_id", provider.id)
      .eq("is_active", true)
      .eq("services.scheduling_mode", "scheduled")
      .returns<{ services: { name: string } | null }[]>(),
    supabase.rpc("rpc_get_provider_response_minutes", { p_provider_id: provider.id }),
  ]);

  const isSaved = Boolean(isSavedRow);
  const hasScheduledService = (scheduledServices ?? []).length > 0;

  let reviewerNames: Record<string, string> = {};
  if (reviews && reviews.length > 0) {
    const { data: reviewers } = await supabase
      .from("profiles")
      .select("id, full_name")
      .in("id", reviews.map((r) => r.reviewer_id));
    reviewerNames = Object.fromEntries((reviewers ?? []).map((r) => [r.id, r.full_name ?? "A customer"]));
  }

  const reliability = provider.reliability_scores?.[0];
  const portfolioPhotoUrls = (portfolioItems ?? []).map((p) => p.photo_url);

  // Distinct real categories the provider's active services belong to —
  // used for the quick-chip row. No fabricated specialties: only what
  // they actually sell.
  const categoryChips = new Map<string, { name: string; icon: string | null }>();
  for (const s of services ?? []) {
    if (s.services.categories) categoryChips.set(s.services.categories.name, s.services.categories);
  }

  const memberSince = new Date(provider.created_at ?? Date.now()).toLocaleDateString("en-KE", {
    month: "short",
    year: "numeric",
  });
  const firstActiveService = services?.[0]?.services;
  const bioText = [provider.bio, provider.experience_summary].filter(Boolean).join("\n\n");

  return (
    <div className="mx-auto max-w-2xl pb-8 sm:pb-10">
      {isOwner && !isLive && (
        <div className="mx-4 mt-4 badge-warn inline-flex">Preview only — not yet public</div>
      )}

      <HeroGallery photoUrls={portfolioPhotoUrls} alt={provider.display_name} />

      <div className="px-4">
        <div className="flex items-end gap-3 -mt-8 relative">
          <span className="rounded-full border-4" style={{ borderColor: "var(--background)" }}>
            <Avatar name={provider.display_name} photoUrl={provider.profiles?.avatar_url} size="lg" />
          </span>
          <div className="flex-1" />
          {user && !isOwner && <SaveButton providerId={provider.id} initialSaved={isSaved} />}
        </div>

        <div className="mt-2 flex items-center gap-1.5">
          <h1 className="text-xl font-bold">{provider.display_name}</h1>
          <VerificationBadge status={provider.verification_status} />
        </div>
        {provider.headline && <p className="text-[var(--muted)] text-sm mt-0.5">{provider.headline}</p>}
        <div className="mt-1 flex items-center gap-3 text-sm text-[var(--muted)]">
          {reliability?.avg_rating != null ? (
            <Rating value={reliability.avg_rating} count={reviewCount ?? undefined} />
          ) : (
            <span>New professional</span>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2 text-sm">
            <Icon name="briefcase" size={16} className="text-[var(--trust)] flex-shrink-0" />
            <span>{reliability?.jobs_completed ?? 0} services completed</span>
          </div>
          {responseMinutes != null && (
            <div className="flex items-center gap-2 text-sm">
              <Icon name="clock" size={16} className="text-[var(--trust)] flex-shrink-0" />
              <span>Usually responds within {responseMinutes < 60 ? `${responseMinutes} min` : `${Math.round(responseMinutes / 60)}h`}</span>
            </div>
          )}
        </div>
        {provider.locations && (
          <p className="mt-2 flex items-center gap-2 text-sm">
            <Icon name="map-pin" size={16} className="text-[var(--trust)] flex-shrink-0" />
            {provider.locations.ward ?? provider.locations.town}
            {serviceAreas && serviceAreas.length > 0 && " (and surrounding areas)"}
          </p>
        )}

        {bioText && (
          <div className="mt-4">
            <ReadMore text={bioText} />
          </div>
        )}

        {!isOwner && (
          <div className="mt-5 flex flex-col gap-2">
            <MessageButton providerId={provider.id} isSignedIn={Boolean(user)} />
            {firstActiveService && (
              <Link href={`/services/${firstActiveService.slug}?provider=${provider.id}#book`} className="btn-secondary text-center">
                Request a Service
              </Link>
            )}
          </div>
        )}

        {categoryChips.size > 0 && (
          <div className="mt-5 grid grid-cols-4 gap-2">
            {Array.from(categoryChips.values())
              .slice(0, 4)
              .map((c) => (
                <div key={c.name} className="flex flex-col items-center gap-1.5 text-center">
                  <span
                    className="w-11 h-11 rounded-2xl flex items-center justify-center"
                    style={{ background: "var(--trust-tint)", color: "var(--trust-dark)" }}
                  >
                    <Icon name={(c.icon as IconName) ?? "grid"} size={18} />
                  </span>
                  <span className="text-[11px] font-medium leading-tight line-clamp-2">{c.name}</span>
                </div>
              ))}
          </div>
        )}
      </div>

      <div className="mt-6">
        <StorefrontQuickNav />
      </div>

      <div className="px-4">
        <div id="overview" className="pt-5 scroll-mt-28">
          <h2 className="font-semibold mb-2">About</h2>
          <ul className="flex flex-col gap-1.5 text-sm text-[var(--muted)]">
            {provider.verification_status === "verified" && (
              <li className="flex items-center gap-2">
                <Icon name="shield-check" size={14} className="text-[var(--trust)]" />
                Identity verified
              </li>
            )}
            <li className="flex items-center gap-2">
              <Icon name="clock" size={14} className="text-[var(--trust)]" />
              Member since {memberSince}
            </li>
          </ul>
        </div>

        {services && services.length > 0 && (
          <div id="services" className="pt-8 scroll-mt-28">
            <h2 className="font-semibold mb-3">My Services</h2>
            <div className="flex flex-col gap-2">
              {services.map((s) => (
                <Link
                  key={s.services.id}
                  href={`/services/${s.services.slug}?provider=${provider.id}#book`}
                  className="card card-shadow p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors"
                >
                  <div className="min-w-0">
                    <p className="font-medium">{s.services.name}</p>
                    <p className="text-xs text-[var(--muted)] truncate">{s.services.summary}</p>
                  </div>
                  <span className="flex flex-col items-end flex-shrink-0 gap-1 ml-3">
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

        <div id="portfolio" className="pt-8 scroll-mt-28">
          <h2 className="font-semibold mb-3">Portfolio</h2>
          {portfolioItems && portfolioItems.length > 0 ? (
            <div className="grid grid-cols-3 gap-2">
              {portfolioItems.map((item) => (
                <div key={item.id} className="relative aspect-square rounded-[var(--radius-sm)] overflow-hidden bg-[var(--surface)]">
                  <Image src={item.photo_url} alt={item.caption ?? ""} fill className="object-cover" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">No portfolio photos yet.</p>
          )}
        </div>

        <div id="reviews" className="pt-8 scroll-mt-28">
          <h2 className="font-semibold mb-3">Reviews{reviewCount ? ` (${reviewCount})` : ""}</h2>
          {reviews && reviews.length > 0 ? (
            <div className="flex flex-col gap-3">
              {reviews.map((r) => (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">
                      {reviewerNames[r.reviewer_id]?.split(" ")[0] ?? "A customer"}
                    </span>
                    <Rating value={r.rating} />
                  </div>
                  {r.comment && <p className="mt-2 text-sm text-[var(--muted)] leading-relaxed">{r.comment}</p>}
                  {r.tags && r.tags.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {r.tags.map((t: string) => (
                        <span key={t} className="badge-muted">{t}</span>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              illustration="/images/empty-states/empty-notifications.svg"
              title="No reviews yet"
              body="This professional's reviews will show here once services are completed and reviewed."
            />
          )}
        </div>

        {hasScheduledService && (
          <div className="pt-8">
            <h2 className="font-semibold mb-3">Availability</h2>
            <div className="card p-4">
              <AvailabilityCalendar providerId={provider.id} />
            </div>
          </div>
        )}

        {serviceAreas && serviceAreas.length > 0 && (
          <div className="pt-8">
            <h2 className="font-semibold mb-3">Service Areas</h2>
            <ServiceAreaVisual centerLabel={provider.locations?.town ?? "Kenya"} />
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {serviceAreas.map((a, i) => (
                <li key={i} className="badge-muted">
                  {a.locations?.ward ?? a.locations?.town}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-[var(--muted)]">
              Not sure if you&apos;re in this professional&apos;s area? Message them and they&apos;ll confirm.
            </p>
          </div>
        )}

        {provider.verification_status === "verified" && (
          <div className="mt-8 rounded-lg p-4 flex items-center gap-3" style={{ background: "var(--trust-tint)" }}>
            <Icon name="shield-check" size={22} className="text-[var(--trust-dark)] flex-shrink-0" />
            <div>
              <p className="font-semibold text-sm" style={{ color: "var(--trust-dark)" }}>Verified Professional</p>
              <p className="text-xs" style={{ color: "var(--trust-dark)" }}>Identity verified by Flerwa.</p>
            </div>
          </div>
        )}
      </div>

      {!isOwner && (
        <div className="mt-8 px-4 pb-4 sticky bottom-0 bg-[var(--background)] border-t pt-3 flex gap-2 sm:hidden">
          <div className="flex-1">
            <MessageButton providerId={provider.id} isSignedIn={Boolean(user)} />
          </div>
          {firstActiveService && (
            <Link href={`/services/${firstActiveService.slug}?provider=${provider.id}#book`} className="btn-primary flex-1 text-center">
              Request Service
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

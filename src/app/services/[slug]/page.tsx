import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import type { Service, ServiceScopeItem, Location, Provider, ReliabilityScore } from "@/lib/types";
import { BookingForm } from "./booking-form";
import { ErrorNotice } from "@/components/error-notice";
import { Icon } from "@/components/ui/icon";
import { ProviderCard } from "@/components/ui/provider-card";

export default async function ServiceDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ provider?: string }>;
}) {
  const { slug } = await params;
  const { provider: providerParam } = await searchParams;
  const supabase = await createClient();

  const { data: service, error: serviceError } = await supabase
    .from("services")
    .select("*")
    .eq("slug", slug)
    .eq("is_active", true)
    .single<Service>();

  if (serviceError && serviceError.code !== "PGRST116") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorNotice message="We couldn't load this service right now. Please refresh." />
      </div>
    );
  }
  if (!service) notFound();

  const [{ data: scopeItems }, { data: locations }] = await Promise.all([
    supabase
      .from("service_scope_items")
      .select("*")
      .eq("service_id", service.id)
      .order("sort_order")
      .returns<ServiceScopeItem[]>(),
    supabase.from("locations").select("*").order("ward").returns<Location[]>(),
  ]);

  // Providers cleared + verified + published FOR THIS SERVICE'S CATEGORY,
  // with their portable Reliability. The category filter matters: without
  // it every verified provider on the platform would appear on every
  // service regardless of clearance, and while rpc_book_service would
  // still correctly reject an uncleared provider server-side, showing
  // them in the picker at all is a real list-quality bug, not just
  // cosmetic. Category Competence deliberately not shown as a headline
  // number yet — see docs/06-trust-architecture.md — this MVP surfaces
  // jobs_completed and rating, the honest signals available at launch
  // volume.
  const { data: providers } = await supabase
    .from("providers")
    .select("*, reliability_scores(*), provider_categories!inner(category_id, is_cleared), profiles:user_id(avatar_url)")
    .eq("is_published", true)
    .eq("verification_status", "verified")
    .eq("is_accepting_work", true)
    .eq("provider_categories.category_id", service.category_id)
    .eq("provider_categories.is_cleared", true)
    .returns<(Provider & { reliability_scores: ReliabilityScore[]; profiles: { avatar_url: string | null } | null })[]>();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let savedProviderIds: Set<string> | null = null;
  if (user && providers && providers.length > 0) {
    const { data: saved } = await supabase
      .from("saved_providers")
      .select("provider_id")
      .eq("customer_id", user.id)
      .in("provider_id", providers.map((p) => p.id));
    savedProviderIds = new Set((saved ?? []).map((s) => s.provider_id));
  }

  const includedItems = scopeItems?.filter((s) => s.included) ?? [];
  const excludedItems = scopeItems?.filter((s) => !s.included) ?? [];

  // Only trust a ?provider= id if it's actually in the already-authorized
  // eligible list (published + verified + accepting + cleared for this
  // category) — this only pre-fills a display value, never a permission;
  // rpc_book_service independently re-checks eligibility server-side
  // regardless of what the form submits.
  const preselectedProvider = providerParam ? providers?.find((p) => p.id === providerParam) : undefined;

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-10">
      <h1 className="text-2xl font-bold">{service.name}</h1>
      <p className="mt-1 text-[var(--muted)]">{service.summary}</p>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-3xl font-bold" style={{ color: "var(--trust)" }}>
          {formatMoney(service.base_price_minor, service.currency)}
        </span>
        <span className="text-sm text-[var(--muted)] flex items-center gap-1">
          <Icon name="clock" size={14} />
          delivered within {service.turnaround_hours}h
        </span>
      </div>

      {service.description && (
        <p className="mt-4 text-sm leading-relaxed">{service.description}</p>
      )}

      {(includedItems.length > 0 || excludedItems.length > 0) && (
        <div className="mt-6 grid sm:grid-cols-2 gap-4">
          {includedItems.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-sm mb-2">What&apos;s included</h2>
              <ul className="text-sm space-y-2">
                {includedItems.map((item) => (
                  <li key={item.id} className="flex gap-2 items-start">
                    <Icon name="check" size={15} className="text-[var(--trust)] flex-shrink-0 mt-0.5" />
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {excludedItems.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-sm mb-2">Not included</h2>
              <ul className="text-sm space-y-2 text-[var(--muted)]">
                {excludedItems.map((item) => (
                  <li key={item.id} className="flex gap-2 items-start">
                    <span className="mt-0.5">✕</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {!!providers?.length && (
        <div id="providers" className="mt-8 scroll-mt-16">
          <h2 className="font-semibold mb-3">Choose a professional</h2>
          <p className="text-sm text-[var(--muted)] mb-3">
            We&apos;ve found {providers.length} verified professional{providers.length === 1 ? "" : "s"} for this service.
          </p>
          <div className="flex flex-col gap-2">
            {providers.slice(0, 4).map((p) => (
              <ProviderCard
                key={p.id}
                provider={p}
                photoUrl={p.profiles?.avatar_url}
                reliability={p.reliability_scores?.[0]}
                saved={savedProviderIds ? savedProviderIds.has(p.id) : undefined}
                selectHref={`/services/${service.slug}?provider=${p.id}#book`}
                isSignedIn={Boolean(user)}
                serviceId={service.id}
              />
            ))}
          </div>
        </div>
      )}

      <div id="book" className="mt-8 card p-5 scroll-mt-16">
        <h2 className="font-semibold mb-4">Book this service</h2>
        <BookingForm
          service={service}
          locations={locations ?? []}
          providers={providers ?? []}
          preselectedProviderId={preselectedProvider?.id}
          preselectedProviderName={preselectedProvider?.display_name}
          preselectedPhotoUrl={preselectedProvider?.profiles?.avatar_url}
        />
      </div>

      <p className="mt-4 text-xs text-[var(--muted)] flex items-center gap-1.5">
        <Icon name="shield-check" size={14} className="text-[var(--trust)]" />
        Your payment is held and only released to the professional once you approve the completed work.
      </p>
    </div>
  );
}

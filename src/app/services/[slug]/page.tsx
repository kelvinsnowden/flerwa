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
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
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
    .select("*, reliability_scores(*), provider_categories!inner(category_id, is_cleared)")
    .eq("is_published", true)
    .eq("verification_status", "verified")
    .eq("is_accepting_work", true)
    .eq("provider_categories.category_id", service.category_id)
    .eq("provider_categories.is_cleared", true)
    .returns<(Provider & { reliability_scores: ReliabilityScore[] })[]>();

  const includedItems = scopeItems?.filter((s) => s.included) ?? [];
  const excludedItems = scopeItems?.filter((s) => !s.included) ?? [];

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
        <div className="mt-8">
          <h2 className="font-semibold mb-3">Providers who offer this service</h2>
          <div className="flex flex-col gap-2">
            {providers.slice(0, 4).map((p) => (
              <ProviderCard key={p.id} provider={p} reliability={p.reliability_scores?.[0]} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-8 card p-5">
        <h2 className="font-semibold mb-4">Book this service</h2>
        <BookingForm
          service={service}
          locations={locations ?? []}
          providers={providers ?? []}
        />
      </div>

      <p className="mt-4 text-xs text-[var(--muted)] flex items-center gap-1.5">
        <Icon name="shield-check" size={14} className="text-[var(--trust)]" />
        Your payment is held and only released to the provider once you approve the completed work.
      </p>
    </div>
  );
}

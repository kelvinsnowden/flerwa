import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import type { Service, ServiceScopeItem, Location, Provider, ReliabilityScore } from "@/lib/types";
import { BookingForm } from "./booking-form";
import { ErrorNotice } from "@/components/error-notice";

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

  // Providers cleared + verified + published for this category, with their
  // portable Reliability. Category Competence deliberately not shown as a
  // headline number yet — see docs/06-trust-architecture.md — this MVP
  // surfaces jobs_completed and rating, which are the honest signals
  // available at launch volume.
  const { data: providers } = await supabase
    .from("providers")
    .select("*, reliability_scores(*)")
    .eq("is_published", true)
    .eq("verification_status", "verified")
    .eq("is_accepting_work", true)
    .returns<(Provider & { reliability_scores: ReliabilityScore[] })[]>();

  const includedItems = scopeItems?.filter((s) => s.included) ?? [];
  const excludedItems = scopeItems?.filter((s) => !s.included) ?? [];

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="text-2xl font-bold">{service.name}</h1>
      <p className="mt-1 text-[var(--muted)]">{service.summary}</p>

      <div className="mt-4 flex items-baseline gap-3">
        <span className="text-3xl font-bold" style={{ color: "var(--trust)" }}>
          {formatMoney(service.base_price_minor, service.currency)}
        </span>
        <span className="text-sm text-[var(--muted)]">
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
              <ul className="text-sm space-y-1">
                {includedItems.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span style={{ color: "var(--trust)" }}>✓</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {excludedItems.length > 0 && (
            <div className="card p-4">
              <h2 className="font-semibold text-sm mb-2">Not included</h2>
              <ul className="text-sm space-y-1 text-[var(--muted)]">
                {excludedItems.map((item) => (
                  <li key={item.id} className="flex gap-2">
                    <span>✕</span>
                    {item.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
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

      <p className="mt-4 text-xs text-[var(--muted)]">
        Your payment is confirmed by our team and held until you approve the
        completed work — see how payment protection works.
      </p>
    </div>
  );
}

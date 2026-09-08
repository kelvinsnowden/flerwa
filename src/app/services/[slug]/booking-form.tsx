"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Service, Location, Provider, ReliabilityScore } from "@/lib/types";
import { bookService } from "./actions";

export function BookingForm({
  service,
  locations,
  providers,
}: {
  service: Service;
  locations: Location[];
  providers: (Provider & { reliability_scores: ReliabilityScore[] })[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      className="flex flex-col gap-4"
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          const result = await bookService(formData);
          if (result?.error) {
            if (result.error === "Please log in to book a service.") {
              router.push(`/login?next=/services/${service.slug}`);
              return;
            }
            setError(result.error);
          }
        });
      }}
    >
      <input type="hidden" name="service_id" value={service.id} />

      {service.requires_location && (
        <label className="text-sm font-medium">
          Where
          <select name="location_id" required className="mt-1">
            <option value="">Select an area…</option>
            {locations.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.ward ? `${loc.ward}, ${loc.town}` : loc.town}
              </option>
            ))}
          </select>
        </label>
      )}

      <label className="text-sm font-medium">
        Provider
        <select name="provider_id" className="mt-1" defaultValue="">
          <option value="">Let us match you with a verified provider</option>
          {providers.map((p) => {
            const rel = p.reliability_scores?.[0];
            return (
              <option key={p.id} value={p.id}>
                {p.display_name}
                {rel?.jobs_completed ? ` — ${rel.jobs_completed} jobs completed` : " — new provider"}
              </option>
            );
          })}
        </select>
        {providers.length === 0 && (
          <span className="mt-1 block text-xs text-[var(--muted)]">
            No providers are published in this category yet — your booking
            will be assigned by our team once confirmed.
          </span>
        )}
      </label>

      <label className="text-sm font-medium">
        Preferred date
        <input type="datetime-local" name="scheduled_for" className="mt-1" />
      </label>

      <label className="text-sm font-medium">
        Contact phone
        <input
          type="tel"
          name="contact_phone"
          required
          placeholder="07XX XXX XXX"
          className="mt-1"
        />
      </label>

      <label className="text-sm font-medium">
        Anything specific we should know?
        <textarea
          name="instructions"
          rows={3}
          className="mt-1"
          placeholder="e.g. the listing link, agent's contact, access instructions…"
        />
      </label>

      {error && <p className="notice-error">{error}</p>}

      <div className="rounded-lg bg-[var(--surface)] p-3 text-xs text-[var(--muted)] flex flex-col gap-1">
        <p className="font-semibold text-[var(--foreground)]">What happens next</p>
        <p>1. We confirm your booking and reach out to arrange M-Pesa payment.</p>
        <p>2. Your payment is held until the job is done and you approve it.</p>
        <p>3. Your provider is assigned or confirmed and the job gets scheduled.</p>
      </div>

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Booking…" : "Book this service"}
      </button>
    </form>
  );
}

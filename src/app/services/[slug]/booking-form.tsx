"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Service, Location, Provider, ReliabilityScore } from "@/lib/types";
import { Avatar } from "@/components/ui/avatar";
import { Combobox } from "@/components/ui/combobox";
import { bookService } from "./actions";

export function BookingForm({
  service,
  locations,
  providers,
  preselectedProviderId,
  preselectedProviderName,
  preselectedPhotoUrl,
}: {
  service: Service;
  locations: Location[];
  providers: (Provider & { reliability_scores: ReliabilityScore[] })[];
  preselectedProviderId?: string;
  preselectedProviderName?: string;
  preselectedPhotoUrl?: string | null;
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
          <Combobox
            name="location_id"
            required
            freeText
            placeholder="Type your area or town — anywhere in Kenya…"
            options={locations.map((loc) => ({
              value: loc.id,
              label: loc.ward ? `${loc.ward}, ${loc.town}` : loc.town,
            }))}
          />
        </label>
      )}

      {preselectedProviderId && preselectedProviderName ? (
        <div>
          <span className="text-sm font-medium">Professional</span>
          <div className="mt-1 flex items-center gap-3 rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
            <Avatar name={preselectedProviderName} photoUrl={preselectedPhotoUrl} size="sm" />
            <span className="flex-1 font-medium text-sm">{preselectedProviderName}</span>
            <a href="#providers" className="text-xs font-semibold" style={{ color: "var(--trust)" }}>
              Change
            </a>
          </div>
          <input type="hidden" name="provider_id" value={preselectedProviderId} />
        </div>
      ) : (
        <label className="text-sm font-medium">
          Professional
          <select name="provider_id" className="mt-1" defaultValue="">
            <option value="">Let us match you with a verified professional</option>
            {providers.map((p) => {
              const rel = p.reliability_scores?.[0];
              return (
                <option key={p.id} value={p.id}>
                  {p.display_name}
                  {rel?.jobs_completed ? ` — ${rel.jobs_completed} jobs completed` : " — new professional"}
                </option>
              );
            })}
          </select>
          {providers.length === 0 && (
            <span className="mt-1 block text-xs text-[var(--muted)]">
              No professionals are published in this category yet — your booking
              will be assigned by our team once confirmed.
            </span>
          )}
          {providers.length > 0 && (
            <a href="#providers" className="mt-1 block text-xs font-semibold" style={{ color: "var(--trust)" }}>
              Choose a specific professional →
            </a>
          )}
        </label>
      )}

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
        <p>3. Your professional is assigned or confirmed and the job gets scheduled.</p>
      </div>

      <button type="submit" disabled={isPending} className="btn-primary">
        {isPending ? "Booking…" : "Book this service"}
      </button>
    </form>
  );
}

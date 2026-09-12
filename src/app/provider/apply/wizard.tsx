"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { Combobox } from "@/components/ui/combobox";
import { PhotoUpload } from "../photo-upload";
import { saveAboutYou, saveCategories, saveServices, saveServiceArea, submitForVerification } from "./actions";

interface ProviderRow {
  id: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  experience_summary: string | null;
  storefront_tagline: string | null;
  base_location_id: string | null;
  is_accepting_work: boolean;
  verification_status: string;
  provider_categories: { category_id: string; attributes: Record<string, string> }[];
  provider_services: { service_id: string; price_minor: number | null }[];
  provider_service_areas: { location_id: string }[];
  national_id_number: string | null;
  identity_verification_consent: boolean;
}

const STEPS = ["About you", "What you offer", "Services & pricing", "Area & availability", "Review & submit"];

export function Wizard({
  provider,
  profile,
  categories,
  services,
  locations,
}: {
  provider: ProviderRow | null;
  profile: { avatar_url: string | null; full_name: string | null } | null;
  categories: { id: string; slug: string; name: string }[];
  services: { id: string; category_id: string; name: string; base_price_minor: number; currency: string }[];
  locations: { id: string; ward: string | null; town: string }[];
}) {
  const [step, setStep] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Step 1
  const [displayName, setDisplayName] = useState(provider?.display_name ?? "");
  const [headline, setHeadline] = useState(provider?.headline ?? "");
  const [bio, setBio] = useState(provider?.bio ?? "");
  const [experienceSummary, setExperienceSummary] = useState(provider?.experience_summary ?? "");
  const [tagline, setTagline] = useState(provider?.storefront_tagline ?? "");
  const [locationId, setLocationId] = useState(provider?.base_location_id ?? "");

  // Step 2
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<string[]>(
    provider?.provider_categories.map((c) => c.category_id) ?? []
  );
  const [categoryAttrs, setCategoryAttrs] = useState<Record<string, { years_experience: string; specialties: string }>>(
    Object.fromEntries(
      (provider?.provider_categories ?? []).map((c) => [
        c.category_id,
        { years_experience: c.attributes?.years_experience ?? "", specialties: c.attributes?.specialties ?? "" },
      ])
    )
  );

  // Step 3
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>(
    provider?.provider_services.map((s) => s.service_id) ?? []
  );
  const [prices, setPrices] = useState<Record<string, string>>(
    Object.fromEntries((provider?.provider_services ?? []).map((s) => [s.service_id, s.price_minor ? String(s.price_minor / 100) : ""]))
  );

  // Step 4
  const [selectedAreaIds, setSelectedAreaIds] = useState<string[]>(
    provider?.provider_service_areas.map((a) => a.location_id) ?? []
  );
  const [isAcceptingWork, setIsAcceptingWork] = useState(provider?.is_accepting_work ?? true);

  // Step 5 — identity verification input, only meaningful once an
  // automated KYC vendor is active; see /admin/integrations and
  // docs/16-payment-verification-integrations.md.
  const [nationalIdNumber, setNationalIdNumber] = useState(provider?.national_id_number ?? "");
  const [identityConsent, setIdentityConsent] = useState(provider?.identity_verification_consent ?? false);

  const eligibleServices = services.filter((s) => selectedCategoryIds.includes(s.category_id));

  function locationLabel(id: string) {
    const l = locations.find((loc) => loc.id === id);
    return l ? (l.ward ? `${l.ward}, ${l.town}` : l.town) : "";
  }

  function toggleCategory(id: string) {
    setSelectedCategoryIds((prev) => (prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]));
    setCategoryAttrs((prev) => (prev[id] ? prev : { ...prev, [id]: { years_experience: "", specialties: "" } }));
  }

  function toggleService(id: string) {
    setSelectedServiceIds((prev) => (prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]));
  }

  function toggleArea(id: string) {
    setSelectedAreaIds((prev) => (prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id]));
  }

  function next(action: () => Promise<{ error?: string; success?: true }>) {
    setError(null);
    startTransition(async () => {
      const res = await action();
      if (res?.error) setError(res.error);
      else setStep((s) => s + 1);
    });
  }

  return (
    <div>
      <div className="flex items-center gap-1.5 mb-6">
        {STEPS.map((label, i) => (
          <div key={label} className="flex-1 flex flex-col items-center gap-1">
            <span
              className="h-1.5 w-full rounded-full"
              style={{ background: i + 1 <= step ? "var(--trust)" : "var(--border)" }}
            />
          </div>
        ))}
      </div>
      <p className="text-xs font-semibold text-[var(--muted)] mb-4">
        Step {step} of {STEPS.length} — {STEPS[step - 1]}
      </p>

      {error && <p className="notice-error mb-4">{error}</p>}

      {step === 1 && (
        <div className="card p-5 flex flex-col gap-3">
          <div className="flex justify-center mb-1">
            <PhotoUpload name={displayName || profile?.full_name || "You"} initialPhotoUrl={profile?.avatar_url ?? null} />
          </div>
          <label className="text-sm font-medium">
            Display name
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} required className="mt-1" />
          </label>
          <label className="text-sm font-medium">
            Headline
            <input
              value={headline}
              onChange={(e) => setHeadline(e.target.value)}
              placeholder="e.g. Verified Plumber · Nairobi"
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium">
            About you
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3} className="mt-1" />
          </label>
          <label className="text-sm font-medium">
            Experience & past work
            <textarea
              value={experienceSummary}
              onChange={(e) => setExperienceSummary(e.target.value)}
              rows={3}
              placeholder="Years of experience, qualifications, notable past work — this shows on your profile."
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium">
            Storefront tagline (optional)
            <input
              value={tagline}
              onChange={(e) => setTagline(e.target.value)}
              placeholder="e.g. Let's create something amazing"
              maxLength={80}
              className="mt-1"
            />
          </label>
          <label className="text-sm font-medium">
            Base location
            <Combobox
              name="location_id"
              defaultValue={locationId}
              freeText
              placeholder="Type your area or town — anywhere in Kenya…"
              onChange={setLocationId}
              options={locations.map((l) => ({ value: l.id, label: l.ward ? `${l.ward}, ${l.town}` : l.town }))}
            />
          </label>
          <button
            type="button"
            className="btn-primary mt-2"
            disabled={isPending}
            onClick={() => {
              const fd = new FormData();
              fd.set("display_name", displayName);
              fd.set("headline", headline);
              fd.set("bio", bio);
              fd.set("experience_summary", experienceSummary);
              fd.set("storefront_tagline", tagline);
              fd.set("location_id", locationId);
              next(() => saveAboutYou(fd));
            }}
          >
            {isPending ? "Saving…" : "Continue"}
          </button>
        </div>
      )}

      {step === 2 && (
        <div className="card p-5 flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">What services do you offer? Choose every category that applies.</p>
          {categories.map((c) => {
            const checked = selectedCategoryIds.includes(c.id);
            return (
              <div key={c.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <label className="flex items-center gap-2 font-medium text-sm">
                  <input type="checkbox" checked={checked} onChange={() => toggleCategory(c.id)} />
                  {c.name}
                </label>
                {checked && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <input
                      placeholder="Years of experience"
                      value={categoryAttrs[c.id]?.years_experience ?? ""}
                      onChange={(e) =>
                        setCategoryAttrs((prev) => ({
                          ...prev,
                          [c.id]: { ...prev[c.id], years_experience: e.target.value, specialties: prev[c.id]?.specialties ?? "" },
                        }))
                      }
                      className="text-sm"
                    />
                    <input
                      placeholder="Specialties (optional)"
                      value={categoryAttrs[c.id]?.specialties ?? ""}
                      onChange={(e) =>
                        setCategoryAttrs((prev) => ({
                          ...prev,
                          [c.id]: { ...prev[c.id], specialties: e.target.value, years_experience: prev[c.id]?.years_experience ?? "" },
                        }))
                      }
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex gap-2 mt-2">
            <button type="button" className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={isPending}
              onClick={() =>
                next(() =>
                  saveCategories(
                    selectedCategoryIds.map((category_id) => ({
                      category_id,
                      years_experience: categoryAttrs[category_id]?.years_experience,
                      specialties: categoryAttrs[category_id]?.specialties,
                    }))
                  )
                )
              }
            >
              {isPending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 3 && (
        <div className="card p-5 flex flex-col gap-3">
          <p className="text-sm text-[var(--muted)]">
            Choose which services you&apos;ll offer from your selected categories, and set your own price if it
            differs from the standard price.
          </p>
          {eligibleServices.length === 0 && (
            <p className="text-sm text-[var(--muted)]">No services exist yet in your chosen categories.</p>
          )}
          {eligibleServices.map((s) => {
            const checked = selectedServiceIds.includes(s.id);
            return (
              <div key={s.id} className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
                <label className="flex items-center gap-2 font-medium text-sm">
                  <input type="checkbox" checked={checked} onChange={() => toggleService(s.id)} />
                  {s.name}
                  <span className="text-xs text-[var(--muted)] ml-auto">
                    standard KSh {(s.base_price_minor / 100).toLocaleString()}
                  </span>
                </label>
                {checked && (
                  <input
                    type="number"
                    min="0"
                    placeholder={`Your price in KES (optional, default KSh ${(s.base_price_minor / 100).toLocaleString()})`}
                    value={prices[s.id] ?? ""}
                    onChange={(e) => setPrices((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    className="mt-2 text-sm"
                  />
                )}
              </div>
            );
          })}

          {/* Confirmed gap (MARKETPLACE_UX_AUDIT.md §12): the catalog above is
              fixed and admin-curated, so a real specialty (logo design,
              printing, baking, ...) may have nothing to check here — even
              when eligibleServices isn't empty, nothing in it may actually
              fit. This doesn't add that specialty to the catalog; it points
              at the existing task-request/quote flow, which already works
              for any category. Opens in a new tab so nothing on this step
              (unsaved service picks included) is lost by navigating away. */}
          <div className="rounded-[var(--radius-sm)] p-3" style={{ background: "var(--surface)" }}>
            <p className="text-sm font-semibold flex items-center gap-1.5">
              <Icon name="search" size={15} className="text-[var(--trust)]" />
              Don&apos;t see your service listed?
            </p>
            <p className="text-xs text-[var(--muted)] mt-1">
              Your specialty might not be in our catalog yet. You can still find work in the meantime by
              browsing open task requests from customers in your categories and submitting a quote for
              ones that match your skills.
            </p>
            <Link
              href="/provider/requests"
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary text-sm mt-3 inline-flex items-center gap-1.5 w-fit"
            >
              Browse task requests
              <Icon name="chevron-right" size={14} />
            </Link>
          </div>

          <div className="flex gap-2 mt-2">
            <button type="button" className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={isPending}
              onClick={() =>
                next(() =>
                  saveServices(
                    selectedServiceIds.map((service_id) => ({
                      service_id,
                      price_minor: prices[service_id] ? Math.round(Number(prices[service_id]) * 100) : null,
                    }))
                  )
                )
              }
            >
              {isPending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="card p-5 flex flex-col gap-3">
          <p className="text-sm font-medium">Areas you serve, beyond your base location</p>
          <div className="flex flex-col gap-1.5 max-h-56 overflow-y-auto">
            {locations
              .filter((l) => l.id !== locationId)
              .map((l) => (
                <label key={l.id} className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={selectedAreaIds.includes(l.id)} onChange={() => toggleArea(l.id)} />
                  {l.ward ? `${l.ward}, ${l.town}` : l.town}
                </label>
              ))}
          </div>
          <label className="flex items-center gap-2 text-sm font-medium mt-2">
            <input type="checkbox" checked={isAcceptingWork} onChange={(e) => setIsAcceptingWork(e.target.checked)} />
            I&apos;m currently available to take on work
          </label>
          <div className="flex gap-2 mt-2">
            <button type="button" className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={isPending}
              onClick={() => next(() => saveServiceArea(selectedAreaIds, isAcceptingWork))}
            >
              {isPending ? "Saving…" : "Continue"}
            </button>
          </div>
        </div>
      )}

      {step === 5 && (
        <div className="card p-5 flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <span
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: "var(--trust-tint)", color: "var(--trust)" }}
            >
              <Icon name="user" size={18} />
            </span>
            <div>
              <p className="font-semibold">{displayName}</p>
              <p className="text-xs text-[var(--muted)]">{headline || "No headline yet"}</p>
            </div>
          </div>
          {bio && <p className="text-sm">{bio}</p>}
          {experienceSummary && <p className="text-sm text-[var(--muted)]">{experienceSummary}</p>}

          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-1">Categories</p>
            <p className="text-sm">{categories.filter((c) => selectedCategoryIds.includes(c.id)).map((c) => c.name).join(", ") || "None"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-1">Services</p>
            <p className="text-sm">{services.filter((s) => selectedServiceIds.includes(s.id)).map((s) => s.name).join(", ") || "None"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-1">Base location</p>
            <p className="text-sm">{locationLabel(locationId) || "Not set"}</p>
          </div>
          <div>
            <p className="text-xs font-semibold text-[var(--muted)] mb-1">Verification</p>
            <span className="badge-warn inline-flex">Not yet submitted</span>
          </div>

          <div className="rounded-[var(--radius-sm)] border border-[var(--border)] p-3">
            <p className="text-sm font-medium mb-2">Identity verification (optional)</p>
            <p className="text-xs text-[var(--muted)] mb-2">
              If enabled, we may use this to automatically check your National ID. This never
              publishes your profile by itself — an admin still reviews and approves every
              verification.
            </p>
            <label className="text-sm font-medium">
              National ID number
              <input
                value={nationalIdNumber}
                onChange={(e) => setNationalIdNumber(e.target.value)}
                placeholder="e.g. 25219766"
                className="mt-1"
              />
            </label>
            <label className="flex items-start gap-2 text-xs mt-2">
              <input
                type="checkbox"
                checked={identityConsent}
                onChange={(e) => setIdentityConsent(e.target.checked)}
                className="mt-0.5"
              />
              <span>
                I consent to Trusted Services verifying my National ID number against official
                records for identity verification purposes.
              </span>
            </label>
          </div>

          <p className="text-xs text-[var(--muted)]">
            We&apos;ll review your information before your services become available to customers. You can keep
            editing anything above until you submit.
          </p>

          <div className="flex gap-2">
            <button type="button" className="btn-secondary" onClick={() => setStep((s) => s - 1)}>
              Back
            </button>
            <button
              type="button"
              className="btn-primary flex-1"
              disabled={isPending}
              onClick={() =>
                startTransition(async () => {
                  const res = await submitForVerification(nationalIdNumber, identityConsent);
                  if (res?.error) setError(res.error);
                })
              }
            >
              {isPending ? "Submitting…" : "Submit for verification"}
            </button>
          </div>
        </div>
      )}

      {provider && (
        <p className="mt-4 text-center">
          <Link href="/provider" className="text-xs font-semibold" style={{ color: "var(--trust)" }}>
            Skip to your dashboard →
          </Link>
        </p>
      )}
    </div>
  );
}

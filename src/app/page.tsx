import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import type { Service } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";

export default async function HomePage() {
  const supabase = await createClient();
  const { data: services, error } = await supabase
    .from("services")
    .select("*")
    .eq("is_active", true)
    .order("base_price_minor", { ascending: false })
    .returns<Service[]>();

  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:py-16">
      <section className="text-center">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight leading-tight">
          What do you need done?
        </h1>
        <p className="mt-3 text-[var(--muted)] max-w-xl mx-auto">
          Verified people in Kenya who will go, look, and tell you the truth —
          for anything you can&apos;t be there for yourself.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-2 text-sm">
          {[
            "Inspect an apartment before I pay a deposit",
            "Check on my rental property",
            "Attend a viewing on my behalf",
            "Verify goods before I pay a supplier",
          ].map((example) => (
            <span
              key={example}
              className="rounded-full border px-3 py-1.5 text-[var(--muted)]"
            >
              &ldquo;{example}&rdquo;
            </span>
          ))}
        </div>

        <div className="mt-8 flex flex-wrap justify-center gap-6 text-sm text-[var(--muted)]">
          <span className="badge-trust">Every job paid into escrow-style protected funds</span>
          <span className="badge-trust">Nobody gets paid until you confirm</span>
          <span className="badge-trust">ID-verified providers only</span>
        </div>
      </section>

      <section className="mt-14">
        <h2 className="text-lg font-semibold mb-4">Book a service</h2>
        {error && <ErrorNotice message="We couldn't load services right now. Please refresh." />}
        <div className="grid gap-3 sm:grid-cols-2">
          {!error && services?.map((service) => (
            <Link
              key={service.id}
              href={`/services/${service.slug}`}
              className="card p-4 flex flex-col gap-1 hover:border-[var(--trust)] transition-colors"
            >
              <span className="font-semibold">{service.name}</span>
              <span className="text-sm text-[var(--muted)]">{service.summary}</span>
              <div className="mt-2 flex items-center justify-between">
                <span className="font-bold" style={{ color: "var(--trust)" }}>
                  {formatMoney(service.base_price_minor, service.currency)}
                </span>
                <span className="text-xs text-[var(--muted)]">
                  {service.turnaround_hours}h turnaround
                </span>
              </div>
            </Link>
          ))}
          {!error && !services?.length && (
            <p className="text-sm text-[var(--muted)] col-span-2">
              No services published yet.
            </p>
          )}
        </div>
      </section>

      <section className="mt-10 rounded-xl border p-5 text-sm text-[var(--muted)]">
        <p>
          Have an existing arrangement with a provider you already trust?{" "}
          <Link href="/deal-desk" className="font-semibold" style={{ color: "var(--trust)" }}>
            Bring it onto the platform
          </Link>{" "}
          for protected payment and a verified record — 5% fee, nothing charged to you.
        </p>
      </section>
    </div>
  );
}

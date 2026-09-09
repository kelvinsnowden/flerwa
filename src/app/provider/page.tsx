import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { type ServiceTransaction, type Provider, type ReliabilityScore } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { Avatar } from "@/components/ui/avatar";
import { BookingCard } from "@/components/ui/booking-card";
import { EmptyState } from "@/components/ui/empty-state";

const VERIFICATION_COPY: Record<string, { label: string; tone: "warn" | "trust" }> = {
  pending: { label: "Complete your profile to submit for verification", tone: "warn" },
  submitted: { label: "Verification submitted — under review", tone: "warn" },
  under_review: { label: "Our team is reviewing your application", tone: "warn" },
  verified: { label: "Verified", tone: "trust" },
  rejected: { label: "Verification was not approved — contact support", tone: "warn" },
  expired: { label: "Verification expired — please resubmit", tone: "warn" },
};

export default async function ProviderDashboardPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider");

  const { data: provider } = await supabase
    .from("providers")
    .select("*, reliability_scores(*)")
    .eq("user_id", user.id)
    .maybeSingle<Provider & { reliability_scores: ReliabilityScore[] }>();

  if (!provider) redirect("/provider/apply");

  const { data: jobs, error: jobsError } = await supabase
    .from("service_transactions")
    .select("*, services(name)")
    .eq("provider_id", provider.id)
    .order("requested_at", { ascending: false })
    .returns<(ServiceTransaction & { services: { name: string } | null })[]>();

  const reliability = provider.reliability_scores?.[0];
  const verificationCopy = VERIFICATION_COPY[provider.verification_status];

  const activeJobs = jobs?.filter((j) => !["settled", "reviewed", "closed", "cancelled_by_customer", "cancelled_by_provider", "expired", "refunded"].includes(j.state)) ?? [];
  const pastJobs = jobs?.filter((j) => ["settled", "reviewed", "closed"].includes(j.state)) ?? [];
  const pendingEarnings = activeJobs
    .filter((j) => j.state === "funded" || j.state === "checked_in" || j.state === "in_progress" || j.state === "evidence_submitted")
    .reduce((sum, j) => sum + j.service_amount_minor, 0);
  const totalEarned = pastJobs.reduce((sum, j) => sum + j.service_amount_minor, 0);

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
      <div className="flex items-center gap-3">
        <Avatar name={provider.display_name} size="lg" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold truncate">{provider.display_name}</h1>
            <Link href={`/provider/${provider.slug}`} className="text-sm font-semibold whitespace-nowrap" style={{ color: "var(--trust)" }}>
              View storefront →
            </Link>
          </div>
          <span className={verificationCopy.tone === "trust" ? "badge-trust mt-1 inline-flex" : "badge-warn mt-1 inline-flex"}>
            {verificationCopy.label}
          </span>
        </div>
      </div>

      {jobsError && (
        <div className="mt-6">
          <ErrorNotice message="We couldn't load your jobs or earnings right now. The numbers below are not showing — this is not the same as having no active jobs. Please refresh." />
        </div>
      )}

      {!jobsError && (
        <>
          <div className="mt-6 grid grid-cols-3 gap-3">
            <Stat label="Pending" value={formatMoney(pendingEarnings)} />
            <Stat label="Earned" value={formatMoney(totalEarned)} />
            <Stat label="Reliability" value={reliability?.score != null ? `${reliability.score}` : "New"} />
          </div>

          <h2 className="mt-8 font-semibold">Active jobs</h2>
          <div className="mt-3 flex flex-col gap-2">
            {activeJobs.length === 0 && (
              <EmptyState
                illustration="/images/empty-states/empty-bookings.svg"
                title="No active jobs right now"
                body="New jobs assigned to you will show up here."
              />
            )}
            {activeJobs.map((job) => (
              <BookingCard
                key={job.id}
                href={`/provider/jobs/${job.id}`}
                title={job.services?.name ?? "Service"}
                subtitle="Tap to view details"
                state={job.state}
                amountMinor={job.service_amount_minor}
                currency={job.currency}
              />
            ))}
          </div>

          {pastJobs.length > 0 && (
            <>
              <h2 className="mt-8 font-semibold">Completed</h2>
              <div className="mt-3 flex flex-col gap-2">
                {pastJobs.map((job) => (
                  <div key={job.id} className="card p-4 flex items-center justify-between opacity-80">
                    <p className="font-semibold text-sm">{job.services?.name}</p>
                    <p className="text-sm">{formatMoney(job.service_amount_minor, job.currency)}</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat-tile">
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-[var(--muted)]">{label}</p>
    </div>
  );
}

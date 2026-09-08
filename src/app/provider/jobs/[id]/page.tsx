import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatMoney } from "@/lib/money";
import { TXN_STATE_LABELS, type ServiceTransaction } from "@/lib/types";
import { ChecklistItemRow } from "./checklist-item";
import { CheckInButton, SubmitCompletionButton } from "./job-controls";
import { ErrorNotice } from "@/components/error-notice";

export default async function ProviderJobDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/provider/jobs/${id}`);

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();
  if (!provider) redirect("/provider/apply");

  const { data: job, error: jobError } = await supabase
    .from("service_transactions")
    .select("*, services(id, name), locations(ward, town)")
    .eq("id", id)
    .eq("provider_id", provider.id) // defence in depth alongside RLS
    .single<
      ServiceTransaction & {
        services: { id: string; name: string } | null;
        locations: { ward: string | null; town: string } | null;
      }
    >();

  if (jobError && jobError.code !== "PGRST116") {
    return (
      <div className="mx-auto max-w-2xl px-4 py-10">
        <ErrorNotice message="We couldn't load this job right now. Please refresh." />
      </div>
    );
  }
  if (!job) notFound();

  const [
    { data: checklistItems, error: checklistError },
    { data: results, error: resultsError },
  ] = await Promise.all([
    supabase
      .from("service_checklist_items")
      .select("*")
      .eq("service_id", job.services?.id ?? "")
      .order("sort_order"),
    supabase
      .from("transaction_checklist_results")
      .select("checklist_item_id, is_complete")
      .eq("transaction_id", id),
  ]);
  const checklistLoadFailed = Boolean(checklistError || resultsError);

  const completedIds = new Set(
    (results ?? []).filter((r) => r.is_complete).map((r) => r.checklist_item_id)
  );

  const canCheckIn = job.state === "funded" || job.state === "scheduled";
  const canWorkChecklist = ["checked_in", "in_progress", "revision_requested"].includes(job.state);
  // Fail closed on a query error: never let "we couldn't load the checklist"
  // present as "no required items remain," which would surface the submit
  // button even though completion hasn't actually been verified.
  const requiredIncomplete =
    checklistLoadFailed ||
    (checklistItems ?? []).filter((i) => i.is_required && !completedIds.has(i.id)).length > 0;

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <p className="text-sm text-[var(--muted)]">{job.services?.name}</p>
      <h1 className="text-2xl font-bold mt-1">{TXN_STATE_LABELS[job.state]}</h1>

      <div className="mt-4 card p-4 flex flex-col gap-2 text-sm">
        <div className="flex justify-between">
          <span className="text-[var(--muted)]">Location</span>
          <span className="font-medium">
            {job.locations ? `${job.locations.ward ?? ""} ${job.locations.town}`.trim() : "—"}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="text-[var(--muted)]">You&apos;ll receive</span>
          <span className="font-medium">{formatMoney(job.service_amount_minor, job.currency)}</span>
        </div>
        {job.customer_instructions && (
          <div className="pt-2 border-t">
            <span className="text-[var(--muted)] text-xs">Customer notes</span>
            <p className="mt-1">{job.customer_instructions}</p>
          </div>
        )}
      </div>

      {canCheckIn && <CheckInButton transactionId={job.id} />}

      {canWorkChecklist && checklistLoadFailed && (
        <div className="mt-6">
          <ErrorNotice message="We couldn't load the checklist for this job. Please refresh before submitting." />
        </div>
      )}

      {canWorkChecklist && !checklistLoadFailed && checklistItems && checklistItems.length > 0 && (
        <div className="mt-6">
          <h2 className="font-semibold mb-2">Checklist</h2>
          <ul className="card divide-y px-4">
            {checklistItems.map((item) => (
              <ChecklistItemRow
                key={item.id}
                transactionId={job.id}
                item={item}
                isComplete={completedIds.has(item.id)}
              />
            ))}
          </ul>
          {!requiredIncomplete && <SubmitCompletionButton transactionId={job.id} />}
        </div>
      )}

      {canWorkChecklist && !checklistLoadFailed && (!checklistItems || checklistItems.length === 0) && (
        <div className="mt-6">
          <SubmitCompletionButton transactionId={job.id} />
        </div>
      )}
    </div>
  );
}

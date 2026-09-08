import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DealDeskForm } from "./deal-desk-form";

export default async function DealDeskPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/deal-desk");

  const { data: provider } = await supabase
    .from("providers")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <div className="mx-auto max-w-lg px-4 py-10">
      <h1 className="text-2xl font-bold">Bring your own customer</h1>
      <p className="text-sm text-[var(--muted)] mt-2">
        Already found the customer yourself? Run the job through the platform
        for protected payment, structured evidence and a verified record.
        You pay a 5% fee — the customer pays nothing extra.
      </p>

      {!provider ? (
        <div className="mt-6 card p-5">
          <p className="text-sm">
            Deal Desk is for providers. Apply as a provider first, then come
            back here.
          </p>
          <a href="/provider/apply" className="btn-primary mt-4 inline-block">
            Apply as a provider
          </a>
        </div>
      ) : (
        <div className="mt-6 card p-5">
          <DealDeskForm />
        </div>
      )}
    </div>
  );
}

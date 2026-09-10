import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Provider, ReliabilityScore } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { ProviderCard } from "@/components/ui/provider-card";

export default async function SavedProvidersPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account/saved");

  const { data: saved, error } = await supabase
    .from("saved_providers")
    .select("created_at, providers(*, reliability_scores(*), profiles:user_id(avatar_url))")
    .eq("customer_id", user.id)
    .order("created_at", { ascending: false })
    .returns<
      {
        created_at: string;
        providers: (Provider & { reliability_scores: ReliabilityScore[]; profiles: { avatar_url: string | null } | null }) | null;
      }[]
    >();

  return (
    <div className="mx-auto max-w-2xl px-4 py-8 pb-4">
      <h1 className="text-2xl font-bold mb-6">Saved Pros</h1>

      {error && (
        <ErrorNotice message="We couldn't load your saved pros right now. Please refresh — this does not mean you have none saved." />
      )}

      {!error && !saved?.length && (
        <EmptyState
          illustration="/images/empty-states/empty-saved.svg"
          title="No saved Pros yet"
          body="Tap the heart on a pro's profile to keep them here for later."
          action={
            <Link href="/" className="btn-primary">
              Browse services
            </Link>
          }
        />
      )}

      <div className="flex flex-col gap-3">
        {!error &&
          saved
            ?.filter((s) => s.providers)
            .map((s) => (
              <ProviderCard
                key={s.providers!.id}
                provider={s.providers!}
                photoUrl={s.providers!.profiles?.avatar_url}
                reliability={s.providers!.reliability_scores?.[0]}
                saved
              />
            ))}
      </div>
    </div>
  );
}

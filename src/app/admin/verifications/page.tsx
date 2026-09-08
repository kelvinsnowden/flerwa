import { createClient } from "@/lib/supabase/server";
import type { Provider } from "@/lib/types";
import { VerificationCard } from "./verification-card";
import { ErrorNotice } from "@/components/error-notice";

export default async function AdminVerificationsPage() {
  const supabase = await createClient();

  const { data: providers, error } = await supabase
    .from("providers")
    .select("*, provider_verifications(*), provider_categories(*, categories(name))")
    .in("verification_status", ["submitted", "under_review", "pending"])
    .order("created_at")
    .returns<
      (Provider & {
        provider_verifications: { id: string; kind: string; storage_path: string | null; status: string }[];
        provider_categories: { category_id: string; is_cleared: boolean; categories: { name: string } }[];
      })[]
    >();

  if (error) {
    return (
      <div>
        <h1 className="text-xl font-bold mb-6">Verification queue</h1>
        <ErrorNotice message="We couldn't load the verification queue. Please refresh — this is not the same as there being nothing awaiting verification." />
      </div>
    );
  }

  const { data: categories } = await supabase.from("categories").select("id, name").eq("is_active", true);

  // Signed URLs for private KYC documents, generated server-side only.
  const withDocUrls = await Promise.all(
    (providers ?? []).map(async (p) => {
      const docs = await Promise.all(
        p.provider_verifications.map(async (v) => {
          if (!v.storage_path) return { ...v, url: null };
          const { data } = await supabase.storage
            .from("provider-documents")
            .createSignedUrl(v.storage_path, 60 * 10);
          return { ...v, url: data?.signedUrl ?? null };
        })
      );
      return { ...p, docs };
    })
  );

  return (
    <div>
      <h1 className="text-xl font-bold mb-6">Verification queue</h1>
      {withDocUrls.length === 0 && (
        <p className="text-sm text-[var(--muted)]">No providers awaiting verification.</p>
      )}
      <div className="flex flex-col gap-4">
        {withDocUrls.map((provider) => (
          <VerificationCard
            key={provider.id}
            provider={provider}
            categories={categories ?? []}
          />
        ))}
      </div>
    </div>
  );
}

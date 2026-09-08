import { createClient } from "@/lib/supabase/server";
import { ErrorNotice } from "@/components/error-notice";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";

interface EvidenceRow {
  id: string;
  type: string;
  storage_path: string | null;
  description: string | null;
  captured_in_app: boolean;
  created_at: string;
}

export async function EvidenceGallery({ transactionId }: { transactionId: string }) {
  const supabase = await createClient();
  const { data: evidence, error } = await supabase
    .from("transaction_evidence")
    .select("*")
    .eq("transaction_id", transactionId)
    .order("created_at")
    .returns<EvidenceRow[]>();

  if (error) {
    return <ErrorNotice message="We couldn't load the evidence for this job. Please refresh — this does not mean no evidence was submitted." />;
  }

  if (!evidence?.length) {
    return (
      <EmptyState
        icon={<Icon name="camera" size={20} />}
        title="No evidence yet"
        body="Evidence will appear here once the provider starts the job."
      />
    );
  }

  // Signed URLs generated server-side, short-lived. RLS on storage.objects
  // (see supabase/migrations/20260908135437_storage_buckets.sql) independently
  // enforces that only participants can reach this bucket even if a URL leaked.
  const withUrls = await Promise.all(
    evidence.map(async (item) => {
      if (!item.storage_path) return { ...item, url: null };
      const { data } = await supabase.storage
        .from("transaction-evidence")
        .createSignedUrl(item.storage_path, 60 * 10);
      return { ...item, url: data?.signedUrl ?? null };
    })
  );

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
      {withUrls.map((item) => (
        <div key={item.id} className="card card-shadow overflow-hidden">
          {item.url && item.type === "photo" && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.url} alt={item.description ?? "Evidence"} className="w-full h-28 object-cover" />
          )}
          {item.url && item.type === "video" && (
            <video src={item.url} controls className="w-full h-28 object-cover" />
          )}
          {item.url && item.type !== "photo" && item.type !== "video" && (
            <a href={item.url} target="_blank" rel="noreferrer" className="block p-3 text-xs" style={{ color: "var(--trust)" }}>
              View {item.type}
            </a>
          )}
          {item.description && (
            <p className="text-xs text-[var(--muted)] px-2 py-1.5">{item.description}</p>
          )}
        </div>
      ))}
    </div>
  );
}

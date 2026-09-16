"use server";

import { createClient } from "@/lib/supabase/server";

export interface DrawerDocument {
  id: string;
  kind: string;
  status: string;
  url: string | null;
}

export interface DrawerActivityEntry {
  id: string;
  action: string;
  payload: Record<string, unknown>;
  created_at: string;
  admin_name: string | null;
}

export interface DrawerDetail {
  documents: DrawerDocument[];
  checks: { provider_key: string; check_type: string; status: string; created_at: string }[];
  activity: DrawerActivityEntry[];
}

/**
 * Loaded on demand when the drawer opens (section 15: don't fetch every
 * provider's documents/activity upfront) rather than in the table's own
 * page query. Signed URLs for private KYC documents are generated
 * server-side only, same as the previous verification queue page did.
 */
export async function getVerificationDrawerDetail(providerId: string): Promise<DrawerDetail | { error: string }> {
  const supabase = await createClient();

  const [{ data: docs, error: docsError }, { data: checks }, { data: actions }] = await Promise.all([
    supabase.from("provider_verifications").select("id, kind, status, storage_path").eq("provider_id", providerId),
    supabase
      .from("identity_verification_checks")
      .select("provider_key, check_type, status, created_at")
      .eq("provider_id", providerId)
      .order("created_at", { ascending: false }),
    supabase
      .from("admin_actions")
      .select("id, action, payload, created_at, admin_id, profiles:admin_id(full_name)")
      .eq("target_table", "providers")
      .eq("target_id", providerId)
      .order("created_at", { ascending: false })
      .limit(20)
      .returns<{ id: string; action: string; payload: Record<string, unknown>; created_at: string; admin_id: string; profiles: { full_name: string | null } | null }[]>(),
  ]);

  if (docsError) return { error: docsError.message };

  const documents = await Promise.all(
    (docs ?? []).map(async (d): Promise<DrawerDocument> => {
      if (!d.storage_path) return { id: d.id, kind: d.kind, status: d.status, url: null };
      const { data } = await supabase.storage.from("provider-documents").createSignedUrl(d.storage_path, 60 * 10);
      return { id: d.id, kind: d.kind, status: d.status, url: data?.signedUrl ?? null };
    })
  );

  const activity: DrawerActivityEntry[] = (actions ?? []).map((a) => ({
    id: a.id,
    action: a.action,
    payload: a.payload,
    created_at: a.created_at,
    admin_name: a.profiles?.full_name ?? null,
  }));

  return { documents, checks: checks ?? [], activity };
}

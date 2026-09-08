import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

/**
 * Server-side admin guard. This is defence in depth, not the security
 * boundary — the real boundary is RLS ("is_admin()") and the rpc_*
 * functions' internal checks. A non-admin hitting any /admin/* route
 * is redirected here before any admin page even queries data, so a
 * bug in one admin page's own logic can't accidentally expose the UI.
 */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/admin");

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).single();
  if (profile?.role !== "admin") redirect("/");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <nav className="flex gap-4 text-sm border-b pb-4 mb-6">
        <Link href="/admin" className="font-semibold">Overview</Link>
        <Link href="/admin/verifications" className="text-[var(--muted)] hover:text-[var(--foreground)]">Verifications</Link>
        <Link href="/admin/payments" className="text-[var(--muted)] hover:text-[var(--foreground)]">Payments</Link>
        <Link href="/admin/transactions" className="text-[var(--muted)] hover:text-[var(--foreground)]">Transactions</Link>
      </nav>
      {children}
    </div>
  );
}

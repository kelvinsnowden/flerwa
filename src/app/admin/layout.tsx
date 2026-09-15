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
        <Link href="/admin/providers" className="text-[var(--muted)] hover:text-[var(--foreground)]">Providers</Link>
        <Link href="/admin/customers" className="text-[var(--muted)] hover:text-[var(--foreground)]">Customers</Link>
        <Link href="/admin/payments" className="text-[var(--muted)] hover:text-[var(--foreground)]">Payments</Link>
        <Link href="/admin/ledger" className="text-[var(--muted)] hover:text-[var(--foreground)]">Ledger</Link>
        <Link href="/admin/system" className="text-[var(--muted)] hover:text-[var(--foreground)]">System</Link>
        <Link href="/admin/reviews" className="text-[var(--muted)] hover:text-[var(--foreground)]">Reviews</Link>
        <Link href="/admin/transactions" className="text-[var(--muted)] hover:text-[var(--foreground)]">Transactions</Link>
        <Link href="/admin/disputes" className="text-[var(--muted)] hover:text-[var(--foreground)]">Disputes</Link>
        <Link href="/admin/moderation" className="text-[var(--muted)] hover:text-[var(--foreground)]">Moderation</Link>
        <Link href="/admin/support" className="text-[var(--muted)] hover:text-[var(--foreground)]">Support</Link>
        <Link href="/admin/deal-desk" className="text-[var(--muted)] hover:text-[var(--foreground)]">Deal Desk</Link>
        <Link href="/admin/integrations" className="text-[var(--muted)] hover:text-[var(--foreground)]">Integrations</Link>
        <Link href="/admin/categories" className="text-[var(--muted)] hover:text-[var(--foreground)]">Categories</Link>
        <Link href="/admin/audit-log" className="text-[var(--muted)] hover:text-[var(--foreground)]">Audit Log</Link>
        <Link href="/admin/approvals" className="text-[var(--muted)] hover:text-[var(--foreground)]">Approvals</Link>
        <Link href="/admin/roles" className="text-[var(--muted)] hover:text-[var(--foreground)]">Roles</Link>
      </nav>
      {children}
    </div>
  );
}

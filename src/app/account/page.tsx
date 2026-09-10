import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { Avatar } from "@/components/ui/avatar";
import { VerificationBadge } from "@/components/ui/verification-badge";
import { Icon } from "@/components/ui/icon";
import { SignOutButton } from "@/components/sign-out-button";
import { ProfileForm } from "./profile-form";
import type { UserRole, VerificationStatus } from "@/lib/types";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/account");

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name, phone, email, role")
    .eq("id", user.id)
    .single<{ full_name: string | null; phone: string | null; email: string | null; role: UserRole }>();

  const { data: provider } = await supabase
    .from("providers")
    .select("slug, verification_status")
    .eq("user_id", user.id)
    .maybeSingle<{ slug: string; verification_status: VerificationStatus }>();

  const displayName = profile?.full_name || profile?.email || "Your account";

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <div className="flex items-center gap-3">
        <Avatar name={displayName} size="lg" />
        <div>
          <h1 className="text-xl font-bold">{displayName}</h1>
          <p className="text-sm text-[var(--muted)]">{profile?.email}</p>
        </div>
      </div>

      <div className="mt-6 flex flex-col gap-2">
        {provider && (
          <Link href="/provider" className="card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors">
            <span className="flex items-center gap-2 font-medium">
              <Icon name="wallet" size={18} className="text-[var(--trust)]" />
              Provider dashboard
              <VerificationBadge status={provider.verification_status} />
            </span>
            <Icon name="chevron-right" size={18} className="text-[var(--muted)]" />
          </Link>
        )}
        {!provider && (
          <Link href="/provider/apply" className="card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors">
            <span className="flex items-center gap-2 font-medium">
              <Icon name="wallet" size={18} className="text-[var(--trust)]" />
              Become a provider
            </span>
            <Icon name="chevron-right" size={18} className="text-[var(--muted)]" />
          </Link>
        )}
        <Link href="/account/saved" className="card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors">
          <span className="flex items-center gap-2 font-medium">
            <Icon name="heart" size={18} className="text-[var(--trust)]" />
            Saved providers
          </span>
          <Icon name="chevron-right" size={18} className="text-[var(--muted)]" />
        </Link>
        <Link href="/notifications" className="card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors">
          <span className="flex items-center gap-2 font-medium">
            <Icon name="bell" size={18} className="text-[var(--trust)]" />
            Updates
          </span>
          <Icon name="chevron-right" size={18} className="text-[var(--muted)]" />
        </Link>
        <Link href="/deal-desk" className="card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors">
          <span className="flex items-center gap-2 font-medium">
            <Icon name="file-text" size={18} className="text-[var(--trust)]" />
            Bring your own customer
          </span>
          <Icon name="chevron-right" size={18} className="text-[var(--muted)]" />
        </Link>
        {profile?.role === "admin" && (
          <Link href="/admin" className="card p-4 flex items-center justify-between hover:border-[var(--trust)] transition-colors">
            <span className="flex items-center gap-2 font-medium">
              <Icon name="shield-check" size={18} className="text-[var(--trust)]" />
              Admin console
            </span>
            <Icon name="chevron-right" size={18} className="text-[var(--muted)]" />
          </Link>
        )}
      </div>

      <div className="mt-8">
        <h2 className="font-semibold mb-3">Your details</h2>
        <div className="card p-4">
          <ProfileForm fullName={profile?.full_name ?? null} phone={profile?.phone ?? null} />
        </div>
      </div>

      <div className="mt-8">
        <SignOutButton className="btn-secondary w-full" />
      </div>
    </div>
  );
}

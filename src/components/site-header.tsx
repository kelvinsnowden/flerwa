import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { SignOutButton } from "@/components/sign-out-button";

export async function SiteHeader() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role ?? null;
  }

  return (
    <header className="sticky top-0 z-40 border-b bg-[var(--card)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="font-bold text-lg tracking-tight">
          Trusted<span style={{ color: "var(--trust)" }}>Services</span>
        </Link>
        <nav className="flex items-center gap-3 text-sm">
          {!user && (
            <>
              <Link href="/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                Log in
              </Link>
              <Link href="/signup" className="btn-primary text-sm">
                Sign up
              </Link>
            </>
          )}
          {user && (
            <>
              <Link href="/account/bookings" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                My bookings
              </Link>
              {role === "provider" && (
                <Link href="/provider" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                  Provider
                </Link>
              )}
              {role !== "provider" && (
                <Link href="/provider/apply" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                  Become a provider
                </Link>
              )}
              {role === "admin" && (
                <Link href="/admin" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                  Admin
                </Link>
              )}
              <SignOutButton />
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

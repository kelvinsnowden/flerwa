import Link from "next/link";
import { SignOutButton } from "@/components/sign-out-button";
import type { UserRole } from "@/lib/types";

/**
 * Slim top bar. For anonymous visitors it's branding + auth CTAs. For
 * signed-in users the primary navigation lives in the bottom tab bar on
 * mobile (see BottomNav); this header additionally renders the same
 * destinations as a desktop-only inline nav so the product doesn't lose
 * navigation entirely above the `sm` breakpoint where the tab bar is hidden.
 */
export function SiteHeader({ role, isSeller }: { role: UserRole | "anonymous"; isSeller?: boolean }) {
  const signedIn = role !== "anonymous";
  return (
    <header className="sticky top-0 z-40 border-b bg-[var(--card)]/95 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight">
          <span
            className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs"
            style={{ background: "var(--trust)" }}
          >
            ✓
          </span>
          Trusted<span style={{ color: "var(--trust)" }}>Services</span>
        </Link>

        {!signedIn && (
          <nav className="flex items-center gap-3 text-sm">
            <Link href="/login" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Log in
            </Link>
            <Link href="/signup" className="btn-primary text-sm">
              Sign up
            </Link>
          </nav>
        )}

        {signedIn && (
          <nav className="hidden sm:flex items-center gap-4 text-sm">
            <Link href="/" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Home
            </Link>
            <Link
              href={isSeller ? "/provider" : "/account/bookings"}
              className="text-[var(--muted)] hover:text-[var(--foreground)]"
            >
              Bookings
            </Link>
            <Link href="/messages" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Messages
            </Link>
            <Link href="/notifications" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Updates
            </Link>
            {role === "admin" && (
              <Link href="/admin" className="text-[var(--muted)] hover:text-[var(--foreground)]">
                Admin
              </Link>
            )}
            <Link href="/account" className="text-[var(--muted)] hover:text-[var(--foreground)]">
              Profile
            </Link>
            <SignOutButton />
          </nav>
        )}
      </div>
    </header>
  );
}

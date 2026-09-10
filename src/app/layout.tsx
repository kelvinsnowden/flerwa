import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/ui/bottom-nav";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

// Full-bleed screens that render their own AuthHeader per the reference
// mockups — showing SiteHeader on top would double up on branding/nav.
const NO_CHROME_PREFIXES = ["/login", "/signup", "/onboarding"];

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trusted Services | Know before you pay",
  description:
    "Verified people in Kenya who will go, look, and tell you the truth — for anything you can't be there for. Money held safely until the job is done.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const requestHeaders = await headers();
  const pathname = requestHeaders.get("x-pathname") ?? "";
  const showChrome = !NO_CHROME_PREFIXES.some((p) => pathname.startsWith(p));

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | "anonymous" = "anonymous";
  let unreadCount = 0;
  let isSeller = false;
  if (user) {
    const [{ data: profile }, { count }, { data: provider }] = await Promise.all([
      supabase.from("profiles").select("role, intent").eq("id", user.id).single<{ role: UserRole; intent: string | null }>(),
      // RLS ("messages participants read") already scopes this to threads
      // the signed-in user is actually part of — no transaction_id filter
      // needed here, unlike a direct table probe.
      supabase
        .from("messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .is("read_at", null),
      // Whether this user is a seller has always meant "do they have a
      // providers row" — profiles.role is never actually set to
      // 'provider' anywhere in this app. See MARKETPLACE_UX_AUDIT.md.
      supabase.from("providers").select("id").eq("user_id", user.id).maybeSingle(),
    ]);
    role = profile?.role ?? "customer";
    unreadCount = count ?? 0;
    isSeller = !!provider;

    // First-run: ask once what they came to do. Purely a preference
    // (see profiles.intent's own comment) — never blocks access, and
    // never re-fires once set.
    if (profile && profile.intent === null && role !== "admin" && pathname !== "/onboarding") {
      redirect("/onboarding");
    }
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-dvh flex-col">
          {showChrome && <SiteHeader role={role} isSeller={isSeller} />}
          <main className="flex-1">{children}</main>
          {showChrome && role !== "anonymous" && (
            <div className="sm:hidden">
              <BottomNav role={role} isSeller={isSeller} unreadCount={unreadCount} />
            </div>
          )}
        </div>
      </body>
    </html>
  );
}

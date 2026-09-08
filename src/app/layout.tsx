import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { SiteHeader } from "@/components/site-header";
import { BottomNav } from "@/components/ui/bottom-nav";
import { createClient } from "@/lib/supabase/server";
import type { UserRole } from "@/lib/types";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Trusted Services | Know before you pay",
  description:
    "Verified people in Kenya who will go, look, and tell you the truth — for anything you can't be there for. Money held safely until the job is done.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: UserRole | "anonymous" = "anonymous";
  let unreadCount = 0;
  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("role").eq("id", user.id).single<{ role: UserRole }>(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
    role = profile?.role ?? "customer";
    unreadCount = count ?? 0;
  }

  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="flex min-h-dvh flex-col">
          <SiteHeader role={role} />
          <main className="flex-1">{children}</main>
          {role !== "anonymous" && (
            <div className="sm:hidden">
              <BottomNav role={role} unreadCount={unreadCount} />
            </div>
          )}
        </div>
      </body>
    </html>
  );
}

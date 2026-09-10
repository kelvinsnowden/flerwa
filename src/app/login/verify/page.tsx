import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { AuthHeader } from "@/components/auth-header";
import { AuthSkylineFooter } from "@/components/auth-skyline-footer";
import { formatKenyanPhoneDisplay } from "@/lib/phone";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; next?: string }>;
}) {
  const { phone, next } = await searchParams;
  if (!phone) redirect("/login");
  const backHref = `/login${next ? `?next=${encodeURIComponent(next)}` : ""}`;

  return (
    <div className="mx-auto max-w-sm px-4 py-12 flex flex-col min-h-dvh">
      <AuthHeader backHref={backHref} showHelp />

      <h1 className="text-xl font-bold text-center">Check your phone</h1>
      <p className="text-sm text-[var(--muted)] mt-1 text-center">
        We&apos;ve sent a 6-digit code to{" "}
        <span className="font-semibold text-[var(--foreground)]">{formatKenyanPhoneDisplay(phone)}</span>
      </p>

      <div className="mt-6">
        <VerifyForm phone={phone} next={next} />
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-[var(--muted)] bg-[var(--trust-tint)] rounded-lg p-3">
        <Icon name="shield-check" size={16} className="text-[var(--trust)] flex-shrink-0 mt-0.5" />
        <span>
          <span className="block font-medium text-[var(--foreground)]">Your security matters</span>
          This code will expire in 10 minutes.
        </span>
      </p>

      <AuthSkylineFooter activeDot={0} />
    </div>
  );
}

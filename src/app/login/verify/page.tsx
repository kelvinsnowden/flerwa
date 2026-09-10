import { redirect } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { AuthHeader } from "@/components/auth-header";
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
    <div className="mx-auto max-w-sm px-4 py-12">
      <AuthHeader backHref={backHref} />

      <h1 className="text-xl font-bold text-center">Enter the 6-digit code</h1>
      <p className="text-sm text-[var(--muted)] mt-1 text-center">
        We&apos;ve sent a code to{" "}
        <span className="font-semibold text-[var(--foreground)]">{formatKenyanPhoneDisplay(phone)}</span>
      </p>

      <div className="mt-6">
        <VerifyForm phone={phone} next={next} />
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-[var(--muted)] bg-[var(--trust-tint)] rounded-lg p-3">
        <Icon name="shield-check" size={16} className="text-[var(--trust)] flex-shrink-0 mt-0.5" />
        <span>
          <span className="block font-medium text-[var(--foreground)]">Tip</span>
          The code usually arrives within a few seconds. Check your SMS messages.
        </span>
      </p>
    </div>
  );
}

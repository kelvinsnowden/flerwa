import { redirect } from "next/navigation";
import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { formatKenyanPhoneDisplay } from "@/lib/phone";
import { VerifyForm } from "./verify-form";

export default async function VerifyPage({
  searchParams,
}: {
  searchParams: Promise<{ phone?: string; next?: string }>;
}) {
  const { phone, next } = await searchParams;
  if (!phone) redirect("/login");

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Link
        href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
        className="text-sm text-[var(--muted)] flex items-center gap-1 mb-6"
      >
        <Icon name="chevron-right" size={14} className="rotate-180" />
        Back
      </Link>

      <h1 className="text-2xl font-bold">Check your phone</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        We&apos;ve sent a 6-digit code to{" "}
        <span className="font-semibold text-[var(--foreground)]">{formatKenyanPhoneDisplay(phone)}</span>
      </p>

      <div className="mt-6">
        <VerifyForm phone={phone} next={next} />
      </div>

      <p className="mt-6 flex items-start gap-2 text-xs text-[var(--muted)] bg-[var(--trust-tint)] rounded-lg p-3">
        <Icon name="shield-check" size={16} className="text-[var(--trust)] flex-shrink-0 mt-0.5" />
        Your security matters. This code expires after a few minutes.
      </p>
    </div>
  );
}

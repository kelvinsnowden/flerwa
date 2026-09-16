import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Icon } from "@/components/ui/icon";
import type { Payout } from "@/lib/types";
import { PayoutPhoneForm } from "./payout-phone-form";
import { WithdrawForm } from "./withdraw-form";
import { PayoutHistory } from "./payout-history";
import { formatMoney } from "@/lib/money";

export default async function ProviderPayoutsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/provider/payouts");

  const { data: provider } = await supabase.from("providers").select("id, payout_phone").eq("user_id", user.id).maybeSingle();
  if (!provider) redirect("/provider/apply");

  const [{ data: balanceMinor }, { data: payouts }] = await Promise.all([
    supabase.rpc("rpc_get_my_wallet_balance"),
    supabase.from("payouts").select("*").eq("provider_id", provider.id).order("created_at", { ascending: false }).returns<Payout[]>(),
  ]);

  return (
    <div className="mx-auto max-w-lg px-4 py-8 pb-4">
      <Link href="/provider" className="text-sm text-[var(--muted)] flex items-center gap-1 mb-4">
        <Icon name="chevron-right" size={14} className="rotate-180" />
        Back to dashboard
      </Link>
      <h1 className="text-2xl font-bold mb-1">Payouts</h1>
      <p className="text-sm text-[var(--muted)] mb-6">
        Money from approved work collects here. Withdraw whenever you want — sent automatically
        once an automated payout method is connected, otherwise our team sends it by hand and it
        still shows up here.
      </p>

      <div className="card p-4 mb-4">
        <p className="text-xs font-semibold text-[var(--muted)] mb-1">Available balance</p>
        <p className="text-2xl font-bold">{formatMoney(balanceMinor ?? 0, "KES")}</p>
      </div>

      <PayoutPhoneForm currentPhone={provider.payout_phone} />

      <div className="mt-4">
        <WithdrawForm availableMinor={balanceMinor ?? 0} hasPayoutPhone={!!provider.payout_phone} />
      </div>

      <h2 className="text-sm font-semibold mt-8 mb-3">History</h2>
      <PayoutHistory payouts={payouts ?? []} />
    </div>
  );
}

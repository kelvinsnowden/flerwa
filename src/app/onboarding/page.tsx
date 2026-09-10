import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AuthHeader } from "@/components/auth-header";
import { OnboardingForm } from "./onboarding-form";

export default async function OnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/onboarding");

  return (
    <div className="mx-auto max-w-sm px-4 py-12 flex flex-col min-h-dvh">
      <AuthHeader />
      <h1 className="text-2xl font-bold text-center">Welcome to Trusted Services</h1>
      <p className="text-sm text-[var(--muted)] mt-1 text-center">What would you like to do?</p>
      <div className="mt-6">
        <OnboardingForm />
      </div>
    </div>
  );
}

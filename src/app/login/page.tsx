import { AuthHeader } from "@/components/auth-header";
import { AuthSkylineFooter } from "@/components/auth-skyline-footer";
import { PhoneForm } from "./phone-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-12 flex flex-col min-h-[calc(100dvh-56px)]">
      <AuthHeader />
      <h1 className="text-xl font-bold text-center">Log in with your phone number</h1>
      <p className="text-sm text-[var(--muted)] mt-1 text-center">
        We&apos;ll send you a one-time passcode (OTP) to verify your number.
      </p>
      <div className="mt-6">
        <PhoneForm next={next} />
      </div>
      <AuthSkylineFooter />
    </div>
  );
}

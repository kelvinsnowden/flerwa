import Image from "next/image";
import { PhoneForm } from "./phone-form";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <Image
        src="/images/illustrations/kenya-gets-things-done.svg"
        alt=""
        width={280}
        height={210}
        className="w-full max-w-[280px] mx-auto sm:mx-0 mb-6"
        priority
      />
      <h1 className="text-2xl font-bold">Enter your phone number</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        We&apos;ll send you a one-time passcode (OTP) to verify your number.
      </p>
      <div className="mt-6">
        <PhoneForm next={next} />
      </div>
    </div>
  );
}

import Image from "next/image";
import Link from "next/link";
import { AuthHeader } from "@/components/auth-header";

/**
 * The step signup previously skipped entirely: when Supabase requires
 * email confirmation, signUp() creates the user but returns no session —
 * the old code redirected straight to the homepage still logged out, with
 * no indication anything had happened. Found by an actual signup during a
 * live audit: a brand new user had no way to know they needed to check
 * their email at all.
 */
export default async function CheckEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string }>;
}) {
  const { email } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <AuthHeader />
      <div className="flex flex-col items-center text-center">
        <Image src="/images/success/success-verification.svg" alt="" width={96} height={96} />
        <h1 className="text-2xl font-bold mt-4">Check your email</h1>
        <p className="text-sm text-[var(--muted)] mt-2">
          {email ? (
            <>
              We&apos;ve sent a confirmation link to <strong className="text-[var(--foreground)]">{email}</strong>.
            </>
          ) : (
            "We've sent a confirmation link to your email address."
          )}{" "}
          Open it to activate your account, then come back and log in.
        </p>
        <Link href="/login/email" className="btn-primary w-full mt-6">
          I&apos;ve confirmed — log in
        </Link>
        <Link href="/" className="btn-secondary w-full mt-2">
          Back to home
        </Link>
        <p className="text-xs text-[var(--muted)] mt-6">
          Didn&apos;t get it? Check your spam folder, or{" "}
          <Link href="/signup" className="font-semibold" style={{ color: "var(--trust)" }}>
            try signing up again
          </Link>
          .
        </p>
      </div>
    </div>
  );
}

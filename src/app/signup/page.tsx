import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthHeader } from "@/components/auth-header";
import { signup } from "../login/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <AuthHeader
        backHref={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`}
        backLabel="Use phone number instead"
      />
      <h1 className="text-2xl font-bold">Create your account</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        Already have one?{" "}
        <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold" style={{ color: "var(--trust)" }}>
          Log in
        </Link>
      </p>
      <AuthForm action={signup} submitLabel="Create account" showName next={next} className="mt-6" />
    </div>
  );
}

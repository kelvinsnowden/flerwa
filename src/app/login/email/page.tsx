import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { AuthHeader } from "@/components/auth-header";
import { login } from "../actions";

export default async function LoginEmailPage({
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
      <h1 className="text-2xl font-bold">Log in with email</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        New here?{" "}
        <Link href={`/signup${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="font-semibold" style={{ color: "var(--trust)" }}>
          Create an account
        </Link>
      </p>
      <AuthForm action={login} submitLabel="Log in" next={next} className="mt-6" />
    </div>
  );
}

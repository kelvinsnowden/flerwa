import Link from "next/link";
import Image from "next/image";
import { AuthForm } from "@/components/auth-form";
import { login } from "./actions";

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
      <h1 className="text-2xl font-bold">Welcome back</h1>
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

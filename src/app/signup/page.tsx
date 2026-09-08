import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { Icon } from "@/components/ui/icon";
import { signup } from "../login/actions";

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;

  return (
    <div className="mx-auto max-w-sm px-4 py-12">
      <div
        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6"
        style={{ background: "var(--trust)" }}
      >
        <Icon name="shield-check" size={26} className="text-white" />
      </div>
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

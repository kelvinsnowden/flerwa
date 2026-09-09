import Link from "next/link";
import Image from "next/image";
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
      <Link href={`/login${next ? `?next=${encodeURIComponent(next)}` : ""}`} className="text-sm text-[var(--muted)] flex items-center gap-1 mb-4">
        <Icon name="chevron-right" size={14} className="rotate-180" />
        Use phone number instead
      </Link>
      <Image
        src="/images/illustrations/kenya-gets-things-done.svg"
        alt=""
        width={280}
        height={210}
        className="w-full max-w-[280px] mx-auto sm:mx-0 mb-6"
        priority
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

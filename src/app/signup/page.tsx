import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signup } from "../login/actions";

export default function SignupPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Create an account</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        Already have one?{" "}
        <Link href="/login" className="font-semibold" style={{ color: "var(--trust)" }}>
          Log in
        </Link>
      </p>
      <AuthForm action={signup} submitLabel="Create account" showName className="mt-6" />
    </div>
  );
}

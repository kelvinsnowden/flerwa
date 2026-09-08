import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="text-2xl font-bold">Log in</h1>
      <p className="text-sm text-[var(--muted)] mt-1">
        New here?{" "}
        <Link href="/signup" className="font-semibold" style={{ color: "var(--trust)" }}>
          Create an account
        </Link>
      </p>
      <AuthForm action={login} submitLabel="Log in" className="mt-6" />
    </div>
  );
}

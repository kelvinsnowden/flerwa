"use client";

/**
 * Route-level error boundary — the fallback for an unhandled throw (a
 * genuine crash, not a query error already handled inline where the data
 * is used). Without this Next.js falls back to its generic unstyled crash
 * page. See QA_REPORT.md, High Issues, "missing loading.tsx/error.tsx."
 */
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg px-4 py-16 text-center">
      <h1 className="text-xl font-bold">Something went wrong</h1>
      <p className="mt-2 text-sm text-[var(--muted)]">
        We hit an unexpected error loading this page. Nothing you did caused
        this, and no payment or booking action was taken.
      </p>
      <button onClick={reset} className="btn-primary mt-6">
        Try again
      </button>
    </div>
  );
}

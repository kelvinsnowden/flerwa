export default function Loading() {
  return (
    <div className="mx-auto max-w-2xl px-4 py-16 flex justify-center">
      <div
        className="h-6 w-6 rounded-full border-2 animate-spin"
        style={{ borderColor: "var(--border)", borderTopColor: "var(--trust)" }}
        role="status"
        aria-label="Loading"
      />
    </div>
  );
}

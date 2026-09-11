// Decorative only — a generic concentric-ring graphic, not a real map.
// Real precise geodata isn't available (no maps API is wired up), and
// implying street-level accuracy we don't have would be its own kind of
// fabrication — the actual served areas are listed as real text below,
// from provider_service_areas.
export function ServiceAreaVisual({ centerLabel }: { centerLabel: string }) {
  return (
    <div
      className="relative w-full aspect-[16/10] rounded-[var(--radius-md)] overflow-hidden flex items-center justify-center"
      style={{ background: "var(--surface)" }}
    >
      <div
        className="absolute rounded-full"
        style={{ width: "85%", height: "85%", background: "var(--trust-tint)", opacity: 0.5 }}
      />
      <div
        className="absolute rounded-full"
        style={{ width: "55%", height: "55%", background: "var(--trust-tint-strong)", opacity: 0.7 }}
      />
      <div
        className="relative rounded-full flex items-center justify-center px-4 py-2 text-sm font-semibold"
        style={{ background: "var(--card)", color: "var(--trust-dark)", boxShadow: "var(--shadow-card)" }}
      >
        {centerLabel}
      </div>
    </div>
  );
}

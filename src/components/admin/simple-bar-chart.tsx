/**
 * Minimal inline-SVG bar chart, no charting dependency — this app has
 * none installed and a handful of real trend bars doesn't justify adding
 * one. Deliberately plain: axis-free, one color, real values only (each
 * bar has a title tooltip with its exact value), matching the "avoid
 * decorative charts" instruction.
 */
export function SimpleBarChart({
  data,
  height = 120,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full min-w-0" title={`${d.label}: ${d.value}`}>
          <div
            className="w-full rounded-t-sm"
            style={{
              height: `${Math.max(2, (d.value / max) * (height - 20))}px`,
              background: d.value > 0 ? "var(--trust)" : "var(--border)",
            }}
          />
          {data.length <= 14 && (
            <span className="text-[9px] text-[var(--muted-2)] mt-1 truncate w-full text-center">{d.label}</span>
          )}
        </div>
      ))}
    </div>
  );
}

const SIZES = { sm: 32, md: 44, lg: 64 } as const;

/**
 * Initials-only. No provider/customer photo storage exists in the schema
 * yet, so this never falls back to a stock/placeholder photo — an initial
 * on a tinted circle is an honest "no photo on file" state.
 */
export function Avatar({ name, size = "md" }: { name: string; size?: keyof typeof SIZES }) {
  const px = SIZES[size];
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
  return (
    <span
      className="avatar"
      style={{ width: px, height: px, fontSize: px * 0.38 }}
      aria-hidden="true"
    >
      {initials || "?"}
    </span>
  );
}

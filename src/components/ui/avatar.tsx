import Image from "next/image";

const SIZES = { sm: 32, md: 44, lg: 64 } as const;

/**
 * Renders the real photo from profiles.avatar_url when one is on file
 * (uploaded via the provider's own profile, stored in the "avatars"
 * bucket). Falls back to initials-on-a-tinted-circle otherwise — an
 * honest "no photo on file" state, never a stock/placeholder photo.
 */
export function Avatar({
  name,
  photoUrl,
  size = "md",
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZES;
}) {
  const px = SIZES[size];

  if (photoUrl) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={px}
        height={px}
        className="rounded-full object-cover flex-shrink-0"
        style={{ width: px, height: px }}
      />
    );
  }

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

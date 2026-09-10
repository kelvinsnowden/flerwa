/**
 * A small local icon set, keyed by the same strings already stored in
 * categories.icon (see the seed migration). Deliberately inline SVG rather
 * than an icon-font/CDN dependency — no external requests, no bundle-size
 * surprise. Falls back to a generic dot-grid glyph for any icon key not
 * yet mapped, rather than rendering nothing.
 */
export type IconName =
  | "shield-check"
  | "video"
  | "home"
  | "search"
  | "calendar"
  | "bell"
  | "user"
  | "clock"
  | "map-pin"
  | "chevron-right"
  | "check"
  | "check-circle"
  | "alert-circle"
  | "camera"
  | "file-text"
  | "wallet"
  | "star"
  | "briefcase"
  | "message-circle"
  | "send"
  | "grid";

const PATHS: Record<IconName, React.ReactNode> = {
  "shield-check": (
    <>
      <path d="M12 2 4 5v6c0 5 3.4 8.7 8 10 4.6-1.3 8-5 8-10V5l-8-3Z" />
      <path d="M9 12l2 2 4-4" />
    </>
  ),
  video: (
    <>
      <rect x="2" y="6" width="14" height="12" rx="2" />
      <path d="M16 10l6-3v10l-6-3" />
    </>
  ),
  home: <path d="M3 11l9-8 9 8v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-9Z" />,
  search: (
    <>
      <circle cx="11" cy="11" r="7" />
      <path d="M21 21l-4.3-4.3" />
    </>
  ),
  calendar: (
    <>
      <rect x="3" y="5" width="18" height="16" rx="2" />
      <path d="M3 10h18M8 3v4M16 3v4" />
    </>
  ),
  bell: <path d="M6 8a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6ZM10 20a2 2 0 0 0 4 0" />,
  user: (
    <>
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4.4 3.6-8 8-8s8 3.6 8 8" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </>
  ),
  "map-pin": (
    <>
      <path d="M12 22s7-6.6 7-12a7 7 0 1 0-14 0c0 5.4 7 12 7 12Z" />
      <circle cx="12" cy="10" r="2.5" />
    </>
  ),
  "chevron-right": <path d="M9 6l6 6-6 6" />,
  check: <path d="M20 6 9 17l-5-5" />,
  "check-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M8.5 12.5l2.5 2.5 5-5" />
    </>
  ),
  "alert-circle": (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v5M12 16h.01" />
    </>
  ),
  camera: (
    <>
      <path d="M4 8h3l2-2h6l2 2h3a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V9a1 1 0 0 1 1-1Z" />
      <circle cx="12" cy="14" r="3.5" />
    </>
  ),
  "file-text": (
    <>
      <path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3a1 1 0 0 1 1-1Z" />
      <path d="M9 13h6M9 17h6M9 9h2" />
    </>
  ),
  wallet: (
    <>
      <rect x="2" y="6" width="20" height="14" rx="2" />
      <path d="M2 10h20M16 15h2" />
    </>
  ),
  star: <path d="M12 2.5l2.9 6 6.6.8-4.8 4.6 1.2 6.6L12 17.3 6.1 20.5l1.2-6.6-4.8-4.6 6.6-.8Z" />,
  briefcase: (
    <>
      <rect x="2.5" y="7" width="19" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M2.5 12h19" />
    </>
  ),
  "message-circle": (
    <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.35 0-2.6-.32-3.7-.9L3 21l1.9-5.7A8.5 8.5 0 1 1 21 11.5Z" />
  ),
  send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4 20-7Z" />,
  grid: (
    <>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </>
  ),
};

export function Icon({
  name,
  size = 20,
  className,
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const path = PATHS[name as IconName] ?? PATHS.grid;
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      {path}
    </svg>
  );
}

import type { ReactNode } from "react";

/**
 * The desktop-layout audit found ~36 pages each independently hardcoding
 * their own max-w-lg/2xl/3xl wrapper, identical in pixels at 1280/1440/
 * 1920 — no page ever used the extra desktop width. This component is
 * the single fix point going forward: pick the size that matches the
 * page's actual content shape, not "make everything wide."
 *
 * - form: a single input column (auth, settings, single-field forms).
 *   Deliberately stays narrow at every width — a wide password field
 *   is worse, not better.
 * - content: reading-width prose/detail pages (service detail, booking
 *   detail) — widens modestly so a paired sidebar/summary can sit
 *   alongside the content on larger screens without either becoming
 *   uncomfortably wide to read.
 * - wide: pages with genuine grid/multi-column potential (marketplace
 *   browse, storefronts, dashboards) — widens the most, intended to be
 *   paired with responsive grid-column classes on the content inside it,
 *   not just empty extra margin.
 */
const SIZE_CLASSES = {
  form: "max-w-sm",
  content: "max-w-3xl lg:max-w-4xl",
  wide: "max-w-3xl lg:max-w-6xl",
} as const;

export type PageContainerSize = keyof typeof SIZE_CLASSES;

export function PageContainer({
  size = "content",
  className = "",
  children,
}: {
  size?: PageContainerSize;
  className?: string;
  children: ReactNode;
}) {
  return <div className={`mx-auto ${SIZE_CLASSES[size]} ${className}`}>{children}</div>;
}

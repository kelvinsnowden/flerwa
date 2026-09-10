import Link from "next/link";
import { Icon } from "./icon";
import type { Category } from "@/lib/types";

// A rounded-square icon tile with a tinted background, matching the
// reference mockups' home-screen category grid. Colour is derived from the
// category's slug (not array index) so it stays stable regardless of query
// order or a category being added/removed later.
const TINTS = [
  { bg: "var(--trust-tint)", fg: "var(--trust-dark)" },
  { bg: "var(--info-tint)", fg: "var(--info)" },
  { bg: "var(--warn-tint)", fg: "var(--warn)" },
  { bg: "var(--trust-tint-strong)", fg: "var(--trust-dark)" },
  { bg: "var(--surface)", fg: "var(--foreground)" },
];

function tintFor(slug: string) {
  let hash = 0;
  for (let i = 0; i < slug.length; i++) hash = (hash * 31 + slug.charCodeAt(i)) >>> 0;
  return TINTS[hash % TINTS.length];
}

export function CategoryCard({ category }: { category: Pick<Category, "slug" | "name" | "icon"> }) {
  const tint = tintFor(category.slug);
  return (
    <Link
      href={`/?category=${category.slug}`}
      className="flex flex-col items-center gap-2 text-center"
    >
      <span
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: tint.bg, color: tint.fg }}
      >
        <Icon name={category.icon ?? "grid"} size={24} />
      </span>
      <span className="text-xs font-medium leading-tight">{category.name}</span>
    </Link>
  );
}

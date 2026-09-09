import Link from "next/link";
import Image from "next/image";
import { Icon } from "./icon";
import type { Category } from "@/lib/types";

// Maps a category slug to one of the /public/images/categories/*.svg
// illustrations. Deliberately a slug lookup, not the category's `icon`
// field, so adding a new category never silently breaks this card — an
// unmapped slug falls back to the small inline Icon glyph below.
const CATEGORY_ILLUSTRATIONS: Record<string, string> = {
  "remote-verification": "/images/categories/property.svg",
  "business-content": "/images/categories/business.svg",
};

export function CategoryCard({ category }: { category: Pick<Category, "slug" | "name" | "icon"> }) {
  const illustration = CATEGORY_ILLUSTRATIONS[category.slug];
  return (
    <Link
      href={`/?category=${category.slug}`}
      className="flex flex-col items-center gap-2 text-center w-16"
    >
      {illustration ? (
        <Image src={illustration} alt="" width={56} height={56} className="rounded-2xl" />
      ) : (
        <span
          className="w-14 h-14 rounded-2xl flex items-center justify-center"
          style={{ background: "var(--trust-tint)", color: "var(--trust-dark)" }}
        >
          <Icon name={category.icon ?? "grid"} size={24} />
        </span>
      )}
      <span className="text-xs font-medium leading-tight">{category.name}</span>
    </Link>
  );
}

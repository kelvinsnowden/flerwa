import Link from "next/link";
import { Icon } from "./icon";
import type { Category } from "@/lib/types";

export function CategoryCard({ category }: { category: Pick<Category, "slug" | "name" | "icon"> }) {
  return (
    <Link
      href={`/?category=${category.slug}`}
      className="flex flex-col items-center gap-2 text-center"
    >
      <span
        className="w-14 h-14 rounded-2xl flex items-center justify-center"
        style={{ background: "var(--trust-tint)", color: "var(--trust-dark)" }}
      >
        <Icon name={category.icon ?? "grid"} size={24} />
      </span>
      <span className="text-xs font-medium leading-tight">{category.name}</span>
    </Link>
  );
}

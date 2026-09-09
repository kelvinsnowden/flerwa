import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Category, Service } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { SearchBar } from "@/components/ui/search-bar";
import { CategoryCard } from "@/components/ui/category-card";
import { ServiceCard } from "@/components/ui/service-card";
import { TrustSignal } from "@/components/ui/trust-signal";
import { EmptyState } from "@/components/ui/empty-state";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string }>;
}) {
  const { q, category } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let firstName: string | null = null;
  if (user) {
    const { data: profile } = await supabase.from("profiles").select("full_name").eq("id", user.id).single();
    firstName = profile?.full_name?.split(" ")[0] ?? null;
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("categories")
    .select("*")
    .eq("is_active", true)
    .order("sort_order")
    .returns<Category[]>();

  let servicesQuery = supabase.from("services").select("*").eq("is_active", true);
  if (category) {
    const cat = categories?.find((c) => c.slug === category);
    if (cat) servicesQuery = servicesQuery.eq("category_id", cat.id);
  }
  if (q) {
    servicesQuery = servicesQuery.or(`name.ilike.%${q}%,summary.ilike.%${q}%`);
  }
  const { data: services, error: servicesError } = await servicesQuery
    .order("base_price_minor", { ascending: false })
    .returns<Service[]>();

  const activeCategory = categories?.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <section>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">
          {firstName ? `Hi ${firstName}, ` : ""}What do you need done?
        </h1>
        {!user && (
          <p className="mt-2 text-[var(--muted)] max-w-xl">
            Verified people in Kenya who will go, look, and tell you the truth —
            for anything you can&apos;t be there for yourself.
          </p>
        )}
        <div className="mt-4">
          <SearchBar defaultValue={q} />
        </div>
      </section>

      {!categoriesError && !!categories?.length && (
        <section className="mt-8">
          <div className="flex gap-5 overflow-x-auto pb-1">
            {categories.map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {activeCategory ? activeCategory.name : q ? `Results for "${q}"` : "Book a service"}
          </h2>
          {(activeCategory || q) && (
            <Link href="/" className="text-sm font-semibold" style={{ color: "var(--trust)" }}>
              Clear
            </Link>
          )}
        </div>

        {servicesError && <ErrorNotice message="We couldn't load services right now. Please refresh." />}

        {!servicesError && !services?.length && (
          <EmptyStateBlock query={q} category={activeCategory?.name} />
        )}

        {!servicesError && !!services?.length && (
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((service) => (
              <ServiceCard key={service.id} service={service} />
            ))}
          </div>
        )}
      </section>

      <section className="mt-12 flex justify-center">
        <TrustSignal />
      </section>

      <section className="mt-10 card p-5 text-sm text-[var(--muted)]">
        <p>
          Have an existing arrangement with a provider you already trust?{" "}
          <Link href="/deal-desk" className="font-semibold" style={{ color: "var(--trust)" }}>
            Bring it onto the platform
          </Link>{" "}
          for protected payment and a verified record — 5% fee, nothing charged to you.
        </p>
      </section>
    </div>
  );
}

function EmptyStateBlock({ query, category }: { query?: string; category?: string }) {
  return (
    <EmptyState
      illustration="/images/empty-states/empty-search.svg"
      title={query ? `No services match "${query}"` : category ? `Nothing in ${category} yet` : "No services published yet"}
      body={
        query || category
          ? "Try a different search, or browse all services."
          : "Check back soon — new services are added regularly."
      }
      action={
        (query || category) && (
          <Link href="/" className="btn-secondary">
            Browse all services
          </Link>
        )
      }
    />
  );
}

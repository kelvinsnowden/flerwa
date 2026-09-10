import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/server";
import type { Category, Service } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { SearchBar } from "@/components/ui/search-bar";
import { CategoryCard } from "@/components/ui/category-card";
import { ServiceCard } from "@/components/ui/service-card";
import { TrustSignal } from "@/components/ui/trust-signal";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon } from "@/components/ui/icon";

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; category?: string; sort?: string }>;
}) {
  const { q, category, sort } = await searchParams;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  let firstName: string | null = null;
  let unreadNotifications = 0;
  if (user) {
    const [{ data: profile }, { count }] = await Promise.all([
      supabase.from("profiles").select("full_name").eq("id", user.id).single(),
      supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", user.id)
        .is("read_at", null),
    ]);
    firstName = profile?.full_name?.split(" ")[0] ?? null;
    unreadNotifications = count ?? 0;
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
    servicesQuery = servicesQuery.or(`name.ilike.%${q}%,summary.ilike.%${q}%,description.ilike.%${q}%`);
  }
  const { data: services, error: servicesError } = await servicesQuery
    .order("base_price_minor", { ascending: sort === "price_asc" })
    .returns<Service[]>();

  const activeCategory = categories?.find((c) => c.slug === category);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {user && (
        <div className="flex items-center justify-between mb-4 sm:hidden">
          <span className="flex items-center gap-1 text-sm font-medium text-[var(--muted)]">
            <Icon name="map-pin" size={16} />
            Nairobi, Kenya
          </span>
          <Link href="/notifications" className="relative p-1 -m-1" aria-label="Notifications">
            <Icon name="bell" size={20} />
            {unreadNotifications > 0 && (
              <span
                className="absolute -top-0.5 -right-0.5 rounded-full text-[9px] font-bold text-white flex items-center justify-center"
                style={{ background: "var(--danger)", minWidth: 14, height: 14, padding: "0 3px" }}
              >
                {unreadNotifications > 9 ? "9+" : unreadNotifications}
              </span>
            )}
          </Link>
        </div>
      )}
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

      {!q && !category && (
        <Link
          href="/services/know-before-you-pay"
          className="mt-6 relative block h-40 rounded-2xl overflow-hidden"
        >
          <Image
            src="/images/photos/property-exterior.jpg"
            alt=""
            fill
            sizes="(min-width: 640px) 672px, 100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
          <div className="absolute bottom-3 left-4 right-4">
            <p className="font-semibold text-sm text-white">Know Before You Pay</p>
            <p className="text-xs text-white/85 mt-0.5">
              A verified professional inspects the property in person before you send a deposit
            </p>
          </div>
        </Link>
      )}

      {!categoriesError && !!categories?.length && (
        <section className="mt-8">
          <h2 className="text-sm font-semibold text-[var(--muted)] mb-3">Browse by category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-y-4 gap-x-2">
            {categories.map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
          </div>
        </section>
      )}

      <section className="mt-10">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">
            {activeCategory ? activeCategory.name : q ? `Results for "${q}"` : "Popular services"}
          </h2>
          {(activeCategory || q) && (
            <Link href="/" className="text-sm font-semibold" style={{ color: "var(--trust)" }}>
              Clear
            </Link>
          )}
        </div>

        {(q || activeCategory) && !servicesError && !!services?.length && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
            <Link
              href={{ pathname: "/", query: { ...(q ? { q } : {}), ...(category ? { category } : {}) } }}
              className="pill-tab whitespace-nowrap"
              data-active={sort !== "price_asc"}
            >
              Recommended
            </Link>
            <Link
              href={{
                pathname: "/",
                query: { ...(q ? { q } : {}), ...(category ? { category } : {}), sort: "price_asc" },
              }}
              className="pill-tab whitespace-nowrap"
              data-active={sort === "price_asc"}
            >
              Price: low to high
            </Link>
          </div>
        )}

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

      <section className="mt-10 card p-5">
        <p className="font-semibold">Can&apos;t find what you need?</p>
        <p className="text-sm text-[var(--muted)] mt-1">
          Tell us what you need done and we&apos;ll help you find the right professional.
        </p>
        <Link href="/tasks/new" className="btn-secondary mt-4">
          Post a task
        </Link>
      </section>

      <section className="mt-4 card p-5">
        <p className="font-semibold">Want to earn from your skills?</p>
        <p className="text-sm text-[var(--muted)] mt-1">Offer your services and get hired.</p>
        <Link href="/provider/apply" className="btn-secondary mt-4">
          Sell your services
        </Link>
      </section>

      <section className="mt-12 flex justify-center">
        <TrustSignal />
      </section>

      <section className="mt-10 card p-5 text-sm text-[var(--muted)]">
        <p>
          Have an existing arrangement with a professional you already trust?{" "}
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
  if (category && !query) {
    return (
      <EmptyState
        illustration="/images/empty-states/empty-search.svg"
        title="More professionals are joining this category"
        body="Check back soon, or post a task and we'll help you find someone."
        action={
          <div className="flex flex-col gap-2 w-full items-center">
            <Link href="/tasks/new" className="btn-primary">
              Post a task
            </Link>
            <Link href="/" className="btn-secondary">
              Browse all services
            </Link>
          </div>
        }
      />
    );
  }
  return (
    <EmptyState
      illustration="/images/empty-states/empty-search.svg"
      title={query ? `No services match "${query}"` : "No services published yet"}
      body={query ? "Try a different search, or browse all services." : "Check back soon — new services are added regularly."}
      action={
        query && (
          <Link href="/" className="btn-secondary">
            Browse all services
          </Link>
        )
      }
    />
  );
}

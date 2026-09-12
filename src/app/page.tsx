import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getActiveCategories, getRecommendedServices } from "@/lib/cache/catalog";
import type { Service } from "@/lib/types";
import { ErrorNotice } from "@/components/error-notice";
import { SearchBar } from "@/components/ui/search-bar";
import { CategoryCard } from "@/components/ui/category-card";
import { ServiceCard } from "@/components/ui/service-card";
import { RecommendedServiceCard } from "@/components/ui/recommended-service-card";
import { TrustSignal } from "@/components/ui/trust-signal";
import { EmptyState } from "@/components/ui/empty-state";
import { Icon, type IconName } from "@/components/ui/icon";

// The 5 pilot services featured on the home page, in display order — real,
// bookable catalogue entries (see supabase/migrations/20260911120000_
// pilot_recommended_services.sql for 4 of these; Viewed For You already
// existed). Not a "trending/popular" claim backed by real usage data (no
// such metric exists yet) — just this launch's featured lineup, which is
// why there's no fake "Popular/New/Trending" badge here, unlike the
// reference mockup.
const RECOMMENDED_SLUGS = [
  "errands-shopping",
  "personal-chef",
  "content-creator-session",
  "viewed-for-you",
  "house-hunter",
] as const;

const RECOMMENDED_META: Record<string, { photo: string; icon: IconName }> = {
  "errands-shopping": { photo: "/images/professionals/errands-shopper.png", icon: "shopping-bag" },
  "personal-chef": { photo: "/images/professionals/personal-chef.png", icon: "chef-hat" },
  "content-creator-session": { photo: "/images/professionals/content-creator.png", icon: "video" },
  "viewed-for-you": { photo: "/images/photos/provider-at-work.jpg", icon: "shield-check" },
  "house-hunter": { photo: "/images/photos/property-exterior.jpg", icon: "home" },
};

const SORT_LABELS: Record<string, string> = {
  price_asc: "Cheapest services",
  turnaround_asc: "Fastest turnaround",
  all: "All services",
};

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
  let unreadNotifications = 0;
  if (user) {
    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .is("read_at", null);
    unreadNotifications = count ?? 0;
  }

  const { data: categories, error: categoriesError } = await getActiveCategories();

  const activeCategory = categories?.find((c) => c.slug === category);
  const isBrowsing = !!q || !!activeCategory || (!!sort && sort !== "recommended");

  let recommended: Service[] | null = null;
  let recommendedError: unknown = null;
  if (!isBrowsing) {
    const { data, error } = await getRecommendedServices(RECOMMENDED_SLUGS);
    recommendedError = error;
    recommended = data
      ? RECOMMENDED_SLUGS.map((slug) => data.find((s) => s.slug === slug)).filter((s): s is Service => !!s)
      : null;
  }

  let servicesQuery = supabase.from("services").select("*").eq("is_active", true);
  if (activeCategory) {
    servicesQuery = servicesQuery.eq("category_id", activeCategory.id);
  }
  if (q) {
    servicesQuery = servicesQuery.or(`name.ilike.%${q}%,summary.ilike.%${q}%,description.ilike.%${q}%`);
  }
  if (sort === "turnaround_asc") {
    servicesQuery = servicesQuery.order("turnaround_hours", { ascending: true });
  } else {
    servicesQuery = servicesQuery.order("base_price_minor", { ascending: sort === "price_asc" });
  }
  const { data: services, error: servicesError } = isBrowsing
    ? await servicesQuery.returns<Service[]>()
    : { data: null, error: null };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight leading-tight">Services</h1>
          <p className="mt-1 text-sm text-[var(--muted)]">Verified professionals for everyday needs</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="pill-tab flex items-center gap-1.5 whitespace-nowrap">
            <Icon name="map-pin" size={14} className="text-[var(--trust)]" />
            Nairobi
          </span>
          {user && (
            <Link href="/notifications" className="relative p-1" aria-label="Notifications">
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
          )}
        </div>
      </div>

      <div className="mt-4">
        <SearchBar defaultValue={q} placeholder="What service do you need?" />
      </div>

      <div className="flex gap-2 mt-4 overflow-x-auto pb-1">
        <Link
          href={{ pathname: "/", query: { ...(q ? { q } : {}), ...(category ? { category } : {}) } }}
          className="pill-tab flex items-center gap-1.5 whitespace-nowrap"
          data-active={!sort || sort === "recommended"}
        >
          <Icon name="star" size={14} />
          Recommended
        </Link>
        <Link
          href={{
            pathname: "/",
            query: { ...(q ? { q } : {}), ...(category ? { category } : {}), sort: "price_asc" },
          }}
          className="pill-tab flex items-center gap-1.5 whitespace-nowrap"
          data-active={sort === "price_asc"}
        >
          <Icon name="wallet" size={14} />
          Price: low to high
        </Link>
        <Link
          href={{
            pathname: "/",
            query: { ...(q ? { q } : {}), ...(category ? { category } : {}), sort: "turnaround_asc" },
          }}
          className="pill-tab flex items-center gap-1.5 whitespace-nowrap"
          data-active={sort === "turnaround_asc"}
        >
          <Icon name="clock" size={14} />
          Fast turnaround
        </Link>
        <Link
          href={{
            pathname: "/",
            query: { ...(q ? { q } : {}), ...(category ? { category } : {}), sort: "all" },
          }}
          className="pill-tab flex items-center gap-1.5 whitespace-nowrap"
          data-active={sort === "all"}
        >
          <Icon name="grid" size={14} />
          All services
        </Link>
      </div>

      {!isBrowsing && (
        <section className="mt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold">Recommended services</h2>
            <Link
              href={{ pathname: "/", query: { sort: "all" } }}
              className="text-sm font-semibold flex items-center gap-1"
              style={{ color: "var(--trust)" }}
            >
              See all services
              <Icon name="chevron-right" size={14} />
            </Link>
          </div>

          {!!recommendedError && <ErrorNotice message="We couldn't load recommended services right now. Please refresh." />}

          {!recommendedError && !!recommended?.length && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {recommended.map((service) => (
                <RecommendedServiceCard
                  key={service.id}
                  service={service}
                  photoSrc={RECOMMENDED_META[service.slug]?.photo ?? "/images/photos/provider-at-work.jpg"}
                  icon={RECOMMENDED_META[service.slug]?.icon ?? "grid"}
                />
              ))}
            </div>
          )}
        </section>
      )}

      {!categoriesError && !!categories?.length && (
        <section className="mt-10">
          <h2 className="text-sm font-semibold text-[var(--muted)] mb-3">Browse by category</h2>
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-y-4 gap-x-2">
            {categories.map((c) => (
              <CategoryCard key={c.id} category={c} />
            ))}
          </div>
        </section>
      )}

      {isBrowsing && (
        <section className="mt-10">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">
              {activeCategory ? activeCategory.name : q ? `Results for "${q}"` : SORT_LABELS[sort ?? "all"] ?? "All services"}
            </h2>
            <Link href="/" className="text-sm font-semibold" style={{ color: "var(--trust)" }}>
              Clear
            </Link>
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
      )}

      <section className="mt-10 card p-5 flex items-center gap-4" style={{ background: "var(--trust-tint)", borderColor: "var(--trust-tint-strong)" }}>
        <span
          className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0"
          style={{ background: "var(--card)", color: "var(--trust)" }}
        >
          <Icon name="message-circle" size={18} />
        </span>
        <div className="flex-1">
          <p className="font-semibold">Can&apos;t find the service you need?</p>
          <p className="text-sm text-[var(--muted)] mt-0.5">
            Tell us what you need and we&apos;ll help you find the right professional.
          </p>
        </div>
        <Link href="/tasks/new" className="btn-primary whitespace-nowrap flex items-center gap-1.5">
          Request a Service
          <Icon name="chevron-right" size={14} />
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

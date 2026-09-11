"use client";

// A sticky quick-nav bar, not a panel switcher — everything on the page
// stays in one continuous scroll (services, portfolio, reviews,
// availability, service areas all follow naturally, same as the mockup),
// these just jump-scroll to the matching section. Matches the existing
// `#providers`/`#book` anchor pattern already used on the service detail
// page rather than introducing a second, hide/show tab paradigm.
const BASE_TABS = [
  { label: "Overview", href: "#overview" },
  { label: "Services", href: "#services" },
  { label: "Portfolio", href: "#portfolio" },
  { label: "Reviews", href: "#reviews" },
] as const;

export function StorefrontQuickNav({ showFaq = false }: { showFaq?: boolean }) {
  const tabs = showFaq ? [...BASE_TABS, { label: "FAQ", href: "#faq" }] : BASE_TABS;
  return (
    <div className="flex border-b sticky top-14 bg-[var(--background)] z-10 -mx-4 px-4 sm:mx-0 sm:px-0 overflow-x-auto">
      {tabs.map((tab) => (
        <a
          key={tab.href}
          href={tab.href}
          className="px-3 py-2.5 text-sm font-semibold whitespace-nowrap"
          style={{ color: "var(--muted)" }}
        >
          {tab.label}
        </a>
      ))}
    </div>
  );
}

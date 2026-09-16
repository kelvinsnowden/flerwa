"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { Icon } from "@/components/ui/icon";
import { formatRelativeTime } from "@/lib/relative-time";
import { StatusBadge } from "./status-badge";
import { VerificationDrawer } from "./verification-drawer";
import type { VerificationRow, VerificationTab } from "./page";

interface Stats {
  all: number;
  submitted: number;
  underReview: number;
  verified: number;
  rejected: number;
  expired: number;
}

const TABS: { key: VerificationTab; label: string; statKey: keyof Stats }[] = [
  { key: "all", label: "All", statKey: "all" },
  { key: "submitted", label: "Pending", statKey: "submitted" },
  { key: "under_review", label: "Under review", statKey: "underReview" },
  { key: "verified", label: "Approved", statKey: "verified" },
  { key: "rejected", label: "Rejected", statKey: "rejected" },
  { key: "expired", label: "Expired", statKey: "expired" },
];

function initialsOf(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

function exportCsv(rows: VerificationRow[]) {
  const header = ["Provider", "Email", "Phone", "Categories", "Location", "Status", "Created"];
  const lines = rows.map((p) => {
    const cats = p.provider_categories.map((c) => c.categories?.name).filter(Boolean).join("; ");
    const loc = p.locations ? `${p.locations.town}, ${p.locations.county}` : "";
    return [p.display_name, p.profiles?.email ?? "", p.profiles?.phone ?? "", cats, loc, p.verification_status, p.created_at]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(",");
  });
  const csv = [header.join(","), ...lines].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `verifications-page-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export function VerificationsWorkspace({
  providers,
  categories,
  locations,
  stats,
  tab,
  q,
  categoryId,
  locationId,
  sortAsc,
  page,
  totalPages,
  totalCount,
}: {
  providers: VerificationRow[];
  categories: { id: string; name: string }[];
  locations: { id: string; town: string; county: string }[];
  stats: Stats;
  tab: VerificationTab;
  q: string;
  categoryId: string;
  locationId: string;
  sortAsc: boolean;
  page: number;
  totalPages: number;
  totalCount: number;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [searchInput, setSearchInput] = useState(q);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [openProviderId, setOpenProviderId] = useState<string | null>(null);

  const hasFilters = !!(q || categoryId || locationId || sortAsc || tab !== "all");

  function navigate(patch: Record<string, string | undefined>) {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(patch)) {
      if (value) params.set(key, value);
      else params.delete(key);
    }
    // Any filter change resets pagination — a stale page number past the
    // new result set's end would just render an empty table.
    if (!("page" in patch)) params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  }

  const allSelected = providers.length > 0 && providers.every((p) => selected.has(p.id));
  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(providers.map((p) => p.id)));
  }
  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const openProvider = useMemo(() => providers.find((p) => p.id === openProviderId) ?? null, [providers, openProviderId]);

  return (
    <div>
      <div className="flex justify-end mb-4">
        <button type="button" className="btn-secondary text-sm" onClick={() => exportCsv(providers)} title="Exports the current page as CSV">
          <Icon name="download" size={15} />
          Export
        </button>
      </div>

      {/* Compact stats row — never large dashboard cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-5">
        <div className="stat-tile text-left !p-3">
          <p className="text-lg font-bold">{stats.submitted}</p>
          <p className="text-xs text-[var(--muted)]">Pending review</p>
        </div>
        <div className="stat-tile text-left !p-3">
          <p className="text-lg font-bold">{stats.underReview}</p>
          <p className="text-xs text-[var(--muted)]">Under review</p>
        </div>
        <div className="stat-tile text-left !p-3">
          <p className="text-lg font-bold">{stats.verified}</p>
          <p className="text-xs text-[var(--muted)]">Approved</p>
        </div>
        <div className="stat-tile text-left !p-3">
          <p className="text-lg font-bold">{stats.rejected}</p>
          <p className="text-xs text-[var(--muted)]">Rejected</p>
        </div>
      </div>

      {/* Status tabs */}
      <div className="flex gap-1.5 overflow-x-auto mb-4 pb-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className="pill-tab flex-shrink-0 whitespace-nowrap"
            data-active={tab === t.key}
            onClick={() => navigate({ tab: t.key === "all" ? undefined : t.key })}
          >
            {t.label} <span className="opacity-70">{stats[t.statKey]}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-4">
        <form
          className="relative flex-1 min-w-[200px]"
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ q: searchInput || undefined });
          }}
        >
          <Icon name="search" size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--muted-2)]" />
          <input
            type="search"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search by name, email or service..."
            className="w-full pl-9 !min-h-0 !py-2 text-sm"
          />
        </form>
        <select
          value={categoryId}
          onChange={(e) => navigate({ category: e.target.value || undefined })}
          className="!min-h-0 !py-2 text-sm w-auto"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <select
          value={locationId}
          onChange={(e) => navigate({ location: e.target.value || undefined })}
          className="!min-h-0 !py-2 text-sm w-auto"
        >
          <option value="">All locations</option>
          {locations.map((l) => (
            <option key={l.id} value={l.id}>
              {l.town}, {l.county}
            </option>
          ))}
        </select>
        <select
          value={sortAsc ? "oldest" : "newest"}
          onChange={(e) => navigate({ sort: e.target.value === "oldest" ? "oldest" : undefined })}
          className="!min-h-0 !py-2 text-sm w-auto"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
        </select>
        {hasFilters && (
          <button
            type="button"
            className="text-sm text-[var(--muted)] hover:text-[var(--foreground)] px-2"
            onClick={() => {
              setSearchInput("");
              router.push(pathname);
            }}
          >
            Reset filters
          </button>
        )}
      </div>

      {selected.size > 0 && (
        <div className="flex items-center gap-3 mb-3 px-3 py-2 rounded-[var(--radius-sm)]" style={{ background: "var(--trust-tint)" }}>
          <p className="text-sm font-medium" style={{ color: "var(--trust-dark)" }}>
            {selected.size} selected
          </p>
          <button type="button" className="text-sm text-[var(--trust-dark)] underline" onClick={() => setSelected(new Set())}>
            Clear selection
          </button>
        </div>
      )}

      {providers.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="text-sm font-medium mb-1">
            {hasFilters ? "No applications match these filters" : "No pending verifications"}
          </p>
          <p className="text-xs text-[var(--muted)]">
            {hasFilters ? "Try a different search or reset filters." : "New applications will show up here."}
          </p>
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} aria-label="Select all" />
                </th>
                <th>Provider</th>
                <th>Service / Category</th>
                <th>Location</th>
                <th>Created</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {providers.map((p) => {
                const cats = p.provider_categories.map((c) => c.categories?.name).filter((n): n is string => !!n);
                return (
                  <tr key={p.id} data-selected={selected.has(p.id)}>
                    <td>
                      <input type="checkbox" checked={selected.has(p.id)} onChange={() => toggleOne(p.id)} aria-label={`Select ${p.display_name}`} />
                    </td>
                    <td>
                      <button type="button" className="flex items-center gap-2.5 text-left" onClick={() => setOpenProviderId(p.id)}>
                        {p.profiles?.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={p.profiles.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <span className="avatar h-8 w-8 text-xs flex-shrink-0">{initialsOf(p.display_name)}</span>
                        )}
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold truncate">{p.display_name}</span>
                          {p.headline && <span className="block text-xs text-[var(--muted)] truncate max-w-[180px]">{p.headline}</span>}
                        </span>
                      </button>
                    </td>
                    <td>
                      <div className="flex flex-wrap gap-1">
                        {cats.slice(0, 1).map((name) => (
                          <span key={name} className="badge-muted">
                            {name}
                          </span>
                        ))}
                        {cats.length > 1 && <span className="badge-muted">+{cats.length - 1}</span>}
                        {cats.length === 0 && <span className="text-xs text-[var(--muted)]">—</span>}
                      </div>
                    </td>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">{p.locations ? p.locations.town : "—"}</td>
                    <td className="text-sm text-[var(--muted)] whitespace-nowrap">{formatRelativeTime(p.created_at)}</td>
                    <td>
                      <StatusBadge status={p.verification_status} />
                    </td>
                    <td>
                      <button type="button" className="btn-secondary text-xs px-3 py-1.5" onClick={() => setOpenProviderId(p.id)}>
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4 text-sm">
          <span className="text-[var(--muted)]">
            Page {page} of {totalPages} ({totalCount} total)
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <button type="button" className="px-3 py-1 border rounded hover:bg-[var(--surface)]" onClick={() => navigate({ page: String(page - 1) })}>
                Previous
              </button>
            )}
            {page < totalPages && (
              <button type="button" className="px-3 py-1 border rounded hover:bg-[var(--surface)]" onClick={() => navigate({ page: String(page + 1) })}>
                Next
              </button>
            )}
          </div>
        </div>
      )}

      {openProvider && (
        <VerificationDrawer
          key={openProvider.id}
          provider={openProvider}
          categories={categories}
          onClose={() => setOpenProviderId(null)}
        />
      )}
    </div>
  );
}

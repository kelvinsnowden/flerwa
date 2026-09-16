import type { IconName } from "@/components/ui/icon";

export interface AdminNavItem {
  href: string;
  label: string;
  icon: IconName;
  /** Key into the badge-count map the sidebar is given — real counts only, never a placeholder number. */
  badgeKey?: "pendingVerifications";
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin", label: "Overview", icon: "home" },
  { href: "/admin/verifications", label: "Verifications", icon: "shield-check", badgeKey: "pendingVerifications" },
  { href: "/admin/providers", label: "Providers", icon: "briefcase" },
  { href: "/admin/customers", label: "Customers", icon: "user" },
  { href: "/admin/transactions", label: "Bookings", icon: "calendar" },
  { href: "/admin/payments", label: "Payments", icon: "wallet" },
  { href: "/admin/payouts", label: "Payouts", icon: "send" },
  { href: "/admin/ledger", label: "Ledger", icon: "bar-chart" },
  { href: "/admin/reviews", label: "Reviews", icon: "star" },
  { href: "/admin/disputes", label: "Disputes", icon: "flag" },
  { href: "/admin/moderation", label: "Moderation", icon: "shield-check" },
  { href: "/admin/categories", label: "Categories", icon: "grid" },
  { href: "/admin/support", label: "Support", icon: "help-circle" },
  { href: "/admin/deal-desk", label: "Deal Desk", icon: "briefcase" },
  { href: "/admin/demand", label: "Demand", icon: "bar-chart" },
  { href: "/admin/matching", label: "Matching", icon: "search" },
  { href: "/admin/integrations", label: "Integrations", icon: "link" },
  { href: "/admin/system", label: "System", icon: "settings" },
  { href: "/admin/audit-log", label: "Audit Log", icon: "list" },
  { href: "/admin/roles", label: "Roles & Permissions", icon: "lock" },
  { href: "/admin/approvals", label: "Approvals", icon: "check-circle" },
];

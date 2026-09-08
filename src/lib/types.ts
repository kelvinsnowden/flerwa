/**
 * Domain types mirroring the Postgres enums and the shape of amount_minor
 * money. Never represent money as a JS float anywhere in this codebase —
 * always { amount_minor: number, currency: string } or a bare integer minor
 * unit, formatted for display only at the last possible moment (see money.ts).
 */

export type UserRole = "customer" | "provider" | "admin";

export type VerificationStatus =
  | "pending"
  | "submitted"
  | "under_review"
  | "verified"
  | "rejected"
  | "expired";

export type PricingModel = "fixed" | "quote" | "hourly" | "recurring" | "application";

export type FulfilmentMode =
  | "remote_digital"
  | "on_site_customer_present"
  | "on_site_customer_absent"
  | "at_provider"
  | "representation";

export type TxnState =
  | "draft"
  | "requested"
  | "quoted"
  | "quote_accepted"
  | "funded"
  | "scheduled"
  | "en_route"
  | "checked_in"
  | "in_progress"
  | "evidence_submitted"
  | "customer_review"
  | "revision_requested"
  | "approved"
  | "released"
  | "settled"
  | "reviewed"
  | "closed"
  | "cancelled_by_customer"
  | "cancelled_by_provider"
  | "expired"
  | "disputed"
  | "refunded";

export const TXN_STATE_LABELS: Record<TxnState, string> = {
  draft: "Draft",
  requested: "Requested",
  quoted: "Quoted",
  quote_accepted: "Quote accepted",
  funded: "Payment confirmed",
  scheduled: "Scheduled",
  en_route: "Provider en route",
  checked_in: "Provider on site",
  in_progress: "In progress",
  evidence_submitted: "Awaiting your review",
  customer_review: "Under review",
  revision_requested: "Revision requested",
  approved: "Approved",
  released: "Payment released",
  settled: "Completed",
  reviewed: "Reviewed",
  closed: "Closed",
  cancelled_by_customer: "Cancelled by customer",
  cancelled_by_provider: "Cancelled by provider",
  expired: "Expired",
  disputed: "In dispute",
  refunded: "Refunded",
};

export interface Category {
  id: string;
  slug: string;
  name: string;
  vertical: string;
  description: string | null;
  icon: string | null;
  is_active: boolean;
  requires_clearance: boolean;
  sort_order: number;
}

export interface Service {
  id: string;
  category_id: string;
  slug: string;
  name: string;
  summary: string;
  description: string | null;
  pricing_model: PricingModel;
  fulfilment_mode: FulfilmentMode;
  base_price_minor: number;
  currency: string;
  turnaround_hours: number;
  requires_location: boolean;
  is_active: boolean;
}

export interface ServiceScopeItem {
  id: string;
  service_id: string;
  label: string;
  included: boolean;
  sort_order: number;
}

export interface ServiceChecklistItem {
  id: string;
  service_id: string;
  label: string;
  help_text: string | null;
  is_required: boolean;
  requires_photo: boolean;
  requires_note: boolean;
  sort_order: number;
}

export interface Provider {
  id: string;
  user_id: string;
  slug: string;
  display_name: string;
  headline: string | null;
  bio: string | null;
  base_location_id: string | null;
  verification_status: VerificationStatus;
  is_accepting_work: boolean;
  is_published: boolean;
}

export interface ReliabilityScore {
  provider_id: string;
  jobs_completed: number;
  jobs_accepted: number;
  completion_rate: number | null;
  dispute_count: number;
  avg_rating: number | null;
  score: number | null;
  sample_size: number;
}

export interface ServiceTransaction {
  id: string;
  customer_id: string;
  provider_id: string | null;
  service_id: string | null;
  category_id: string;
  location_id: string | null;
  pricing_model: PricingModel;
  fulfilment_mode: FulfilmentMode;
  state: TxnState;
  currency: string;
  service_amount_minor: number;
  materials_amount_minor: number;
  platform_fee_minor: number;
  total_amount_minor: number;
  customer_instructions: string | null;
  scheduled_for: string | null;
  contact_phone: string | null;
  requested_at: string;
  funded_at: string | null;
  evidence_at: string | null;
  auto_approve_at: string | null;
  settled_at: string | null;
}

export interface Location {
  id: string;
  country: string;
  county: string;
  town: string;
  ward: string | null;
  slug: string;
}

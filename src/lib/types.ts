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
  en_route: "Professional en route",
  checked_in: "Professional on site",
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
  cancelled_by_provider: "Cancelled by the professional",
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

export type SchedulingMode = "none" | "request" | "scheduled";

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
  /** none: no calendar, request/conversation only. request: customer proposes a date/time (default). scheduled: real calendar enforced server-side. */
  scheduling_mode: SchedulingMode;
  slot_duration_minutes: number | null;
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
  experience_summary: string | null;
  base_location_id: string | null;
  verification_status: VerificationStatus;
  is_accepting_work: boolean;
  is_published: boolean;
  booking_buffer_minutes: number;
  min_notice_hours: number;
  max_advance_days: number;
  created_at: string;
}

export interface AvailabilityRule {
  id: string;
  provider_id: string;
  day_of_week: number; // 0 = Sunday .. 6 = Saturday
  start_time: string;
  end_time: string;
}

export interface BlockedSlot {
  id: string;
  provider_id: string;
  starts_at: string;
  ends_at: string;
  reason: string | null;
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
  completion_summary: string | null;
}

export const REVIEW_TAGS = [
  "Professional",
  "Detailed",
  "On time",
  "Great communication",
  "Value for money",
] as const;
export type ReviewTag = (typeof REVIEW_TAGS)[number];

export interface Review {
  id: string;
  transaction_id: string;
  reviewer_id: string;
  reviewee_id: string;
  rating: number;
  comment: string | null;
  tags: string[];
  would_book_again: boolean | null;
  is_customer_review: boolean;
  created_at: string;
}

export interface Location {
  id: string;
  country: string;
  county: string;
  town: string;
  ward: string | null;
  slug: string;
}

export interface Message {
  id: string;
  transaction_id: string | null;
  conversation_id: string | null;
  sender_id: string;
  body: string;
  created_at: string;
  read_at: string | null;
}

export interface Conversation {
  id: string;
  customer_id: string;
  provider_id: string;
  service_id: string | null;
  transaction_id: string | null;
  requested_date: string | null;
  requested_time: string | null;
  state: "open" | "converted" | "closed";
  created_at: string;
  updated_at: string;
}

export interface PortfolioItem {
  id: string;
  provider_id: string;
  photo_url: string;
  caption: string | null;
  sort_order: number;
  created_at: string;
}

export interface SavedProvider {
  customer_id: string;
  provider_id: string;
  created_at: string;
}

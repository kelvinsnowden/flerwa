-- Product correction: Trusted Services is a two-sided marketplace, not a
-- narrow service directory. Two schema-level pieces are needed for that —
-- everything else (a user being both a customer AND a seller) already
-- worked, since "is this user a seller" has always meant "does a row for
-- them exist in providers", never profiles.role (which the app never
-- actually sets to 'provider' anywhere — see MARKETPLACE_UX_AUDIT.md).

-- 1. A lightweight, non-gating signal of what a user said they came to do.
-- Deliberately NOT an access-control field — it only personalizes which
-- CTA a user sees first (find help / sell services / both). Whether
-- someone can actually act as a seller is still governed entirely by the
-- existing providers row + verification_status, exactly as before.
alter table profiles add column intent text check (intent in ('buyer', 'seller', 'both'));
comment on column profiles.intent is
  'Self-reported onboarding preference, not a permanent account type or a permission. '
  'A user with intent=buyer can still apply as a seller later, and vice versa — '
  'selling capability is entirely governed by the providers table + verification_status.';

-- 2. Broaden the catalogue architecture beyond the two original verticals.
-- Per docs/09-verticals.md the launch was deliberately narrow (Remote-
-- Principal Services first, Business & Creator Services at month 6,
-- high-value fundi work at month 12) — that reasoning about LAUNCH
-- OPERATIONS still holds and nothing here fakes sellers or services to
-- populate these. But the CATALOGUE itself needs to look like the
-- marketplace this is, not a 2-item directory, so real category rows are
-- added now with zero seeded services — they render via the existing
-- empty-state path (see EmptyStateBlock in src/app/page.tsx) until real
-- services/sellers exist in them.
insert into categories (slug, name, vertical, description, icon, sort_order) values
  ('home-property', 'Home & Property', 'home_services',
   'Cleaning, repairs, installations and property upkeep — plumbing, electrical, carpentry, painting and more.',
   'home', 3),
  ('personal', 'Personal', 'home_services',
   'Tutoring, fitness, beauty, personal chefs, photography and other one-to-one services.',
   'user', 4),
  ('errands-tasks', 'Errands & Tasks', 'home_services',
   'Pickups, deliveries, document collection, queueing and local representation for anything you can''t get to yourself.',
   'briefcase', 5);

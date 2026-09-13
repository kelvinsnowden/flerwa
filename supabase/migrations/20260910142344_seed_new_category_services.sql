-- Real catalogue entries for the 3 categories added in
-- 20260910180000_marketplace_intent_and_categories.sql — without these,
-- the categories were browsable but a dead end (no services to book, and
-- nothing for a seller to select in onboarding step 3). This is
-- catalogue seeding, not faked marketplace activity: no fake providers,
-- bookings, or reviews are created here, only real services any admin
-- could have entered by hand, matching the flagship catalogue's own
-- level of detail (scope + checklist items — required, since
-- rpc_submit_completion has nothing to block on without at least one
-- required checklist item, same gap 20260910160000_seed_remaining_
-- checklists.sql closed for the other pre-existing services).
-- Prices are ASSUMPTION-tagged placeholders, same convention as the
-- original launch catalogue — editable from the admin console.

with cat as (select id from categories where slug = 'home-property')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'deep-house-cleaning', 'Deep House Cleaning',
  'A thorough clean of your whole home, not just a tidy-up.',
  'Every room cleaned top to bottom — kitchen, bathrooms, floors, surfaces and ' ||
  'skirting boards. Bring-your-own-supplies unless agreed otherwise with your cleaner.',
  'fixed', 'on_site_customer_present', 350000, 24
from cat;

with cat as (select id from categories where slug = 'home-property')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'plumbing-repair-visit', 'Plumbing Repair Visit',
  'A qualified plumber diagnoses and fixes the problem on site.',
  'Covers the call-out and labour for a single plumbing issue — leaks, blocked ' ||
  'drains, fittings. Materials beyond minor parts are quoted separately before work starts.',
  'fixed', 'on_site_customer_present', 200000, 24
from cat;

with cat as (select id from categories where slug = 'home-property')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'electrical-repair-visit', 'Electrical Repair Visit',
  'A qualified electrician diagnoses and fixes the problem on site.',
  'Covers the call-out and labour for a single electrical issue — faulty sockets, ' ||
  'wiring faults, fittings. Materials beyond minor parts are quoted separately before work starts.',
  'fixed', 'on_site_customer_present', 250000, 24
from cat;

with cat as (select id from categories where slug = 'personal')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'home-tutoring-session', 'Home Tutoring Session',
  'A one-to-one tutoring session at your home.',
  'Book a single session with a tutor in the subject and level you need. Recurring ' ||
  'sessions can be arranged directly with your tutor after the first booking.',
  'fixed', 'on_site_customer_present', 150000, 48
from cat;

with cat as (select id from categories where slug = 'personal')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'event-photography-half-day', 'Event Photography (Half Day)',
  'A photographer for up to 4 hours at your event.',
  'Covers up to 4 hours of coverage and a digital gallery of edited photos delivered ' ||
  'afterward. Additional hours and printed products are quoted separately.',
  'fixed', 'on_site_customer_present', 800000, 72
from cat;

with cat as (select id from categories where slug = 'errands-tasks')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'document-pickup-delivery', 'Document Pickup & Delivery',
  'Someone collects a document or item and delivers it to you.',
  'For a single collection and delivery within the same town — the specifics (what, ' ||
  'from where, to where, by when) are agreed with your runner via the booking message.',
  'fixed', 'representation', 80000, 24
from cat;

with cat as (select id from categories where slug = 'errands-tasks')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'queue-collect-on-your-behalf', 'Queue & Collect On Your Behalf',
  'Someone stands in line or attends an appointment for you.',
  'For anything that requires physically being somewhere and waiting — a government ' ||
  'office, a bank, a collection point — with proof once it''s done.',
  'fixed', 'representation', 70000, 24
from cat;

-- ---------- scope items (what's included) ----------
insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, true, x.sort_order from services,
  (values ('Every room cleaned', 1), ('Kitchen deep clean', 2), ('Bathroom deep clean', 3),
          ('Before/after photos', 4)) as x(label, sort_order)
where services.slug = 'deep-house-cleaning';

insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, true, x.sort_order from services,
  (values ('Diagnosis of the issue', 1), ('Labour for the fix', 2), ('Photo evidence of the completed work', 3))
  as x(label, sort_order)
where services.slug in ('plumbing-repair-visit', 'electrical-repair-visit');

insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, true, x.sort_order from services,
  (values ('60-minute session', 1), ('Session summary for the customer', 2)) as x(label, sort_order)
where services.slug = 'home-tutoring-session';

insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, true, x.sort_order from services,
  (values ('Up to 4 hours of coverage', 1), ('Edited digital gallery', 2)) as x(label, sort_order)
where services.slug = 'event-photography-half-day';

insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, true, x.sort_order from services,
  (values ('Collection', 1), ('Delivery', 2), ('Proof of handover', 3)) as x(label, sort_order)
where services.slug in ('document-pickup-delivery', 'queue-collect-on-your-behalf');

-- ---------- checklist items (required for rpc_submit_completion) ----------
insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, sort_order)
select id, x.label, x.help_text, true, x.requires_photo, x.sort_order from services,
  (values
    ('Kitchen photographed', 'Before and after', true, 1),
    ('Bathroom(s) photographed', 'Before and after', true, 2),
    ('All rooms cleaned', 'Confirm every room was covered', false, 3)
  ) as x(label, help_text, requires_photo, sort_order)
where services.slug = 'deep-house-cleaning';

insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, sort_order)
select id, x.label, x.help_text, true, x.requires_photo, x.sort_order from services,
  (values
    ('Issue photographed before work', 'Show the original problem', true, 1),
    ('Fix photographed after work', 'Show the completed repair', true, 2),
    ('Work summary noted', 'What was diagnosed and what was done', false, 3)
  ) as x(label, help_text, requires_photo, sort_order)
where services.slug in ('plumbing-repair-visit', 'electrical-repair-visit');

insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, requires_note, sort_order)
select id, x.label, x.help_text, true, x.requires_photo, x.requires_note, x.sort_order from services,
  (values
    ('Session completed', 'Confirm the full session took place', false, false, 1),
    ('Session summary provided', 'What was covered, progress made', false, true, 2)
  ) as x(label, help_text, requires_photo, requires_note, sort_order)
where services.slug = 'home-tutoring-session';

insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, sort_order)
select id, x.label, x.help_text, true, x.requires_photo, x.sort_order from services,
  (values
    ('Coverage completed', 'Confirm the agreed hours were covered', false, 1),
    ('Sample photos delivered', 'A few edited photos as proof of delivery', true, 2)
  ) as x(label, help_text, requires_photo, sort_order)
where services.slug = 'event-photography-half-day';

insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, sort_order)
select id, x.label, x.help_text, true, x.requires_photo, x.sort_order from services,
  (values
    ('Item/document photographed at collection', 'Confirms what was collected', true, 1),
    ('Proof of delivery photographed', 'Signature, receipt, or handover photo', true, 2)
  ) as x(label, help_text, requires_photo, sort_order)
where services.slug in ('document-pickup-delivery', 'queue-collect-on-your-behalf');

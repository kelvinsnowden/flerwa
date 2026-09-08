-- =====================================================================
-- Seed data: the narrow Remote-Principal launch catalogue, per
-- docs/09-verticals.md and docs/11-roadmap.md. Four services only —
-- deliberately narrow per docs/00-executive-thesis.md's central finding
-- that horizontal launches (Lynk, SweepSouth) are how this category fails.
--
-- All prices are ASSUMPTION-tagged placeholders in the source docs,
-- pending the 30-day validation in docs/11-roadmap.md. They are stored
-- here exactly as documented and are editable from the admin console
-- (Phase 12) — never hard-coded in application code.
-- =====================================================================

insert into locations (country, county, town, ward, slug) values
  ('KE', 'Nairobi', 'Nairobi', 'Westlands', 'nairobi-westlands'),
  ('KE', 'Nairobi', 'Nairobi', 'Kilimani', 'nairobi-kilimani'),
  ('KE', 'Nairobi', 'Nairobi', 'Kileleshwa', 'nairobi-kileleshwa'),
  ('KE', 'Nairobi', 'Nairobi', 'Lavington', 'nairobi-lavington'),
  ('KE', 'Nairobi', 'Nairobi', 'Karen', 'nairobi-karen'),
  ('KE', 'Nairobi', 'Nairobi', 'Kasarani', 'nairobi-kasarani'),
  ('KE', 'Nairobi', 'Nairobi', 'Rongai', 'nairobi-rongai'),
  ('KE', 'Nairobi', 'Nairobi', 'Roysambu', 'nairobi-roysambu');

insert into categories (slug, name, vertical, description, icon, sort_order) values
  ('remote-verification', 'Verification & Representation', 'remote_principal',
   'Be someone''s trusted eyes and hands in Kenya when they cannot be there themselves.',
   'shield-check', 1),
  ('business-content', 'Business & Creator Services', 'business_services',
   'UGC, content, photography and marketing services. Seeded but not launched — see docs/09-verticals.md.',
   'video', 2);

-- ---------- Service 1: Know Before You Pay (the flagship launch product) ----------
with cat as (select id from categories where slug = 'remote-verification')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'know-before-you-pay', 'Know Before You Pay',
  'Property inspection before you send a deposit.',
  'A verified provider inspects the property in person: photographs every room, ' ||
  'records a video walkthrough, completes a structured 12-point checklist, and ' ||
  'delivers an evidenced report within 48 hours. Never a bare "looks fine" — the ' ||
  'system requires photographic evidence for every checklist point.',
  'fixed', 'on_site_customer_absent', 600000, 48
from cat;

with cat as (select id from categories where slug = 'remote-verification')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'viewed-for-you', 'Viewed For You',
  'A provider attends a property viewing on your behalf and calls you in live.',
  'For when you have a viewing appointment already booked but cannot attend. ' ||
  'The provider attends, video-calls you in during the viewing, and delivers a ' ||
  'written report and photo set afterward.',
  'fixed', 'representation', 450000, 72
from cat;

with cat as (select id from categories where slug = 'remote-verification')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'landlords-quarterly-check', 'Landlord''s Quarterly Check',
  'Recurring property condition check for absentee landlords.',
  'Condition check, utility meter readings, tenant confirmation and a dated photo ' ||
  'set every quarter. Priced per visit — see docs/07-payments.md on why recurring ' ||
  'services are funded per-occurrence, never as a large upfront balance.',
  'recurring', 'on_site_customer_absent', 550000, 72
from cat;

with cat as (select id from categories where slug = 'remote-verification')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'document-collection', 'Document & Physical Verification',
  'Collect a document, verify goods, or attend an appointment on your behalf.',
  'A structured errand with evidence: the provider collects or verifies a ' ||
  'specific physical item or document and couriers/reports back with photographic ' ||
  'proof of the exchange.',
  'fixed', 'representation', 350000, 48
from cat;

-- ---------- Scope items (what's included/excluded — the anti-dispute structure) ----------
insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, x.included, x.sort_order
from services, (values
  ('Exterior and street photographs', true, 1),
  ('Every room photographed', true, 2),
  ('Continuous video walkthrough', true, 3),
  ('Water and electricity spot-check', true, 4),
  ('12-point structured checklist report', true, 5),
  ('Delivered within 48 hours', true, 6),
  ('Legal opinion on title or ownership', false, 7),
  ('Negotiation with the landlord or agent', false, 8)
) as x(label, included, sort_order)
where services.slug = 'know-before-you-pay';

-- ---------- Checklist items (the structured-report requirement, per docs/06) ----------
insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, sort_order)
select id, x.label, x.help_text, true, x.requires_photo, x.sort_order
from services, (values
  ('Exterior photographed', 'Front of building, entrance, street view', true, 1),
  ('Street/location confirmed', 'Geotagged photo confirming the address matches', true, 2),
  ('Every room photographed', 'Minimum one photo per room, including ceilings and under sinks', true, 3),
  ('Kitchen photographed', 'Include appliances and plumbing under the sink', true, 4),
  ('Bathroom(s) photographed', 'Include water pressure/flow observation', true, 5),
  ('Water tested', 'Run taps, note pressure and any discolouration', true, 6),
  ('Electricity checked', 'Confirm sockets and switches functional', true, 7),
  ('Visible defects recorded', 'Photograph and describe any damage or disrepair', false, 8),
  ('Neighbourhood observations noted', 'Noise, access, security, parking', false, 9),
  ('Video walkthrough recorded', 'Single continuous take, narrated', true, 10),
  ('Provider declaration completed', 'Confirms the inspection was conducted in person as described', true, 11),
  ('Conflict-of-interest declaration completed', 'Provider affirms no relationship with or payment from the seller/agent — see docs/06-trust-architecture.md', true, 12)
) as x(label, help_text, requires_photo, sort_order)
where services.slug = 'know-before-you-pay';

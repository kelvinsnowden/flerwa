-- Real catalogue entries for the "pilot services" the home page's
-- recommended row now features live: Errands & Shopping, Personal Chef,
-- Content Creator, and House Hunter didn't exist yet as bookable
-- services — only "Viewed For You" (the 5th recommended card) already
-- existed. Same discipline as 20260910200000_seed_new_category_services.sql:
-- real, bookable catalogue entries with real scope + checklist items
-- (required for rpc_submit_completion to have anything to block on), not
-- fake marketplace activity. Content Creator is also this project's first
-- real service under Business & Creator Services, which has had zero
-- services since that category was added.

with cat as (select id from categories where slug = 'personal')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'personal-chef', 'Personal Chef',
  'Home cooking, meal prep, private dining and events.',
  'A chef cooks at your home for a single occasion — a private dinner, meal prep for ' ||
  'the week, or a small event. Menu and any special dietary needs are agreed with your ' ||
  'chef directly before the visit. Ingredients are quoted separately unless agreed otherwise.',
  'fixed', 'on_site_customer_present', 450000, 24
from cat;

with s as (select id from services where slug = 'personal-chef')
insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, x.included, x.sort_order from s, (values
  ('Menu planning around your preferences and dietary needs', true, 1),
  ('Cooking on site at your home', true, 2),
  ('Kitchen cleaned up after the meal', true, 3),
  ('Ingredients and groceries', false, 4)
) as x(label, included, sort_order);

with s as (select id from services where slug = 'personal-chef')
insert into service_checklist_items (service_id, label, is_required, sort_order)
select id, x.label, true, x.sort_order from s, (values
  ('Menu confirmed with the customer', 1),
  ('Meal prepared and served', 2),
  ('Kitchen and dining area cleaned', 3)
) as x(label, sort_order);


with cat as (select id from categories where slug = 'business-content')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'content-creator-session', 'Content Creator',
  'UGC, social media content, product shoots and more.',
  'A content creator produces short-form video or photo content for your brand or ' ||
  'personal use — product demos, testimonials, social clips. Scope (number of pieces, ' ||
  'usage rights) is agreed with your creator before the shoot.',
  'fixed', 'on_site_customer_present', 400000, 48
from cat;

with s as (select id from services where slug = 'content-creator-session')
insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, x.included, x.sort_order from s, (values
  ('On-site or remote content shoot', true, 1),
  ('Basic editing of delivered content', true, 2),
  ('Raw, unedited footage on request', false, 3),
  ('Paid ad usage rights beyond organic posting', false, 4)
) as x(label, included, sort_order);

with s as (select id from services where slug = 'content-creator-session')
insert into service_checklist_items (service_id, label, is_required, sort_order)
select id, x.label, true, x.sort_order from s, (values
  ('Shoot scope confirmed with the customer', 1),
  ('Content captured', 2),
  ('Edited content delivered', 3)
) as x(label, sort_order);


with cat as (select id from categories where slug = 'errands-tasks')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'errands-shopping', 'Errands & Shopping',
  'Shopping, pickups, deliveries and more.',
  'A general errand run — grocery shopping, picking up an item, or a short delivery ' ||
  'within the city. Item cost and any transport fare are settled directly with your ' ||
  'runner unless agreed otherwise in advance.',
  'fixed', 'representation', 350000, 24
from cat;

with s as (select id from services where slug = 'errands-shopping')
insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, x.included, x.sort_order from s, (values
  ('One errand run (shopping, pickup, or delivery) within the city', true, 1),
  ('Photo confirmation of items collected', true, 2),
  ('Cost of items purchased', false, 3),
  ('Trips outside the agreed area', false, 4)
) as x(label, included, sort_order);

with s as (select id from services where slug = 'errands-shopping')
insert into service_checklist_items (service_id, label, is_required, sort_order)
select id, x.label, true, x.sort_order from s, (values
  ('Errand confirmed with the customer', 1),
  ('Items collected / task completed', 2),
  ('Delivered or confirmed with the customer', 3)
) as x(label, sort_order);


with cat as (select id from categories where slug = 'remote-verification')
insert into services (category_id, slug, name, summary, description, pricing_model,
                       fulfilment_mode, base_price_minor, turnaround_hours)
select id, 'house-hunter', 'House Hunter',
  'We search, visit and shortlist properties for you.',
  'A professional searches available listings matching your criteria, visits the ' ||
  'strongest matches in person, and sends you a shortlist with real photos and honest ' ||
  'notes — before you spend a single weekend viewing places yourself.',
  'fixed', 'representation', 500000, 48
from cat;

with s as (select id from services where slug = 'house-hunter')
insert into service_scope_items (service_id, label, included, sort_order)
select id, x.label, x.included, x.sort_order from s, (values
  ('Search against your criteria (budget, area, size)', true, 1),
  ('In-person visits to shortlisted properties', true, 2),
  ('Photos and honest notes on each property', true, 3),
  ('Rent deposit or agent fees', false, 4)
) as x(label, included, sort_order);

with s as (select id from services where slug = 'house-hunter')
insert into service_checklist_items (service_id, label, is_required, sort_order)
select id, x.label, true, x.sort_order from s, (values
  ('Search criteria confirmed with the customer', 1),
  ('Properties visited', 2),
  ('Shortlist with photos and notes sent', 3)
) as x(label, sort_order);

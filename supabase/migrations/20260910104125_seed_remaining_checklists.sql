-- SECURITY.md's own "Known gaps" section flagged this: only the flagship
-- service (know-before-you-pay) had a full checklist, so
-- rpc_submit_completion had nothing to block on for the other three
-- seeded services — not a bug in the function, a real content gap. Each
-- checklist below is written to actually match that service's own
-- description (docs/summary already on the services row), not a
-- generic copy of the flagship's.

-- Landlord's Quarterly Check: "Condition check, utility meter readings,
-- tenant confirmation and a dated photo set every quarter."
insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, requires_note, sort_order) values
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Exterior photographed', 'Front of building, entrance, any visible external damage', true, true, false, 1),
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Every room photographed', 'One photo per room — note any change since the last visit', true, true, false, 2),
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Kitchen & bathroom condition photographed', 'Include appliances and plumbing fixtures', true, true, false, 3),
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Electricity meter reading recorded', 'Photograph the meter and note the reading', true, true, true, 4),
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Water meter reading recorded', 'Photograph the meter and note the reading', true, true, true, 5),
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Maintenance issues recorded', 'Photograph and describe any damage, leaks or wear found', true, false, false, 6),
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Smoke/safety devices checked', 'Confirm smoke detectors are present and functional', true, false, false, 7),
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Tenant confirmation obtained', 'If the tenant is present, note that they confirm the visit took place', true, false, true, 8),
  ('5826b765-7a7b-4b3b-8143-fc54baea056c', 'Provider declaration completed', 'Confirms the check was conducted in person as described', true, true, false, 9);

-- Viewed For You: "The provider attends, video-calls you in during the
-- viewing, and delivers a written report and photo set afterward."
insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, requires_note, sort_order) values
  ('0b6fd9bf-b6fd-4803-8435-d98b3ae30395', 'Arrived at viewing on time', 'Geotagged photo confirming arrival at the property', true, true, false, 1),
  ('0b6fd9bf-b6fd-4803-8435-d98b3ae30395', 'Live video call with customer completed', 'Note the call duration and what was shown', true, false, true, 2),
  ('0b6fd9bf-b6fd-4803-8435-d98b3ae30395', 'Exterior photographed', 'Front of building, entrance, street view', true, true, false, 3),
  ('0b6fd9bf-b6fd-4803-8435-d98b3ae30395', 'Every room photographed', 'Minimum one photo per room', true, true, false, 4),
  ('0b6fd9bf-b6fd-4803-8435-d98b3ae30395', 'Kitchen & bathroom photographed', 'Include appliances and fixtures', true, true, false, 5),
  ('0b6fd9bf-b6fd-4803-8435-d98b3ae30395', 'Provider observations noted', 'Selling points, concerns, or anything the customer should know', true, false, true, 6),
  ('0b6fd9bf-b6fd-4803-8435-d98b3ae30395', 'Provider declaration completed', 'Confirms the viewing was attended in person as described', true, true, false, 7);

-- Document & Physical Verification: "the provider collects or verifies a
-- specific physical item or document and couriers/reports back with
-- photographic proof of the exchange."
insert into service_checklist_items (service_id, label, help_text, is_required, requires_photo, requires_note, sort_order) values
  ('ab7dd3fe-6694-4696-a8af-3a916eee9935', 'Item or document identified', 'Confirm it matches what the customer requested', true, true, false, 1),
  ('ab7dd3fe-6694-4696-a8af-3a916eee9935', 'Condition photographed', 'Clear photo(s) showing the item or document''s current condition', true, true, false, 2),
  ('ab7dd3fe-6694-4696-a8af-3a916eee9935', 'Collection/verification location confirmed', 'Geotagged photo of the location', true, true, false, 3),
  ('ab7dd3fe-6694-4696-a8af-3a916eee9935', 'Proof of exchange photographed', 'Signature, receipt, or handover photo', true, true, false, 4),
  ('ab7dd3fe-6694-4696-a8af-3a916eee9935', 'Reference or serial number recorded', 'The item or document''s identifying number, if it has one', true, false, true, 5),
  ('ab7dd3fe-6694-4696-a8af-3a916eee9935', 'Delivery or courier arrangement noted', 'How and when it will reach the customer', true, false, true, 6),
  ('ab7dd3fe-6694-4696-a8af-3a916eee9935', 'Provider declaration completed', 'Confirms the verification was conducted in person as described', true, true, false, 7);

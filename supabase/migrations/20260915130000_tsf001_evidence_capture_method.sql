-- TSF-001: honest evidence-capture provenance. Previously the server
-- action hardcoded captured_in_app = true unconditionally, regardless of
-- how the file actually reached the browser (including a plain OS
-- gallery picker) — the admin UI's "not captured in-app" warning
-- (src/app/admin/bookings/[id]/page.tsx) has been dead code since day
-- one as a result. This adds a richer capture_method column the app now
-- sets honestly, and a constraint tying captured_in_app to it for every
-- row going forward.
alter table transaction_evidence add column capture_method text
  check (capture_method is null or capture_method in ('camera_stream', 'file_fallback'));

comment on column transaction_evidence.capture_method is
  'camera_stream = captured live via getUserMedia + canvas, never touched an OS file/gallery picker (the strong path). file_fallback = a generic file input, used only when getUserMedia is unavailable/denied, or for video evidence (no live-video capture UI yet). NULL = predates this column (rows from before 2026-09-15) — captured_in_app on those rows was unconditionally hardcoded true by a since-fixed bug and cannot be trusted as a real signal.';

-- Applies only to rows written from now on; historical rows (capture_method
-- is null) are intentionally left alone rather than retroactively rewriting
-- captured_in_app, which would fabricate a signal we don't actually have.
alter table transaction_evidence add constraint transaction_evidence_capture_consistency
  check (capture_method is null or captured_in_app = (capture_method = 'camera_stream'));

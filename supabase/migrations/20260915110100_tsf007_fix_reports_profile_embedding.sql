-- Same PGRST200 issue as 20260910154541_fix_postgrest_profile_embedding.sql:
-- reports.reporter_id/resolved_by reference auth.users(id) directly, which
-- PostgREST can't embed through. Retarget to profiles(id) so
-- `profiles:reporter_id(...)` works in the admin moderation queue.
alter table reports drop constraint reports_reporter_id_fkey;
alter table reports add constraint reports_reporter_id_fkey
  foreign key (reporter_id) references profiles(id);

alter table reports drop constraint reports_resolved_by_fkey;
alter table reports add constraint reports_resolved_by_fkey
  foreign key (resolved_by) references profiles(id);

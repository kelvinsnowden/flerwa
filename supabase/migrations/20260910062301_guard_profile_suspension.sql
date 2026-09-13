-- trg_profiles_guard_role already blocks a self-serve role change; found
-- while in the same function that is_suspended has no equivalent guard —
-- a suspended user could un-suspend themselves with a direct client
-- update, since "update own profile" has no column restriction. Same
-- fix, same trigger, same file.
create or replace function trg_profiles_guard_role() returns trigger
language plpgsql security definer as $$
begin
  if new.role is distinct from old.role then
    if not exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'Only an admin may change a user role.';
    end if;
  end if;
  if new.is_suspended is distinct from old.is_suspended then
    if not exists (
      select 1 from profiles p where p.id = auth.uid() and p.role = 'admin'
    ) then
      raise exception 'Only an admin may change suspension status.';
    end if;
  end if;
  return new;
end $$;

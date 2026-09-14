-- GOV-P1-P4 (MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md / MARKETPLACE_
-- REMEDIATION_REGISTER.md DECISIONS_REQUIRING_FOUNDER_OR_BUSINESS_APPROVAL):
-- founder decided to build the full role/permission matrix now, not defer
-- it. Grounded in the actual ~28 is_admin()-gated RPCs in this schema
-- (audited this pass), not invented: every one clusters naturally into
-- one of five domains below.
--
-- Design: additive, not a rewrite. is_admin() (profiles.role = 'admin')
-- remains the base account-type gate everywhere it already is — nothing
-- here removes it or changes its behavior. This migration adds a SEPARATE
-- admin_roles table (an admin can hold zero or more granular roles) plus
-- domain permission functions that each still require is_admin() AND
-- membership in the matching role (or super_admin, which bypasses every
-- domain check). Existing RPCs are retrofitted domain-by-domain across
-- this and follow-up migrations, not all at once — money-moving code
-- (payment confirmation, provider activation) gets its own careful pass
-- rather than being rushed through alongside everything else.

create type admin_role as enum (
  'super_admin',        -- every domain check passes; can grant/revoke roles
  'support_agent',      -- the support-ticket RPCs (§ notifications/support system)
  'finance_admin',      -- payment confirmation, ledger, payment-provider activation
  'trust_safety_admin', -- disputes, suspensions, verification, review moderation
  'ops_admin'           -- category/provider publish state, notification/verification channel selection
);

create table admin_roles (
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        admin_role not null,
  granted_by  uuid references profiles(id),
  granted_at  timestamptz not null default now(),
  primary key (profile_id, role)
);

alter table admin_roles enable row level security;

-- Any admin can see the full role roster (needed for the role-assignment
-- UI's "who has what" view and for building "who can approve this"
-- pickers elsewhere) — but only super_admin can write, via the RPCs below.
create policy "admin roles readable by admins" on admin_roles for select using (is_admin());

-- ---------------------------------------------------------------------
-- Permission functions. Each mirrors is_admin()'s own shape (sql stable
-- security definer) so they compose the same way in RLS policies and RPC
-- guard clauses throughout the schema.
-- ---------------------------------------------------------------------
create or replace function has_admin_role(p_role admin_role) returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_admin() and exists (
    select 1 from admin_roles
    where profile_id = (select auth.uid()) and (role = p_role or role = 'super_admin')
  );
$$;

create or replace function is_super_admin() returns boolean
language sql stable security definer
set search_path = public
as $$
  select is_admin() and exists (
    select 1 from admin_roles where profile_id = (select auth.uid()) and role = 'super_admin'
  );
$$;

create or replace function is_support_admin() returns boolean
language sql stable security definer set search_path = public as $$ select has_admin_role('support_agent'); $$;

create or replace function is_finance_admin() returns boolean
language sql stable security definer set search_path = public as $$ select has_admin_role('finance_admin'); $$;

create or replace function is_trust_safety_admin() returns boolean
language sql stable security definer set search_path = public as $$ select has_admin_role('trust_safety_admin'); $$;

create or replace function is_ops_admin() returns boolean
language sql stable security definer set search_path = public as $$ select has_admin_role('ops_admin'); $$;

-- ---------------------------------------------------------------------
-- Role assignment — super_admin only. Grandfathering (below) means the
-- existing admin account keeps full access through this migration; this
-- RPC is how the founder redistributes narrower roles afterward.
-- ---------------------------------------------------------------------
create or replace function rpc_grant_admin_role(p_profile_id uuid, p_role admin_role)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'Only a super admin may grant admin roles.'; end if;
  if not exists (select 1 from profiles where id = p_profile_id and role = 'admin') then
    raise exception 'Target account must already be an admin-type account (profiles.role = ''admin'').';
  end if;

  insert into admin_roles (profile_id, role, granted_by)
  values (p_profile_id, p_role, auth.uid())
  on conflict (profile_id, role) do nothing;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'grant_admin_role', 'admin_roles', p_profile_id, jsonb_build_object('role', p_role));
end $$;

create or replace function rpc_revoke_admin_role(p_profile_id uuid, p_role admin_role)
returns void
language plpgsql security definer set search_path = public as $$
begin
  if not is_super_admin() then raise exception 'Only a super admin may revoke admin roles.'; end if;

  -- Lockout guard: never let the last super_admin revoke their own (or
  -- anyone's) super_admin role, or every domain check in the app becomes
  -- unreachable to grant further roles at all.
  if p_role = 'super_admin' and (select count(*) from admin_roles where role = 'super_admin') <= 1 then
    raise exception 'Cannot revoke the last super admin.';
  end if;

  delete from admin_roles where profile_id = p_profile_id and role = p_role;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'revoke_admin_role', 'admin_roles', p_profile_id, jsonb_build_object('role', p_role));
end $$;

revoke all on function rpc_grant_admin_role(uuid, admin_role) from public, anon;
grant execute on function rpc_grant_admin_role(uuid, admin_role) to authenticated;
revoke all on function rpc_revoke_admin_role(uuid, admin_role) from public, anon;
grant execute on function rpc_revoke_admin_role(uuid, admin_role) to authenticated;

-- ---------------------------------------------------------------------
-- Grandfather every existing admin-type account as super_admin, so this
-- migration cannot lock anyone out of anything they could already do —
-- the founder narrows roles afterward via the RPCs above, deliberately,
-- not as a side effect of this migration running.
-- ---------------------------------------------------------------------
insert into admin_roles (profile_id, role)
select id, 'super_admin' from profiles where role = 'admin'
on conflict (profile_id, role) do nothing;

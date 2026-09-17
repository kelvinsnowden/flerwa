-- Admin-configurable, encrypted-at-rest credential storage for the
-- Integrations system. Additive: this does NOT replace
-- payment_providers/verification_providers/notification_channels, which
-- remain the sole authority for "which provider is currently active" —
-- this table is only the credential layer those adapters read from before
-- falling back to process.env. Linked to those tables only by sharing the
-- same provider `key` string already used throughout src/lib/*/registry.ts.
--
-- ciphertext is application-encrypted (AES-256-GCM, see
-- src/lib/crypto/credential-encryption.ts) BEFORE it ever reaches this
-- table — the master key lives only in this deployment's env, never in
-- the database, so no RLS/pgcrypto trick here could decrypt it. metadata
-- holds only non-secret, display-safe data (masked previews, non-secret
-- field values like an email region or a public key) — every RPC and read
-- path below assumes metadata never carries a real secret.
create table public.integration_credentials (
  id uuid primary key default gen_random_uuid(),
  capability text not null check (capability in ('payment', 'verification', 'email', 'sms')),
  provider_key text not null,
  environment text not null default 'production' check (environment in ('sandbox', 'production')),
  ciphertext text not null,
  metadata jsonb not null default '{}'::jsonb,
  -- "Configured" once a row exists; "Disabled" is an explicit admin
  -- toggle distinct from deleting the credential entirely — resolveCredentials()
  -- only ever reads a row where enabled = true.
  enabled boolean not null default true,
  last_tested_at timestamptz,
  last_test_ok boolean,
  -- Sanitized only — never the raw vendor error if it could echo a secret.
  last_test_error_safe text,
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (capability, provider_key, environment)
);

alter table public.integration_credentials enable row level security;

-- Same pattern as payment_providers/verification_providers/notification_channels:
-- admin-only read via RLS, zero client write policies — every write goes
-- through a SECURITY DEFINER RPC below that re-checks is_admin() itself.
create policy "admin can read integration credentials"
  on public.integration_credentials for select
  using (is_admin());

create index integration_credentials_lookup_idx
  on public.integration_credentials (capability, provider_key, environment)
  where enabled;

-- Upsert: save (or rotate) a provider's credentials. Always resets any
-- prior test result — a new secret hasn't been proven to work yet, so a
-- stale "Connected" badge from the previous value must not carry over.
-- p_ciphertext must already be produced by encryptCredentialPayload() —
-- this function never sees plaintext and never touches crypto itself.
create or replace function public.rpc_save_integration_credential(
  p_capability text,
  p_provider_key text,
  p_environment text,
  p_ciphertext text,
  p_metadata jsonb
) returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_id uuid;
begin
  if not is_admin() then
    raise exception 'Only an admin can save integration credentials.';
  end if;

  insert into integration_credentials (
    capability, provider_key, environment, ciphertext, metadata,
    created_by, updated_by
  )
  values (
    p_capability, p_provider_key, p_environment, p_ciphertext, p_metadata,
    auth.uid(), auth.uid()
  )
  on conflict (capability, provider_key, environment) do update
    set ciphertext = excluded.ciphertext,
        metadata = excluded.metadata,
        updated_by = auth.uid(),
        updated_at = now(),
        last_tested_at = null,
        last_test_ok = null,
        last_test_error_safe = null
  returning id into v_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (
    auth.uid(), 'save_integration_credential', 'integration_credentials', v_id,
    jsonb_build_object('capability', p_capability, 'provider_key', p_provider_key, 'environment', p_environment)
  );

  return v_id;
end $$;

create or replace function public.rpc_set_integration_credential_enabled(
  p_id uuid,
  p_enabled boolean
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row integration_credentials%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can enable or disable an integration credential.';
  end if;

  select * into v_row from integration_credentials where id = p_id;
  if not found then raise exception 'Unknown integration credential %.', p_id; end if;

  update integration_credentials
    set enabled = p_enabled, updated_by = auth.uid(), updated_at = now()
    where id = p_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (
    auth.uid(), case when p_enabled then 'enable_integration_credential' else 'disable_integration_credential' end,
    'integration_credentials', p_id,
    jsonb_build_object('capability', v_row.capability, 'provider_key', v_row.provider_key, 'environment', v_row.environment)
  );
end $$;

create or replace function public.rpc_record_integration_credential_test(
  p_id uuid,
  p_ok boolean,
  p_error_safe text
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row integration_credentials%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can record an integration credential connection test.';
  end if;

  select * into v_row from integration_credentials where id = p_id;
  if not found then raise exception 'Unknown integration credential %.', p_id; end if;

  update integration_credentials
    set last_tested_at = now(), last_test_ok = p_ok, last_test_error_safe = p_error_safe
    where id = p_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (
    auth.uid(), 'test_integration_credential_connection', 'integration_credentials', p_id,
    jsonb_build_object('capability', v_row.capability, 'provider_key', v_row.provider_key, 'environment', v_row.environment, 'ok', p_ok, 'error', p_error_safe)
  );
end $$;

create or replace function public.rpc_delete_integration_credential(
  p_id uuid
) returns void
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_row integration_credentials%rowtype;
begin
  if not is_admin() then
    raise exception 'Only an admin can delete an integration credential.';
  end if;

  select * into v_row from integration_credentials where id = p_id;
  if not found then raise exception 'Unknown integration credential %.', p_id; end if;

  delete from integration_credentials where id = p_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (
    auth.uid(), 'delete_integration_credential', 'integration_credentials', p_id,
    jsonb_build_object('capability', v_row.capability, 'provider_key', v_row.provider_key, 'environment', v_row.environment)
  );
end $$;

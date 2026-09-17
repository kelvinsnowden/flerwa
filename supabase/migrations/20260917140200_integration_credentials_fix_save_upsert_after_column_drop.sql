-- Bug: the previous cleanup migration dropped last_tested_at/last_test_ok/
-- last_test_error_safe from integration_credentials but left
-- rpc_save_integration_credential's ON CONFLICT clause resetting them —
-- every upsert (including the very first save) failed with "column does
-- not exist". Caught by testing the save path end-to-end before shipping.
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
        updated_at = now()
  returning id into v_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (
    auth.uid(), 'save_integration_credential', 'integration_credentials', v_id,
    jsonb_build_object('capability', p_capability, 'provider_key', p_provider_key, 'environment', p_environment)
  );

  return v_id;
end $$;

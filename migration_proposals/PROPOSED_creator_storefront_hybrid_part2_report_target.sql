-- =====================================================================
-- Hybrid creator storefront (Option C) — part 2 of 2.
-- PROPOSED, NOT APPLIED. Do not apply without explicit authorization.
--
-- MUST be applied in a SEPARATE transaction, strictly after
-- PROPOSED_creator_storefront_hybrid.sql (part 1) has been applied and
-- committed. Part 1 adds 'portfolio_item' and 'social_highlight' to the
-- report_target_type enum; Postgres will not let this file's function
-- body reference those values if it runs in the same transaction that
-- added them ("unsafe use of new value ... New enum values must be
-- committed before they can be used" — verified live against production
-- on 2026-09-15). Running these as two ordinary, separately-applied
-- migration files satisfies that requirement with no special handling.
-- =====================================================================
create or replace function can_report_target(p_target_type report_target_type, p_target_id uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case p_target_type
    when 'message' then exists (
      select 1 from messages m
      left join service_transactions t on t.id = m.transaction_id
      left join conversations c on c.id = m.conversation_id
      left join providers pt on pt.id = t.provider_id
      left join providers pc on pc.id = c.provider_id
      where m.id = p_target_id
        and (
          t.customer_id = auth.uid() or pt.user_id = auth.uid()
          or c.customer_id = auth.uid() or pc.user_id = auth.uid()
        )
    )
    when 'review' then exists (select 1 from reviews where id = p_target_id)
    when 'provider_profile' then exists (select 1 from providers where id = p_target_id)
    when 'customer_profile' then exists (
      select 1 from service_transactions t join providers p on p.id = t.provider_id
      where t.customer_id = p_target_id and p.user_id = auth.uid()
    ) or exists (
      select 1 from conversations c join providers p on p.id = c.provider_id
      where c.customer_id = p_target_id and p.user_id = auth.uid()
    )
    when 'portfolio_item' then exists (
      select 1 from provider_portfolio_items where id = p_target_id and is_public and not is_hidden
    )
    when 'social_highlight' then exists (
      select 1 from provider_social_highlights where id = p_target_id and is_public and not is_hidden
    )
    else false
  end;
$$;

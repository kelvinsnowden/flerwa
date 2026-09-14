-- MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md REV-K1/K3: reviews had no admin
-- queue and no moderation mechanism at all — "reviews public read" is
-- unconditional (qual: true), so every review, including an abusive one,
-- was visible to everyone with no way to hide it. Adds is_hidden and
-- narrows the public-read policy to respect it (admins still see
-- everything, including hidden reviews, for the moderation queue itself).
-- This narrows an existing policy rather than weakening it — a
-- non-hidden review is exactly as visible as before; only a newly-hidden
-- one changes behavior, and only because an admin explicitly hid it.
alter table reviews add column is_hidden boolean not null default false;

drop policy "reviews public read" on reviews;
create policy "reviews public read" on reviews for select using (not is_hidden or is_admin());

create or replace function rpc_admin_set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not is_admin() then raise exception 'Only an admin can hide or unhide a review.'; end if;
  if p_reason is null or btrim(p_reason) = '' then
    raise exception 'A reason is required to hide or unhide a review.';
  end if;
  if not exists (select 1 from reviews where id = p_review_id) then
    raise exception 'Review not found.';
  end if;

  update reviews set is_hidden = p_hidden where id = p_review_id;

  insert into admin_actions (admin_id, action, target_table, target_id, payload)
  values (auth.uid(), 'set_review_hidden', 'reviews', p_review_id, jsonb_build_object('hidden', p_hidden, 'reason', p_reason));
end $$;

revoke execute on function rpc_admin_set_review_hidden(uuid, boolean, text) from public, anon;
grant execute on function rpc_admin_set_review_hidden(uuid, boolean, text) to authenticated;

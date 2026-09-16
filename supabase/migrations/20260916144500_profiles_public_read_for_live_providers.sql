-- Storefronts have always embedded profiles.avatar_url for anonymous
-- visitors (src/app/provider/[slug]/page.tsx), which only ever worked
-- because PostgREST silently returns null for an RLS-blocked embed
-- rather than erroring — meaning anonymous storefront viewers likely
-- never actually saw a provider's photo. Resolving storefront URLs by
-- username (profiles.username) makes this a hard requirement rather
-- than a silent degradation: an anonymous visitor must be able to read
-- profiles.username (and avatar_url) for a provider's account before
-- the storefront route can even find the right row.
--
-- Row-level policy, matching this codebase's existing RLS pattern
-- (see "providers public read"): readable only when the linked
-- provider is genuinely live (published + verified), same gate the
-- storefront page itself already enforces in application code. This
-- does not column-restrict the row at the database layer — every
-- query against profiles in this codebase (this migration included)
-- must keep selecting only safe columns (avatar_url, username), never
-- email/phone/national data, the same discipline already relied on for
-- the existing avatar_url embed.
create policy "profiles public read for live providers" on profiles for select
using (
  exists (
    select 1 from providers p
    where p.user_id = profiles.id
      and p.is_published
      and p.verification_status = 'verified'
  )
);

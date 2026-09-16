-- Custom/Other services: a provider whose specialty doesn't fit the 5
-- fixed categories can now create their own services row, not just
-- browse/quote on customer task requests (the previously-deliberate,
-- now-superseded scope decision — see MARKETPLACE_UX_AUDIT.md §13).
-- Deliberately reuses the existing services/provider_services tables
-- rather than a parallel system: a custom service behaves exactly like
-- a catalog one everywhere downstream (rpc_book_service, the storefront,
-- provider_services pricing) because nothing downstream distinguishes
-- them — is_custom is only consulted by the write-side RLS below.
alter table services add column is_custom boolean not null default false;
alter table services add column created_by_provider_id uuid references providers(id);

-- The existing "services admin write" policy (is_admin(), for ALL
-- commands) is untouched — this adds a second, narrower permissive
-- policy for providers, which Postgres OR's together with the admin
-- one rather than replacing it. A provider can only ever insert/update
-- a row that is both flagged custom and owned by their own provider_id
-- — never an admin-curated catalog service, never another provider's
-- custom one.
create policy "providers can create their own custom services" on services for insert
with check (
  is_custom
  and exists (select 1 from providers p where p.id = created_by_provider_id and p.user_id = auth.uid())
);

create policy "providers can update their own custom services" on services for update
using (
  is_custom
  and exists (select 1 from providers p where p.id = created_by_provider_id and p.user_id = auth.uid())
)
with check (
  is_custom
  and exists (select 1 from providers p where p.id = created_by_provider_id and p.user_id = auth.uid())
);

-- The 6th, deliberately-last category. requires_clearance stays true —
-- a custom service still needs the same admin category-clearance step
-- (provider_categories.is_cleared) as any other category before
-- rpc_book_service will accept a booking against it, same trust gate,
-- no bypass for custom listings.
insert into categories (slug, name, vertical, description, is_active, requires_clearance, sort_order)
values ('other', 'Other / Custom', 'business_services', 'A specialty that does not fit the categories above.', true, true, 100);

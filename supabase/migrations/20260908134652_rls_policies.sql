-- =====================================================================
-- Row Level Security. Default deny on every table.
-- Rule: client never sets price, payment state, verification, role,
-- reputation or completion. All of that flows through SECURITY DEFINER
-- functions in the next migration, never through direct table writes.
-- =====================================================================

alter table profiles enable row level security;
alter table locations enable row level security;
alter table categories enable row level security;
alter table services enable row level security;
alter table service_scope_items enable row level security;
alter table service_checklist_items enable row level security;
alter table providers enable row level security;
alter table provider_verifications enable row level security;
alter table provider_categories enable row level security;
alter table provider_services enable row level security;
alter table provider_service_areas enable row level security;
alter table reliability_scores enable row level security;
alter table service_transactions enable row level security;
alter table transaction_scope_items enable row level security;
alter table transaction_checklist_results enable row level security;
alter table transaction_evidence enable row level security;
alter table transaction_events enable row level security;
alter table payments enable row level security;
alter table payment_events enable row level security;
alter table ledger_entries enable row level security;
alter table reviews enable row level security;
alter table disputes enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table deal_desk_requests enable row level security;
alter table service_requests enable row level security;
alter table quotes enable row level security;
alter table saved_providers enable row level security;
alter table admin_actions enable row level security;

-- ---------- helper: is the current user an admin? ----------
create or replace function is_admin() returns boolean
language sql security definer stable set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;

create or replace function is_txn_participant(txn_id uuid) returns boolean
language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from service_transactions t
    left join providers p on p.id = t.provider_id
    where t.id = txn_id
      and (t.customer_id = auth.uid() or p.user_id = auth.uid())
  );
$$;

-- ---------- profiles ----------
create policy "read own profile" on profiles for select using (id = auth.uid() or is_admin());
create policy "update own profile" on profiles for update using (id = auth.uid() or is_admin());
-- role changes are further gated by trg_profiles_guard_role regardless of this policy

-- ---------- public catalogue: readable by everyone, writable by admin only ----------
create policy "locations readable" on locations for select using (true);
create policy "locations admin write" on locations for all using (is_admin()) with check (is_admin());

create policy "categories readable" on categories for select using (is_active or is_admin());
create policy "categories admin write" on categories for all using (is_admin()) with check (is_admin());

create policy "services readable" on services for select using (is_active or is_admin());
create policy "services admin write" on services for all using (is_admin()) with check (is_admin());

create policy "scope items readable" on service_scope_items for select using (true);
create policy "scope items admin write" on service_scope_items for all using (is_admin()) with check (is_admin());

create policy "checklist readable" on service_checklist_items for select using (true);
create policy "checklist admin write" on service_checklist_items for all using (is_admin()) with check (is_admin());

-- ---------- providers: public storefront if published+verified; full access to self+admin ----------
create policy "providers public read" on providers
  for select using (is_published and verification_status = 'verified');
create policy "providers self read" on providers
  for select using (user_id = auth.uid() or is_admin());
create policy "providers self insert" on providers
  for insert with check (user_id = auth.uid());
create policy "providers self update" on providers
  for update using (user_id = auth.uid() or is_admin());
comment on policy "providers self update" on providers is
  'Provider can edit their own listing content, but verification_status is separately guarded — see rpc functions.';

create policy "verifications self/admin read" on provider_verifications
  for select using (
    is_admin() or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
  );
create policy "verifications self insert" on provider_verifications
  for insert with check (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()));
create policy "verifications admin update" on provider_verifications
  for update using (is_admin());

create policy "provider_categories public read" on provider_categories
  for select using (is_cleared or is_admin() or
    exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()));
create policy "provider_categories admin write" on provider_categories
  for all using (is_admin()) with check (is_admin());

create policy "provider_services public read" on provider_services for select using (is_active or is_admin());
create policy "provider_services self write" on provider_services
  for all using (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin())
  with check (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin());

create policy "provider_service_areas public read" on provider_service_areas for select using (true);
create policy "provider_service_areas self write" on provider_service_areas
  for all using (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin())
  with check (exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid()) or is_admin());

create policy "reliability public read" on reliability_scores for select using (true);
-- no insert/update policy for anyone but admin/service-role: reliability is recomputed server-side only
create policy "reliability admin write" on reliability_scores for all using (is_admin()) with check (is_admin());

-- ---------- service_transactions: strictly participants + admin ----------
create policy "txn participants read" on service_transactions
  for select using (
    customer_id = auth.uid()
    or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
    or is_admin()
  );
create policy "txn customer create" on service_transactions
  for insert with check (customer_id = auth.uid());
comment on policy "txn customer create" on service_transactions is
  'Client may create a DRAFT transaction. It carries no price authority — server functions set amounts and every state transition thereafter. See rpc_* functions.';
-- No generic UPDATE policy: all state/price changes go through SECURITY DEFINER rpc_* functions only.
create policy "txn admin update" on service_transactions for update using (is_admin());

create policy "scope items participants read" on transaction_scope_items
  for select using (is_txn_participant(transaction_id) or is_admin());
create policy "scope items admin write" on transaction_scope_items for all using (is_admin()) with check (is_admin());

create policy "checklist results participants read" on transaction_checklist_results
  for select using (is_txn_participant(transaction_id) or is_admin());
-- providers may mark their own checklist results complete; customers cannot forge completion
create policy "checklist results provider write" on transaction_checklist_results
  for all using (
    is_admin() or exists (
      select 1 from service_transactions t join providers p on p.id = t.provider_id
      where t.id = transaction_id and p.user_id = auth.uid()
    )
  )
  with check (
    is_admin() or exists (
      select 1 from service_transactions t join providers p on p.id = t.provider_id
      where t.id = transaction_id and p.user_id = auth.uid()
    )
  );

-- ---------- evidence: participants read; only the provider (or admin) may upload ----------
create policy "evidence participants read" on transaction_evidence
  for select using (is_txn_participant(transaction_id) or is_admin());
create policy "evidence provider insert" on transaction_evidence
  for insert with check (
    uploaded_by = auth.uid() and (
      is_admin() or exists (
        select 1 from service_transactions t join providers p on p.id = t.provider_id
        where t.id = transaction_id and p.user_id = auth.uid()
      )
    )
  );
comment on policy "evidence provider insert" on transaction_evidence is
  'Only the assigned provider (or admin) uploads evidence for a transaction — this is what "the provider must prove what they did" means at the RLS layer.';

-- ---------- events: append-only, participant-readable, insert via functions only ----------
create policy "events participants read" on transaction_events
  for select using (is_txn_participant(transaction_id) or is_admin());
-- No direct insert policy for authenticated users: events are written exclusively by
-- SECURITY DEFINER rpc_* functions, which run as the function owner and bypass RLS by design.

-- ---------- payments: participants read; NO client insert/update at all ----------
create policy "payments participants read" on payments
  for select using (is_txn_participant(transaction_id) or is_admin());
comment on table payments is
  'No INSERT/UPDATE policy for regular users. A payment can only be confirmed by an admin (rpc_confirm_manual_payment) or a verified webhook using the service role. The browser cannot mark a payment funded.';

create policy "payment_events admin read" on payment_events for select using (is_admin());

-- ---------- ledger: read-only for participants of the related transaction; no client writes ever ----------
create policy "ledger participants read" on ledger_entries
  for select using (
    is_admin() or (transaction_id is not null and is_txn_participant(transaction_id))
  );
-- Intentionally no insert/update/delete policy for any non-service-role caller.

-- ---------- reviews: only from settled/reviewed transactions, only by a participant, about the other party ----------
create policy "reviews public read" on reviews for select using (true);
create policy "reviews participant insert" on reviews
  for insert with check (
    reviewer_id = auth.uid()
    and is_txn_participant(transaction_id)
    and reviewee_id <> auth.uid()
    and exists (
      select 1 from service_transactions t
      where t.id = transaction_id and t.state in ('settled','reviewed','closed')
    )
  );
comment on policy "reviews participant insert" on reviews is
  'Gates the blueprint rule: reputation only from escrow-settled transactions. See docs/06-trust-architecture.md.';

-- ---------- disputes ----------
create policy "disputes participants read" on disputes
  for select using (is_txn_participant(transaction_id) or is_admin());
create policy "disputes participant open" on disputes
  for insert with check (opened_by = auth.uid() and is_txn_participant(transaction_id));
create policy "disputes admin update" on disputes for update using (is_admin());

-- ---------- messages: participants only ----------
create policy "messages participants read" on messages
  for select using (is_txn_participant(transaction_id) or is_admin());
create policy "messages participant send" on messages
  for insert with check (sender_id = auth.uid() and is_txn_participant(transaction_id));

-- ---------- notifications: strictly own ----------
create policy "notifications own read" on notifications for select using (user_id = auth.uid());
create policy "notifications own update" on notifications for update using (user_id = auth.uid());
-- insert only via SECURITY DEFINER functions/triggers

-- ---------- deal desk ----------
create policy "deal desk provider read/write" on deal_desk_requests
  for all using (
    is_admin() or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
  )
  with check (
    is_admin() or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
  );

-- ---------- service requests / quotes ----------
create policy "requests customer read/write own" on service_requests
  for all using (customer_id = auth.uid() or is_admin())
  with check (customer_id = auth.uid() or is_admin());
create policy "requests providers read open" on service_requests
  for select using (state = 'open' or is_admin());

create policy "quotes provider own read/write" on quotes
  for all using (
    is_admin() or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
  )
  with check (
    is_admin() or exists (select 1 from providers p where p.id = provider_id and p.user_id = auth.uid())
  );
create policy "quotes customer read on own request" on quotes
  for select using (
    exists (select 1 from service_requests r where r.id = request_id and r.customer_id = auth.uid())
  );

-- ---------- saved providers ----------
create policy "saved providers own" on saved_providers
  for all using (customer_id = auth.uid()) with check (customer_id = auth.uid());

-- ---------- admin actions: admin only, insert via function ----------
create policy "admin actions admin read" on admin_actions for select using (is_admin());

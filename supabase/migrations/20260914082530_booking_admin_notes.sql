-- MARKETPLACE_ADMIN_CAPABILITY_MATRIX.md BK-B9: no way to leave an
-- internal note on a booking for the next admin who looks at it. Simple,
-- append-only (no update/delete policy — a wrong note gets superseded by
-- a new one, not edited, matching the append-only ethos already used for
-- transaction_events/admin_actions/ledger_entries), admin-only in both
-- directions (never customer/provider visible — this is a support-team
-- tool, not case correspondence).
create table booking_notes (
  id uuid primary key default gen_random_uuid(),
  transaction_id uuid not null references service_transactions(id),
  admin_id uuid not null references auth.users(id),
  note text not null,
  created_at timestamptz not null default now()
);

create index booking_notes_transaction_idx on booking_notes(transaction_id, created_at);

alter table booking_notes enable row level security;

create policy "booking notes admin read" on booking_notes for select using (is_admin());
create policy "booking notes admin insert" on booking_notes for insert with check (is_admin() and admin_id = auth.uid());

revoke all on booking_notes from public, anon;
grant select, insert on booking_notes to authenticated;

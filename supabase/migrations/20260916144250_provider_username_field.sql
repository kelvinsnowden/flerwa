-- Real username field, distinct from full_name/providers.display_name.
-- Lives on profiles (account-level, not providers) because one account
-- can be both customer and provider, and a username identifies the
-- account, not a specific provider row. Nullable, not backfilled: no
-- fake/derived username is assigned to existing accounts, per explicit
-- instruction not to invent handles that could misidentify a real
-- person — the storefront route keeps serving existing providers.slug
-- URLs until an account owner explicitly sets a username.
--
-- Lowercase-only by construction: the format check itself only accepts
-- [a-z0-9_], so there is no separate normalization step to bypass —
-- any writer (this app, a future admin tool, a direct API call) that
-- tries to store mixed case fails the constraint, not just the app's
-- own lowercasing. 3-30 chars, must start with a letter.
alter table profiles add column username text;

alter table profiles
  add constraint profiles_username_format
  check (username is null or username ~ '^[a-z][a-z0-9_]{2,29}$');

create unique index profiles_username_unique_idx on profiles (username) where username is not null;

comment on column profiles.username is
  'Unique, user-chosen platform handle (lowercase enforced by profiles_username_format). Distinct from full_name and providers.display_name. Nullable and not backfilled for pre-existing accounts.';

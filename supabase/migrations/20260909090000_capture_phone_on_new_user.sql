-- =====================================================================
-- Phone + OTP is now the primary auth path (see design-references/mobile/
-- 01-login.png, 02-otp.png). trg_handle_new_user previously only copied
-- email + full_name from auth.users into profiles on signup, so a
-- phone-only signup (auth.users.phone set, auth.users.email null) left
-- profiles.phone permanently null even though the user has a verified
-- phone number — every screen that reads profiles.phone (account page,
-- booking contact info) would show it missing. Copy new.phone too.
-- =====================================================================
create or replace function public.trg_handle_new_user()
 returns trigger
 language plpgsql
 security definer
 set search_path to 'public'
as $function$
begin
  insert into public.profiles (id, email, full_name, phone)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name', new.phone);
  return new;
end
$function$

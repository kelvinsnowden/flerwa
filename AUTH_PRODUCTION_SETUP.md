# Auth Production Setup

What's configured today, what's missing, and exactly what needs to change in
the Supabase dashboard to make phone + OTP — the app's primary,
documented authentication experience — actually work for a real user.
Nothing in this document is a code change; every item here is Supabase
project configuration.

## 1. Current state

| Path | Status |
|---|---|
| Email + password (`/login/email`, `/signup`) | **Working in production.** Real signups, real Supabase-sent confirmation emails, real session creation after confirmation. |
| Phone + OTP (`/login`, `/login/verify`) | **Not usable by any real user yet.** The UI is built and correct; `supabase.auth.signInWithOtp({ phone })` fails because no SMS provider is configured on the Supabase project. |

The app code never sends an SMS and never sees a code — it calls
`supabase.auth.signInWithOtp({ phone })` and `supabase.auth.verifyOtp({
phone, token, type: "sms" })` in `src/app/login/phone-actions.ts` and lets
Supabase Auth do everything else server-side. This means fixing phone OTP is
entirely a Supabase dashboard task, not a code task — see `SECURITY.md`
("Phone + OTP authentication") for the full technical writeup of why the app
is built this way.

## 2. What's missing: an SMS provider

Supabase Auth's phone provider needs a real SMS vendor account behind it.
Supabase's supported vendors: **Twilio**, **Twilio Verify**, **MessageBird**,
**Vonage**, **Textlocal**. None is connected to project `famdxoardiibonghxepl`
today — confirmed by reading the project's live Auth configuration, not
assumed.

### Required steps (Supabase Dashboard → Authentication → Providers → Phone)

1. Create an account with one of the supported vendors above. For Kenyan
   phone numbers, confirm the vendor can actually deliver to Safaricom/
   Airtel/Telkom Kenya routes before committing — not all vendors have
   reliable East Africa SMS delivery, and this should be checked with the
   vendor directly before picking one.
2. In the vendor's own console, provision:
   - An account SID / API key + auth token (the credential pair Supabase
     asks for).
   - A sender — either a purchased phone number capable of sending SMS to
     Kenya, or an approved alphanumeric sender ID where the vendor/route
     supports it.
3. In Supabase Dashboard → Authentication → Providers → **Phone**:
   - Toggle the provider on.
   - Select the vendor (e.g. Twilio).
   - Enter the Account SID, Auth Token, and Message Service SID / sender
     number.
   - Save.
4. Confirm the OTP template/expiry under Authentication → Templates (the
   default 6-digit code, 60s resend cooldown is what the UI already assumes
   — `src/app/login/verify` doesn't hardcode a digit count itself, so a
   vendor-side change here needs no code change either way, but worth
   checking it matches).
5. Budget for per-SMS cost. This is a paid, metered service — no vendor here
   sends SMS for free at any real volume.

**Until this is done**, `signInWithOtp` will keep failing with a real error
from Supabase's Auth API, and the UI will keep surfacing that error honestly
on the phone-entry screen (verified live — it does not pretend a code was
sent).

## 3. Production test procedure

Once a vendor is connected:

1. From a real, non-test device, go to the production URL's `/login`.
2. Enter a real Kenyan phone number (`+254...`) and submit.
3. Confirm an SMS actually arrives within ~30 seconds.
4. Enter the received code on `/login/verify`.
5. Confirm a session is created (redirect to `/onboarding` for a first-time
   user, or `/` for a returning one) and `profiles.phone` is populated
   (fixed in `20260909090000_capture_phone_on_new_user.sql` — verify this
   still holds after any future auth schema change).
6. Confirm a second OTP request within the vendor's resend window is rate-
   limited sanely (Supabase Auth applies its own default rate limits on top
   of whatever the vendor enforces) rather than silently failing.

Do this with at least two different real numbers on two different Kenyan
carriers before calling phone OTP launch-ready — carrier-specific delivery
failures are the most common real-world SMS provider issue and won't show up
testing on one carrier alone.

## 4. Development / QA test procedure (no real SMS spend)

Use Supabase's own built-in mechanism — this is the *only* sanctioned way to
exercise the phone flow without a live SMS vendor connected. There is no
custom dev-bypass in this codebase and there should never be one.

1. Supabase Dashboard → Authentication → Settings → **Test Phone Numbers**
   (under the Phone provider's settings).
2. Register a specific test phone number (e.g. `+254700000000`) with a fixed
   OTP (e.g. `123456`).
3. In the app, enter that exact test number on `/login`.
4. Enter the fixed test OTP on `/login/verify`.
5. Supabase accepts it without sending a real SMS or requiring any vendor to
   be configured at all — useful for exercising the phone-OTP code path
   (session creation, `profiles.phone` capture, first-time vs. returning
   routing) independent of vendor setup.

This mechanism is Supabase's own, clearly labeled as test/sandbox in their
UI, lives entirely in project settings (never in this repository), and
cannot be mistaken for a production credential. It was already used this
way during earlier development passes on this project — see `SECURITY.md`.

## 5. What NOT to do

- Do not hardcode an OTP anywhere in the codebase.
- Do not add a "dev mode" flag that skips `verifyOtp`.
- Do not build a custom SMS-sending mechanism outside Supabase Auth's own
  phone provider — that would mean this app generating/storing/verifying
  codes itself, which is a materially different (and materially riskier)
  authentication design than what's built and documented today.
- Do not bypass authentication to "test" phone OTP in production — use
  Supabase's Test Phone Numbers mechanism (§4) instead.

## 6. Summary

| Item | Status |
|---|---|
| App code (`signInWithOtp` / `verifyOtp`) | Done, correct, unchanged since last review |
| `profiles.phone` capture on signup | Done (`20260909090000_capture_phone_on_new_user.sql`) |
| SMS vendor account | **Missing — needs a real Twilio/MessageBird/Vonage/Textlocal account** |
| Supabase Phone provider configuration | **Missing — blocked on the above** |
| Dev/QA path without a vendor | Available today via Supabase Test Phone Numbers |

**This is the single blocker standing between phone OTP and production
readiness.** Everything else in that path — UI, session handling, profile
capture, RLS — is already built and already verified.

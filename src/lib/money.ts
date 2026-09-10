/**
 * The ONLY place money is formatted for display. Amounts are always
 * integer minor units (real cents — 100 minor = 1 KES; confirmed against
 * seed data: services.base_price_minor is 600000 for the service the
 * reference mockups show as "KSh 6,000"). This used to skip the actual
 * /100 conversion despite the comment here already saying "minor
 * units" — every price in the app was rendering 100x too large. Went
 * undetected all session because this sandbox's dev server has never
 * been able to reach Supabase to render a real page with a real price;
 * caught by cross-checking a raw DB value against the mockup's price
 * while building the Deal Desk admin conversion form.
 */
export function formatMoney(amountMinor: number, currency = "KES"): string {
  const amount = amountMinor / 100;
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

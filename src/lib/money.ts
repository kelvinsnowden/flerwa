/**
 * The ONLY place money is formatted for display. Amounts are always
 * integer minor units (cents/KES-cents-equivalent, i.e. whole shillings
 * for KES since it has no minor subunit in everyday use — stored as
 * amount_minor to keep the schema currency-agnostic for later expansion).
 */
export function formatMoney(amountMinor: number, currency = "KES"): string {
  const amount = amountMinor; // KES has no fractional minor unit in practice
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

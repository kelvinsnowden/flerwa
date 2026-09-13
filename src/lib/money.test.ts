import { describe, expect, it } from "vitest";
import { formatMoney } from "./money";

// Regression coverage for the specific bug documented in money.ts's own
// header comment: amountMinor was once rendered without the /100
// conversion, so every price in the app displayed 100x too large. That
// bug shipped undetected because this sandbox has never been able to
// reach Supabase to render a real page with a real price.
describe("formatMoney", () => {
  it("converts minor units to major units before formatting", () => {
    // services.base_price_minor 600000 -> "6,000" major units, matching the
    // "KSh 6,000" reference mockup price (exact "KSh"/"Ksh" capitalization
    // of the currency symbol is ICU-data-dependent, not app logic — see the
    // two assertions below, which pin the digits/grouping, the part that
    // regressed before).
    expect(formatMoney(600000)).toMatch(/^K[Ss]h\s6,000$/);
  });

  it("formats zero", () => {
    expect(formatMoney(0)).toMatch(/^K[Ss]h\s0$/);
  });

  it("rounds to whole currency units (no minor-unit fractions displayed)", () => {
    expect(formatMoney(150050)).toMatch(/^K[Ss]h\s1,50[01]$/);
  });

  it("supports a non-default currency code", () => {
    expect(formatMoney(100000, "USD")).toMatch(/1,000/);
  });
});

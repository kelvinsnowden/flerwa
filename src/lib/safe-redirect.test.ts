import { describe, expect, it } from "vitest";
import { safeNext } from "./safe-redirect";

// Authorization-boundary coverage: safeNext is the only thing standing
// between a "next" form field / query param an attacker fully controls and
// an open-redirect after login (per its own header comment). Every case
// here is a value a crafted login link could actually contain.
describe("safeNext", () => {
  it("allows a same-origin relative path", () => {
    expect(safeNext("/account")).toBe("/account");
  });

  it("allows a same-origin path with a query string", () => {
    expect(safeNext("/bookings?tab=active")).toBe("/bookings?tab=active");
  });

  it("rejects a protocol-relative URL (open-redirect via //)", () => {
    expect(safeNext("//evil.example.com")).toBe("/");
  });

  it("rejects an absolute external URL", () => {
    expect(safeNext("https://evil.example.com")).toBe("/");
  });

  it("rejects a javascript: pseudo-protocol", () => {
    expect(safeNext("javascript:alert(1)")).toBe("/");
  });

  it("rejects a value with no leading slash", () => {
    expect(safeNext("account")).toBe("/");
  });

  it("falls back on null", () => {
    expect(safeNext(null)).toBe("/");
  });

  it("falls back on empty string", () => {
    expect(safeNext("")).toBe("/");
  });

  it("honors a custom fallback", () => {
    expect(safeNext(null, "/login")).toBe("/login");
    expect(safeNext("//evil.example.com", "/login")).toBe("/login");
  });
});

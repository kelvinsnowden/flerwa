import { describe, expect, it } from "vitest";
import { formatKenyanPhoneDisplay, normalizeKenyanPhone } from "./phone";

// normalizeKenyanPhone feeds the phone-OTP auth path directly (src/app/login) —
// a malformed normalization either locks a real user out or, worse, lets an
// invalid number through to the OTP provider. Covers the three input shapes
// the login screen's own copy tells users to expect, plus the boundary/reject
// cases that shape depends on.
describe("normalizeKenyanPhone", () => {
  it("accepts a 9-digit national number starting with 7", () => {
    expect(normalizeKenyanPhone("712345678")).toBe("+254712345678");
  });

  it("accepts a 9-digit national number starting with 1", () => {
    expect(normalizeKenyanPhone("112345678")).toBe("+254112345678");
  });

  it("accepts a leading-zero local format", () => {
    expect(normalizeKenyanPhone("0712345678")).toBe("+254712345678");
  });

  it("accepts a full +254 international format", () => {
    expect(normalizeKenyanPhone("+254712345678")).toBe("+254712345678");
  });

  it("accepts a 254-prefixed format without the plus", () => {
    expect(normalizeKenyanPhone("254712345678")).toBe("+254712345678");
  });

  it("strips spaces before parsing", () => {
    expect(normalizeKenyanPhone("0712 345 678")).toBe("+254712345678");
  });

  it("rejects a national number not starting with 1 or 7", () => {
    expect(normalizeKenyanPhone("512345678")).toBeNull();
  });

  it("rejects a number that's too short", () => {
    expect(normalizeKenyanPhone("12345")).toBeNull();
  });

  it("rejects a number that's too long", () => {
    expect(normalizeKenyanPhone("07123456789")).toBeNull();
  });

  it("rejects a non-Kenyan country code", () => {
    expect(normalizeKenyanPhone("+15551234567")).toBeNull();
  });

  it("rejects empty input", () => {
    expect(normalizeKenyanPhone("")).toBeNull();
  });

  it("rejects non-digit garbage", () => {
    expect(normalizeKenyanPhone("not-a-phone")).toBeNull();
  });
});

describe("formatKenyanPhoneDisplay", () => {
  it("groups a normalized E.164 number for display", () => {
    expect(formatKenyanPhoneDisplay("+254712345678")).toBe("+254 712 345 678");
  });

  it("returns the input unchanged if it doesn't match the expected shape", () => {
    expect(formatKenyanPhoneDisplay("not-e164")).toBe("not-e164");
  });
});

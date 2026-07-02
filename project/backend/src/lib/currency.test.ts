import { convertMinor, fromEURMinor, isSupportedCurrency, toEURMinor } from "./currency";

import { describe, expect, it } from "bun:test";

describe("currency", () => {
  it("treats EUR as the identity rate", () => {
    expect(toEURMinor(2500, "EUR")).toBe(2500);
    expect(fromEURMinor(2500, "EUR")).toBe(2500);
  });

  it("converts USD minor units to EUR minor units", () => {
    // 1 EUR = 1.08 USD -> 1080 USD minor = 1000 EUR minor
    expect(toEURMinor(1080, "USD")).toBe(1000);
  });

  it("converts GBP minor units to EUR minor units", () => {
    // 1 EUR = 0.85 GBP -> 850 GBP minor = 1000 EUR minor
    expect(toEURMinor(850, "GBP")).toBe(1000);
  });

  it("round-trips a cross-currency conversion via the EUR bridge", () => {
    const usdMinor = 1080;
    const gbpMinor = convertMinor(usdMinor, "USD", "GBP");
    expect(gbpMinor).toBe(850);
  });

  it("is a no-op when converting a currency to itself", () => {
    expect(convertMinor(999, "GBP", "GBP")).toBe(999);
  });

  it("validates supported currencies", () => {
    expect(isSupportedCurrency("EUR")).toBe(true);
    expect(isSupportedCurrency("USD")).toBe(true);
    expect(isSupportedCurrency("JPY")).toBe(false);
  });
});

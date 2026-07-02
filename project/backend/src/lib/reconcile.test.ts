import { classify } from "./reconcile";

import { describe, expect, it } from "bun:test";

describe("reconcile classification", () => {
  it("classifies matched - same amount, currency, settled", () => {
    const side = { amountMinor: 2500, currency: "EUR", status: "settled" };
    expect(classify({ ...side, status: "completed" }, side)).toBe("matched");
  });

  it("classifies missingInProcessor - donation with no settlement", () => {
    expect(classify({ amountMinor: 2500, currency: "EUR", status: "completed" }, null)).toBe("missingInProcessor");
  });

  it("classifies missingInApp - settlement with no donation", () => {
    expect(classify(null, { amountMinor: 2500, currency: "EUR", status: "settled" })).toBe("missingInApp");
  });

  it("classifies mismatched - amount differs", () => {
    expect(classify({ amountMinor: 2500, currency: "EUR", status: "completed" }, { amountMinor: 2000, currency: "EUR", status: "settled" })).toBe("mismatched");
  });

  it("classifies mismatched - currency differs", () => {
    expect(classify({ amountMinor: 2500, currency: "EUR", status: "completed" }, { amountMinor: 2500, currency: "USD", status: "settled" })).toBe("mismatched");
  });

  it("classifies mismatched - settlement not settled", () => {
    expect(classify({ amountMinor: 2500, currency: "EUR", status: "completed" }, { amountMinor: 2500, currency: "EUR", status: "failed" })).toBe("mismatched");
  });
});

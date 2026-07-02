import { generatePaymentRef, generateReference } from "./reference";

import { describe, expect, it } from "bun:test";

describe("reference", () => {
  it("builds a <CAMP>-<base36x4> reference from the campaign name", () => {
    const ref = generateReference("Malta Food Bank");
    expect(ref).toMatch(/^MFB-[0-9A-Z]{4}$/);
  });

  it("falls back to a generic prefix for unusual names", () => {
    const ref = generateReference("!!!");
    expect(ref).toMatch(/^GT-[0-9A-Z]{4}$/);
  });

  it("caps the prefix at 3 letters for long names", () => {
    const ref = generateReference("The Blue Cross Society");
    expect(ref.split("-")[0]?.length).toBeLessThanOrEqual(3);
  });

  it("generates a unique-looking uuid payment ref", () => {
    const a = generatePaymentRef();
    const b = generatePaymentRef();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });
});

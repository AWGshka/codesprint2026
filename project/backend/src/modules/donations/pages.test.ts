import { DonationService } from "./service";

import { describe, expect, it } from "bun:test";

import { AppError } from "~/lib/errors";

// Pure parsing logic - no DB touchpoint, safe to test in isolation.
describe("DonationService.parsePagesSpec", () => {
  it("parses a single page number", () => {
    expect(DonationService.parsePagesSpec("5")).toEqual([{ from: 5, to: 5 }]);
  });

  it("parses a range", () => {
    expect(DonationService.parsePagesSpec("1-3")).toEqual([{ from: 1, to: 3 }]);
  });

  it("parses a mix of ranges and single pages", () => {
    expect(DonationService.parsePagesSpec("1-3,5")).toEqual([
      { from: 1, to: 3 },
      { from: 5, to: 5 },
    ]);
  });

  it("rejects garbage input with a 400 BAD_REQUEST", () => {
    expect(() => DonationService.parsePagesSpec("abc")).toThrow(AppError);
    expect(() => DonationService.parsePagesSpec("1;3")).toThrow(AppError);
    expect(() => DonationService.parsePagesSpec("1-")).toThrow(AppError);
    expect(() => DonationService.parsePagesSpec("")).toThrow(AppError);

    try {
      DonationService.parsePagesSpec("nope");
    } catch (e) {
      expect(e).toBeInstanceOf(AppError);
      expect((e as AppError).status).toBe(400);
      expect((e as AppError).code).toBe("BAD_REQUEST");
    }
  });

  it("rejects an inverted range", () => {
    expect(() => DonationService.parsePagesSpec("5-1")).toThrow(AppError);
  });

  it("rejects page 0", () => {
    expect(() => DonationService.parsePagesSpec("0")).toThrow(AppError);
  });
});

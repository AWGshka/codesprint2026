import { csvEscape, toCsv, toCsvRow } from "./csv";

import { describe, expect, it } from "bun:test";

describe("csv", () => {
  it("leaves plain values unquoted", () => {
    expect(csvEscape("hello")).toBe("hello");
    expect(csvEscape(42)).toBe("42");
  });

  it("renders null/undefined as an empty field", () => {
    expect(csvEscape(null)).toBe("");
    expect(csvEscape(undefined)).toBe("");
  });

  it("quotes and escapes fields containing commas, quotes, or newlines", () => {
    expect(csvEscape("a,b")).toBe('"a,b"');
    expect(csvEscape('say "hi"')).toBe('"say ""hi"""');
    expect(csvEscape("line1\nline2")).toBe('"line1\nline2"');
  });

  it("joins a row with commas", () => {
    expect(toCsvRow(["a", "b,c", 3])).toBe('a,"b,c",3');
  });

  it("builds a full CSV with a header row and CRLF line endings", () => {
    const csv = toCsv(
      ["name", "amount"],
      [
        ["Ann", 100],
        ["Bo, Jr.", 200],
      ],
    );
    expect(csv).toBe('name,amount\r\nAnn,100\r\n"Bo, Jr.",200\r\n');
  });
});

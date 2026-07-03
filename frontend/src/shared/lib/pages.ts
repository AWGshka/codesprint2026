/**
 * Client-side mirror of the backend's page-range grammar
 * (`project/backend/src/lib/pages.ts::parsePages`) — comma-separated single page numbers
 * and/or `a-b` ranges, 1-based, deduped + sorted. Throws a plain `Error` on anything invalid
 * (empty input, non-numeric, `0`, `a>b` ranges, empty segments like `"1,,2"`, trailing dash
 * `"1-"`) so callers can validate the same "1-3,5" input the server will ultimately parse.
 */
export function parsePages(input: string): number[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Pages input is empty");

  const pages = new Set<number>();
  for (const segment of trimmed.split(",")) {
    const part = segment.trim();
    if (!part) throw new Error("Empty page segment");

    if (part.includes("-")) {
      const rangeParts = part.split("-");
      if (rangeParts.length !== 2) throw new Error(`Invalid range "${part}"`);
      const [fromRaw, toRaw] = rangeParts;
      if (!fromRaw || !toRaw) throw new Error(`Invalid range "${part}"`);
      const from = Number(fromRaw);
      const to = Number(toRaw);
      if (!Number.isInteger(from) || !Number.isInteger(to) || from < 1 || to < 1 || from > to) throw new Error(`Invalid range "${part}"`);
      for (let n = from; n <= to; n++) pages.add(n);
    } else {
      const n = Number(part);
      if (!Number.isInteger(n) || n < 1) throw new Error(`Invalid page "${part}"`);
      pages.add(n);
    }
  }

  return [...pages].sort((a, b) => a - b);
}

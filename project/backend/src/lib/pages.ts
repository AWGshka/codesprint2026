// Pure helper: parses a "pages" query param like "2" or "1-3,5" into a
// sorted, deduped list of 1-based page numbers. Used by the CSV export route
// to scope the export to specific pages of the same paginated view the user
// is looking at, without touching the DB.
export const parsePages = (input: string): number[] => {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Empty pages spec");

  const pages = new Set<number>();

  for (const rawPart of trimmed.split(",")) {
    const part = rawPart.trim();
    if (!part) throw new Error(`Invalid pages spec segment: "${rawPart}"`);

    const rangeMatch = /^(\d+)-(\d+)$/.exec(part);
    if (rangeMatch) {
      const start = Number(rangeMatch[1]);
      const end = Number(rangeMatch[2]);
      if (start < 1 || end < 1 || start > end) throw new Error(`Invalid page range: "${part}"`);
      for (let p = start; p <= end; p++) pages.add(p);
      continue;
    }

    if (!/^\d+$/.test(part)) throw new Error(`Invalid page number: "${part}"`);
    const value = Number(part);
    if (value < 1) throw new Error(`Invalid page number: "${part}"`);
    pages.add(value);
  }

  return [...pages].sort((a, b) => a - b);
};

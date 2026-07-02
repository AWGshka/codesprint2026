// Hand-rolled CSV (per findings A10 - no dependency). RFC 4180-ish: a field is
// quoted (and internal quotes doubled) if it contains a comma, quote, or
// newline; everything else is emitted bare.
export const csvEscape = (value: unknown): string => {
  const str = value === null || value === undefined ? "" : String(value);
  if (/[",\n\r]/.test(str)) return `"${str.replace(/"/g, '""')}"`;

  return str;
};

export const toCsvRow = (values: unknown[]): string => values.map(csvEscape).join(",");

export const toCsv = (headers: string[], rows: unknown[][]): string => `${[toCsvRow(headers), ...rows.map(toCsvRow)].join("\r\n")}\r\n`;

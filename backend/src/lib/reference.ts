// Human-facing donation reference: `<CAMP>-<base36x4>`, e.g. "MFB-7QX3".
// CAMP = up to 3 uppercase initials derived from the campaign name; the suffix
// is 4 base36 chars from a random int, uppercased for readability.
const initials = (name: string): string => {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .join("")
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");

  return (letters || "GT").slice(0, 3);
};

const base36x4 = (): string =>
  Math.floor(Math.random() * 36 ** 4)
    .toString(36)
    .toUpperCase()
    .padStart(4, "0");

export const generateReference = (campaignName: string): string => `${initials(campaignName)}-${base36x4()}`;

// Logical join key to processor_settlements — not a human-facing value.
export const generatePaymentRef = (): string => crypto.randomUUID();

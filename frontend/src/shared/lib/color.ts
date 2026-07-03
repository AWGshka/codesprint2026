/** Picks black or white text for readable contrast against a hex background (WCAG-ish luminance heuristic). */
export const readableForeground = (hex: string): "#000000" | "#ffffff" => {
  const clean = hex.replace("#", "");
  const full = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const r = Number.parseInt(full.slice(0, 2), 16) || 0;
  const g = Number.parseInt(full.slice(2, 4), 16) || 0;
  const b = Number.parseInt(full.slice(4, 6), 16) || 0;
  // Perceived luminance (ITU-R BT.601).
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.6 ? "#000000" : "#ffffff";
};

/** Deterministic hue (0-359) from a string seed — same name always maps to the same avatar colour. */
export const avatarHue = (seed: string): number => {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return hash % 360;
};

/** `hsl(...)` background for an initials avatar, seeded off the given name/username. */
export const avatarColor = (seed: string): string => `hsl(${avatarHue(seed || "?")}, 55%, 40%)`;

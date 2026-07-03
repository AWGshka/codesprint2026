/** `"Alexandra Borg"` from firstName/lastName, falling back to `username` when both are missing. */
export const fullName = (firstName: string | null | undefined, lastName: string | null | undefined, username: string): string => {
  const parts = [firstName?.trim(), lastName?.trim()].filter(Boolean);
  return parts.length > 0 ? parts.join(" ") : username;
};

/** Initials for an avatar: first letter of first+last name, or the first letter of `username`. */
export const initials = (firstName: string | null | undefined, lastName: string | null | undefined, username: string): string => {
  const f = firstName?.trim()?.[0];
  const l = lastName?.trim()?.[0];
  if (f || l) return `${f ?? ""}${l ?? ""}`.toUpperCase();
  return (username.trim()[0] ?? "?").toUpperCase();
};

export type ClassValue = string | number | false | null | undefined;
export const cn = (...values: ClassValue[]): string => values.filter(Boolean).join(" ");

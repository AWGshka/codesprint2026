// Shared list-response shape (spec §6): `{ rows, total, page, pageSize }`.
export type Paginated<T> = { rows: T[]; total: number; page: number; pageSize: number };

const MAX_PAGE_SIZE = 100;

// Normalizes/clamps raw query page/pageSize into safe values + a SQL offset/limit.
export const paginate = (page?: number, pageSize?: number) => {
  const safePage = Math.max(1, Math.trunc(page ?? 1));
  const safePageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Math.trunc(pageSize ?? 25)));

  return { page: safePage, pageSize: safePageSize, offset: (safePage - 1) * safePageSize, limit: safePageSize };
};

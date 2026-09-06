export type SortDir = "asc" | "desc";

export interface PageSlice<T> {
  items: T[];
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
  start: number;
  end: number;
}

export function paginate<T>(items: T[], page: number, pageSize: number): PageSlice<T> {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (safePage - 1) * pageSize;
  const slice = items.slice(startIndex, startIndex + pageSize);
  return {
    items: slice,
    page: safePage,
    pageSize,
    total,
    totalPages,
    start: total === 0 ? 0 : startIndex + 1,
    end: Math.min(startIndex + slice.length, total),
  };
}

export function sortBy<T>(
  items: T[],
  getValue: (item: T) => string | number | null | undefined,
  dir: SortDir = "asc",
): T[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...items].sort((a, b) => {
    const av = getValue(a);
    const bv = getValue(b);
    if (av == null && bv == null) return 0;
    if (av == null) return 1;
    if (bv == null) return -1;
    if (typeof av === "number" && typeof bv === "number") return (av - bv) * sign;
    return String(av).localeCompare(String(bv), undefined, { numeric: true, sensitivity: "base" }) * sign;
  });
}

export function toggleSort(currentKey: string, nextKey: string, currentDir: SortDir): { key: string; dir: SortDir } {
  if (currentKey === nextKey) {
    return { key: nextKey, dir: currentDir === "asc" ? "desc" : "asc" };
  }
  return { key: nextKey, dir: "asc" };
}

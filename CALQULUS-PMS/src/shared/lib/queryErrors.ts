/**
 * Fail closed on PostgREST/RPC errors so an RLS failure cannot look like
 * an empty book.
 */
export function throwIfQueryError(error: { message?: string } | null, context: string): void {
  if (!error) return;
  const message = error.message?.trim() || "Request failed";
  throw new Error(`${context}: ${message}`);
}

export function unwrapList<T>(
  result: { data: T[] | null; error: { message?: string } | null },
  context: string,
): T[] {
  throwIfQueryError(result.error, context);
  return result.data ?? [];
}

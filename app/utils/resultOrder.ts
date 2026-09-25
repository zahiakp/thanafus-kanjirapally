type ResultEntry = { rank?: unknown; point?: unknown };
export function sortResultEntries<T extends ResultEntry>(entries: readonly T[]): T[] {
  const place = (entry: T) => {
    const rank = Number(entry.rank);
    return Number.isFinite(rank) && rank > 0 ? rank : Number.MAX_SAFE_INTEGER;
  };
  return [...entries].sort((a, b) => place(a) - place(b) || (Number(b.point) || 0) - (Number(a.point) || 0));
}

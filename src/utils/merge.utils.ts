export class MergeUtils {
  static merge<T>(existing: T | undefined, incoming: T | undefined): T {
    if (incoming === undefined) return existing as T;
    if (existing === undefined) return incoming;

    if (Array.isArray(existing) && Array.isArray(incoming)) {
      return Array.from(new Set([...existing, ...incoming])) as T;
    }

    if (
      typeof existing === 'object' &&
      typeof incoming === 'object' &&
      existing !== null &&
      incoming !== null
    ) {
      const merged = { ...existing };
      for (const key in incoming) {
        if (Object.prototype.hasOwnProperty.call(incoming, key)) {
          merged[key as keyof typeof merged] = this.merge(merged[key], incoming[key]);
        }
      }
      return merged as T;
    }
    return incoming;
  }

  static mergeUnique<T>(existing?: T[], incoming?: T[]): { value: T[]; changed: boolean } {
    const merged = Array.from(new Set([...(existing ?? []), ...(incoming ?? [])]));
    return { value: merged, changed: merged.length > (existing?.length ?? 0) };
  }

  static mergeArrays<T>(existing: T[] | undefined, incoming: T[] | undefined): T[] {
    return Array.from(new Set([...(existing || []), ...(incoming || [])]));
  }
}

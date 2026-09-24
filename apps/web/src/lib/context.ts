/**
 * Branch context lives in the URL (`?branch=<slug>`) so views are shareable and cacheable.
 * These helpers keep it when moving between listing pages.
 */
export type SearchParams = Record<string, string | string[] | undefined>;

export function param(params: SearchParams, key: string): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

/** A slug-safe branch parameter, or undefined. */
export function branchParam(params: SearchParams): string | undefined {
  const value = param(params, 'branch');
  return value && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) ? value : undefined;
}

/** Build a path with query parameters, dropping empty values. */
export function href(
  path: string,
  query: Record<string, string | number | null | undefined> = {},
): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') search.set(key, String(value));
  }
  const qs = search.toString();
  return qs ? `${path}?${qs}` : path;
}

/** Same path, with the branch context preserved. */
export function withBranch(
  path: string,
  branch: string | null | undefined,
  query: Record<string, string | number | null | undefined> = {},
): string {
  return href(path, { branch: branch ?? undefined, ...query });
}

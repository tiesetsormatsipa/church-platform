const AUTH_PAGES = new Set([
  '/sign-in',
  '/sign-up',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
]);

/**
 * Where to go after signing in. Only same-site paths are allowed (no `//evil.example`,
 * no `/\evil.example`, no absolute URLs), so the parameter cannot be used for phishing
 * redirects. Auth pages fall back too, to avoid loops.
 */
export function safeNext(value: string | null | undefined, fallback = '/'): string {
  if (!value || value.length > 2000 || !value.startsWith('/')) return fallback;
  const second = value.charAt(1);
  if (second === '/' || second === '\\') return fallback;
  for (let i = 0; i < value.length; i += 1) {
    if (value.charCodeAt(i) < 32) return fallback;
  }
  try {
    const base = 'http://same-site.invalid';
    const url = new URL(value, base);
    if (url.origin !== base) return fallback;
    if (AUTH_PAGES.has(url.pathname)) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}

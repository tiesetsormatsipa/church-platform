/**
 * Convert free text into a URL slug: lower-case ASCII, words separated by single hyphens.
 * Accented Latin characters are folded ("Pé" → "pe"). Returns `fallback` when nothing is left.
 */
export function slugify(input: string, fallback = 'item'): string {
  const slug = input
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || fallback;
}

/** Append `-2`, `-3`, … until `isTaken` returns false. */
export async function uniqueSlug(
  base: string,
  isTaken: (candidate: string) => Promise<boolean>,
  maxAttempts = 50,
): Promise<string> {
  const root = slugify(base);
  if (!(await isTaken(root))) return root;
  for (let i = 2; i <= maxAttempts; i += 1) {
    const candidate = `${root.slice(0, 76)}-${i}`;
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error(`Could not find a free slug for "${base}"`);
}

/** Plain-text excerpt of Markdown, suitable for cards and meta descriptions. */
export function excerpt(markdown: string | null | undefined, maxLength = 200): string {
  if (!markdown) return '';
  const text = markdown
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/!\[[^\]]*]\([^)]*\)/g, ' ')
    .replace(/\[([^\]]*)]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text.length <= maxLength) return text;
  const cut = text.slice(0, maxLength - 1);
  const lastSpace = cut.lastIndexOf(' ');
  return `${(lastSpace > maxLength * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** Normalise an e-mail address for storage and comparison. */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

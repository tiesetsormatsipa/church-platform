/**
 * A deliberately plain HTML shell: table-free, inline styles only, no images and no
 * tracking. Mail clients vary wildly, so the HTML is a light dressing of the plain-text
 * version rather than a separate design.
 */

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escapes text for HTML. Every value in an e-mail comes from user input somewhere. */
export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

export interface LayoutOptions {
  churchName: string;
  heading: string;
  /** Paragraphs of body text (already plain, escaped here). */
  paragraphs: string[];
  action?: { label: string; url: string };
  /** Small print under the rule, e.g. "You receive this because…". */
  footnotes?: string[];
}

const FONT =
  "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";

export function renderHtml(options: LayoutOptions): string {
  const { churchName, heading, paragraphs, action, footnotes = [] } = options;
  const body = paragraphs
    .map((p) => `<p style="margin:0 0 16px;line-height:1.6">${escapeHtml(p)}</p>`)
    .join('\n      ');
  const button = action
    ? `<p style="margin:0 0 24px">
        <a href="${escapeHtml(action.url)}" style="background:#1d4ed8;border-radius:6px;color:#ffffff;display:inline-block;font-weight:600;padding:12px 20px;text-decoration:none">${escapeHtml(action.label)}</a>
      </p>
      <p style="margin:0 0 16px;color:#57606a;font-size:13px;line-height:1.6">If the button does not work, copy this address into your browser:<br><span style="word-break:break-all">${escapeHtml(action.url)}</span></p>`
    : '';
  const footer = footnotes
    .map(
      (f) =>
        `<p style="margin:0 0 8px;color:#57606a;font-size:12px;line-height:1.5">${escapeHtml(f)}</p>`,
    )
    .join('\n      ');

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <title>${escapeHtml(heading)}</title>
  </head>
  <body style="margin:0;padding:24px 12px;background:#f6f8fa;color:#1f2328;font-family:${FONT};font-size:16px">
    <div style="margin:0 auto;max-width:560px;background:#ffffff;border:1px solid #d1d9e0;border-radius:10px;padding:32px 28px">
      <p style="margin:0 0 24px;font-size:14px;font-weight:600;letter-spacing:.04em;text-transform:uppercase;color:#57606a">${escapeHtml(churchName)}</p>
      <h1 style="margin:0 0 20px;font-size:22px;line-height:1.3">${escapeHtml(heading)}</h1>
      ${body}
      ${button}
      <hr style="border:0;border-top:1px solid #d1d9e0;margin:24px 0">
      ${footer}
    </div>
  </body>
</html>`;
}

export function renderText(options: LayoutOptions): string {
  const { churchName, heading, paragraphs, action, footnotes = [] } = options;
  const parts = [churchName, '', heading, '', ...paragraphs.flatMap((p) => [p, ''])];
  if (action) parts.push(`${action.label}: ${action.url}`, '');
  if (footnotes.length) parts.push('--', ...footnotes);
  return `${parts.join('\n').trimEnd()}\n`;
}

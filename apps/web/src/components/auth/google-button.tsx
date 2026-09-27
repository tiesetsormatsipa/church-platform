import { Alert } from '@church/ui/alert';
import { serverEnv } from '@/lib/env';

/** What went wrong last time, in words rather than an OAuth error code. */
const REASONS: Record<string, string> = {
  cancelled: 'That sign-in was cancelled. You can try again or use your e-mail address.',
  expired: 'That sign-in took too long. Please try again.',
  failed: 'Google could not complete that sign-in. Please try again, or use your e-mail address.',
};

/**
 * "Continue with Google".
 *
 * A plain link, not a button: the browser has to leave the site, so there is nothing to
 * submit and nothing that needs JavaScript. The whole component disappears when the site has
 * no Google client configured, so nobody is offered a door that does not open.
 */
export function GoogleButton({ next, problem }: { next: string; problem?: string }) {
  if (!serverEnv.googleSignInEnabled) return null;
  const href = `/api/v1/auth/google/start${next && next !== '/' ? `?next=${encodeURIComponent(next)}` : ''}`;
  const message = problem ? REASONS[problem] : undefined;

  return (
    <div className="flex flex-col gap-4">
      {message ? <Alert tone="warning">{message}</Alert> : null}
      <a
        href={href}
        className="inline-flex h-11 w-full items-center justify-center gap-3 rounded-lg border border-border-strong bg-surface px-4 text-sm font-medium text-foreground shadow-card transition-colors hover:bg-surface-muted"
      >
        <GoogleMark />
        Continue with Google
      </a>
      <p className="flex items-center gap-3 text-xs text-muted">
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
        or use your e-mail address
        <span aria-hidden="true" className="h-px flex-1 bg-border" />
      </p>
    </div>
  );
}

/** Google's mark, drawn inline so the button needs no network request to render. */
function GoogleMark() {
  return (
    <svg aria-hidden="true" viewBox="0 0 18 18" className="size-5">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.91c1.7-1.57 2.69-3.88 2.69-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.91-2.26c-.81.54-1.84.86-3.05.86-2.34 0-4.33-1.58-5.04-3.71H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.96 10.71a5.41 5.41 0 0 1 0-3.42V4.96H.96a9 9 0 0 0 0 8.08l3-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3 2.33C4.67 5.16 6.66 3.58 9 3.58Z"
      />
    </svg>
  );
}

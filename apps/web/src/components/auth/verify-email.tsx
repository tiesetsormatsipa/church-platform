'use client';

import type { SessionUser } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { buttonVariants } from '@church/ui/button';
import { Spinner } from '@church/ui/spinner';
import { useQueryClient } from '@tanstack/react-query';
import { CheckCircle2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { api } from '@/lib/api/client';
import { SESSION_KEY } from '@/lib/hooks/use-session';

/** Confirms the address from the e-mailed link, then signs the member in. */
export function VerifyEmail({ token }: { token: string | null }) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ status: 'working' | 'done' | 'failed'; name?: string }>(
    token ? { status: 'working' } : { status: 'failed' },
  );
  const started = useRef(false);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    window.history.replaceState(null, '', '/verify-email');
    void (async () => {
      const { data, response } = await api.POST('/api/v1/auth/verify-email', { body: { token } });
      if (response.ok && data) {
        const user = data as SessionUser;
        queryClient.setQueryData(SESSION_KEY, user);
        setState({ status: 'done', name: user.firstName });
        router.refresh();
      } else {
        setState({ status: 'failed' });
      }
    })();
  }, [token, queryClient, router]);

  if (state.status === 'working') {
    return (
      <div role="status" className="flex flex-col items-center gap-3 py-6 text-muted">
        <Spinner className="size-6" />
        Confirming your e-mail address…
      </div>
    );
  }
  if (state.status === 'failed') {
    return (
      <Alert tone="warning" title="This link has expired or was already used">
        Confirmation links work once and for 24 hours. <Link href="/sign-in">Sign in</Link> and we
        will offer to send a new one.
      </Alert>
    );
  }
  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <CheckCircle2 aria-hidden="true" className="size-10 text-success" />
      <div className="flex flex-col gap-1">
        <h2 className="text-xl font-semibold">Welcome, {state.name}</h2>
        <p className="text-sm text-muted">
          Your e-mail address is confirmed and you are signed in.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Link href="/profile" className={buttonVariants({ variant: 'primary' })}>
          Complete your profile
        </Link>
        <Link href="/" className={buttonVariants({ variant: 'secondary' })}>
          Go to the home page
        </Link>
      </div>
    </div>
  );
}

'use client';

import { VERIFICATION_CODE_LENGTH } from '@church/shared';
import { Alert } from '@church/ui/alert';
import { Field } from '@church/ui/field';
import { Input } from '@church/ui/input';
import { MailCheck } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { SubmitButton } from '@/components/forms/submit-button';
import { api, ensureOk } from '@/lib/api/client';
import { applyApiError } from '@/lib/forms';
import { useSetSession } from '@/lib/hooks/use-session';

/**
 * The last step of signing up: type the code from the e-mail.
 *
 * This is the main path rather than the link, because the e-mail is usually read on a
 * different device from the one being signed up on. Typing the code finishes the account in
 * the tab the person is already looking at; the link in the same message still works for
 * anyone reading their mail on this device.
 */
export function ConfirmCodeForm({ email, next }: { email: string; next: string }) {
  const router = useRouter();
  const setSession = useSetSession();
  const headingRef = React.useRef<HTMLHeadingElement>(null);
  const [code, setCode] = React.useState('');
  const [error, setError] = React.useState<string | null>(null);
  const [resent, setResent] = React.useState(false);
  const [busy, setBusy] = React.useState(false);

  React.useEffect(() => headingRef.current?.focus(), []);

  const digits = code.replace(/\D/g, '');
  const ready = digits.length === VERIFICATION_CODE_LENGTH;

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!ready || busy) return;
    setBusy(true);
    setError(null);
    try {
      const user = ensureOk(
        await api.POST('/api/v1/auth/verify-email/code', { body: { email, code: digits } }),
      );
      setSession(user);
      router.push(next);
      router.refresh();
    } catch (caught) {
      setError(applyApiError(caught, () => {}, []));
      setCode('');
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    setError(null);
    setResent(false);
    await api.POST('/api/v1/auth/verify-email/resend', { body: { email } });
    // Always says the same thing: whether an address has an account is not ours to reveal.
    setResent(true);
  }

  return (
    <div className="flex flex-col items-center gap-4 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-success-soft text-success">
        <MailCheck aria-hidden="true" className="size-6" />
      </span>
      <h1 ref={headingRef} tabIndex={-1} className="text-2xl font-semibold focus:outline-none">
        Check your e-mail
      </h1>
      <p className="text-sm text-muted">
        We have sent a {VERIFICATION_CODE_LENGTH}-digit code to{' '}
        <strong className="text-foreground">{email}</strong>. Type it below to finish creating your
        account.
      </p>

      {error ? (
        <Alert tone="danger" className="w-full text-left">
          {error}
        </Alert>
      ) : null}
      {resent ? (
        <Alert tone="success" className="w-full text-left">
          If that address needs confirming, a new code is on its way.
        </Alert>
      ) : null}

      <form onSubmit={submit} className="flex w-full flex-col gap-4">
        <Field id="confirm-code" label={`Your ${VERIFICATION_CODE_LENGTH}-digit code`}>
          {(props) => (
            <Input
              {...props}
              value={code}
              onChange={(event) => setCode(event.target.value)}
              // A numeric keypad on a phone, and the browser's own one-time-code autofill,
              // which reads the code straight out of the message on iOS and Android.
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={12}
              className="text-center text-2xl tracking-[0.5em]"
              placeholder="000000"
              required
            />
          )}
        </Field>
        <SubmitButton size="lg" loading={busy} disabled={!ready}>
          Confirm and continue
        </SubmitButton>
      </form>

      <p className="text-sm text-muted">
        Nothing there after a minute? Check your spam folder, or{' '}
        <button type="button" onClick={resend} className="font-medium text-link hover:underline">
          send another code
        </button>
        .
      </p>
      <p className="text-xs text-muted">
        The e-mail also has a link, if you would rather tap that on the device you are reading it
        on.
      </p>
    </div>
  );
}

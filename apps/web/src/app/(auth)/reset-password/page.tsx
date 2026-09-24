import { Alert } from '@church/ui/alert';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AuthHeading } from '@/components/auth/auth-heading';
import { ResetPasswordForm } from '@/components/auth/reset-password-form';
import { param } from '@/lib/context';

export const metadata: Metadata = { title: 'Choose a new password', robots: { index: false }, referrer: 'no-referrer' };

export default async function ResetPasswordPage({ searchParams }: PageProps<'/reset-password'>) {
  const token = param(await searchParams, 'token');
  return (
    <>
      <AuthHeading title="Choose a new password" />
      {token ? (
        <ResetPasswordForm token={token} />
      ) : (
        <Alert tone="info" title="Open the link from your e-mail">
          This page needs the link we sent you. <Link href="/forgot-password">Request a new link</Link>.
        </Alert>
      )}
    </>
  );
}

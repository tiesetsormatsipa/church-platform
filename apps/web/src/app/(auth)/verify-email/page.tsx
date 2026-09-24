import type { Metadata } from 'next';
import { AuthHeading } from '@/components/auth/auth-heading';
import { VerifyEmail } from '@/components/auth/verify-email';
import { param } from '@/lib/context';

export const metadata: Metadata = {
  title: 'Confirm your e-mail address',
  robots: { index: false },
  referrer: 'no-referrer',
};

export default async function VerifyEmailPage({ searchParams }: PageProps<'/verify-email'>) {
  const token = param(await searchParams, 'token') ?? null;
  return (
    <>
      <AuthHeading title="Confirm your e-mail address" />
      <VerifyEmail token={token} />
    </>
  );
}

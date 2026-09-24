import { Alert } from '@church/ui/alert';
import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthHeading } from '@/components/auth/auth-heading';
import { SignUpForm } from '@/components/auth/sign-up-form';
import { param } from '@/lib/context';
import { getOrganization } from '@/lib/data';
import { safeNext } from '@/lib/safe-next';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function SignUpPage({ searchParams }: PageProps<'/sign-up'>) {
  const next = safeNext(param(await searchParams, 'next'));
  const [user, organization] = await Promise.all([getSessionUser(), getOrganization()]);
  if (user) redirect(next);
  return (
    <>
      <AuthHeading
        title="Create an account"
        description="Follow your branch, get updates and manage your details."
      />
      {organization.registrationOpen ? (
        <SignUpForm />
      ) : (
        <Alert tone="info" title="Registration is closed for now">
          New accounts cannot be created at the moment. Please speak to your branch.
        </Alert>
      )}
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{' '}
        <Link
          href={next === '/' ? '/sign-in' : `/sign-in?next=${encodeURIComponent(next)}`}
          className="font-medium text-link hover:underline"
        >
          Sign in
        </Link>
      </p>
    </>
  );
}

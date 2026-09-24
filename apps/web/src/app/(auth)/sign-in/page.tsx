import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { AuthHeading } from '@/components/auth/auth-heading';
import { SignInForm } from '@/components/auth/sign-in-form';
import { param } from '@/lib/context';
import { getOrganization } from '@/lib/data';
import { safeNext } from '@/lib/safe-next';
import { getSessionUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function SignInPage({ searchParams }: PageProps<'/sign-in'>) {
  const next = safeNext(param(await searchParams, 'next'));
  const [user, organization] = await Promise.all([getSessionUser(), getOrganization()]);
  if (user) redirect(next);
  return (
    <>
      <AuthHeading title="Sign in" description={`Welcome back to ${organization.shortName ?? organization.name}.`} />
      <SignInForm next={next} />
      {organization.registrationOpen ? (
        <p className="mt-6 text-center text-sm text-muted">
          New here?{' '}
          <Link href={next === '/' ? '/sign-up' : `/sign-up?next=${encodeURIComponent(next)}`} className="font-medium text-link hover:underline">
            Create an account
          </Link>
        </p>
      ) : null}
    </>
  );
}

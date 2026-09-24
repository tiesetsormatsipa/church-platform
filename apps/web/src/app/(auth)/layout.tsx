import Link from 'next/link';
import { BrandMark } from '@/components/layout/brand-mark';
import { getOrganization } from '@/lib/data';

/** Calm, focused frame for sign-in and account recovery. */
export default async function AuthLayout({ children }: LayoutProps<'/'>) {
  const organization = await getOrganization();
  return (
    <div className="flex min-h-[calc(100dvh-8rem)] items-start justify-center bg-surface-sunken/40 px-4 py-10 sm:items-center sm:py-16">
      <div className="flex w-full max-w-md flex-col gap-6">
        <Link href="/" className="flex items-center justify-center gap-2 self-center rounded-lg" aria-label={`${organization.name} home`}>
          <BrandMark className="size-12 rounded-xl" />
        </Link>
        <div className="rounded-2xl border border-border bg-surface p-6 shadow-raised sm:p-8">{children}</div>
      </div>
    </div>
  );
}

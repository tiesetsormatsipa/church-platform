import { Container } from '@church/ui/container';
import type { Metadata } from 'next';
import { AccountNav } from '@/components/account/account-nav';
import { PageHeader } from '@/components/content/page-header';
import { requireUser } from '@/lib/session';

export const metadata: Metadata = { title: 'Your account', robots: { index: false } };

export default async function ProfileLayout({ children }: LayoutProps<'/profile'>) {
  const user = await requireUser('/profile');
  return (
    <>
      <PageHeader eyebrow="Your account" title={user.displayName} description={user.email} />
      <Container className="py-8">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-10">
          <AccountNav />
          <div className="flex min-w-0 flex-col gap-8">{children}</div>
        </div>
      </Container>
    </>
  );
}

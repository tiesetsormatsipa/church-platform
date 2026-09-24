import { Container } from '@church/ui/container';
import { EmptyState } from '@church/ui/empty-state';
import { ShieldCheck } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminNav } from '@/components/admin/admin-nav';
import { getAdminSummary } from '@/lib/admin';

export const metadata: Metadata = {
  title: { default: 'Administration', template: '%s · Administration' },
  robots: { index: false, follow: false },
};

export default async function AdminLayout({ children }: LayoutProps<'/admin'>) {
  const summary = await getAdminSummary();
  const any = Object.values(summary.areas).some(Boolean);
  if (!any) {
    return (
      <Container className="py-16">
        <EmptyState
          headingLevel={1}
          icon={<ShieldCheck />}
          title="This area is for church administrators"
          description="If you help run a branch and need access, ask your branch administrator to give you a role."
          action={
            <Link href="/" className="text-sm font-medium text-link underline">
              Back to the home page
            </Link>
          }
        />
      </Container>
    );
  }
  return (
    <Container className="py-6 sm:py-8">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[14rem_minmax(0,1fr)] lg:gap-8">
        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <p className="mb-2 hidden px-3 text-xs font-semibold tracking-wide text-subtle uppercase lg:block">
            Administration
          </p>
          <AdminNav summary={summary} />
        </div>
        <div className="flex min-w-0 flex-col gap-6">{children}</div>
      </div>
    </Container>
  );
}

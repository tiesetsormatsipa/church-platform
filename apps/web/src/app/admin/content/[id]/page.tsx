import { CONTENT_TYPE_LABEL, Uuid } from '@church/shared';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { ContentEditor } from '@/components/admin/content-editor';
import { requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';

export const metadata: Metadata = { title: 'Edit content' };

export default async function EditContentPage({ params }: PageProps<'/admin/content/[id]'>) {
  await requireArea('content');
  const id = Uuid.safeParse((await params).id).data;
  if (!id) notFound();
  const client = await userApi();
  const [detail, options] = await Promise.all([
    client.GET('/api/v1/admin/content/{id}', { params: { path: { id } } }).then(unwrap),
    client.GET('/api/v1/admin/content/options').then(unwrap),
  ]);
  return (
    <>
      <AdminPageHeader
        back={
          <Link
            href="/admin/content"
            className="inline-flex items-center gap-1 self-start text-sm font-medium text-link hover:underline"
          >
            <ArrowLeft aria-hidden="true" className="size-4" /> Content
          </Link>
        }
        title={detail.title}
        description={`${CONTENT_TYPE_LABEL[detail.type].singular} · ${detail.branch?.name ?? 'Church-wide'}`}
      />
      <ContentEditor key={detail.updatedAt} type={detail.type} detail={detail} options={options} />
    </>
  );
}

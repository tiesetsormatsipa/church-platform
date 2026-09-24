import { CONTENT_TYPE_LABEL, ContentType } from '@church/shared';
import { ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { AdminPageHeader } from '@/components/admin/admin-page';
import { ContentEditor } from '@/components/admin/content-editor';
import { requireArea } from '@/lib/admin';
import { unwrap, userApi } from '@/lib/api/server';
import { param } from '@/lib/context';

export const metadata: Metadata = { title: 'New content' };

export default async function NewContentPage({ searchParams }: PageProps<'/admin/content/new'>) {
  await requireArea('content');
  const type =
    ContentType.schema.safeParse(param(await searchParams, 'type')).data ?? 'ANNOUNCEMENT';
  const client = await userApi();
  const options = unwrap(await client.GET('/api/v1/admin/content/options'));
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
        title={`New ${CONTENT_TYPE_LABEL[type].singular.toLowerCase()}`}
        description="Save a draft at any time. Nothing is public until it is published."
      />
      <ContentEditor type={type} detail={null} options={options} />
    </>
  );
}

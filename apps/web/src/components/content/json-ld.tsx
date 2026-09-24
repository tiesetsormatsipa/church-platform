import { serializeJsonLd } from '@/lib/json-ld';

/** Structured data for search engines. */
export function JsonLd({ data }: { data: unknown }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }} />;
}

import { getContent } from '@/lib/content';
import { getOrganization } from '@/lib/data';
import { serverEnv } from '@/lib/env';
import { buildIcs } from '@/lib/ics';

/** "Add to calendar" download for one event. */
export async function GET(_request: Request, context: RouteContext<'/events/[slug]/calendar.ics'>) {
  const { slug } = await context.params;
  const item = /^[a-z0-9-]{1,200}$/.test(slug) ? await getContent(slug) : null;
  const event = item?.eventDetail;
  if (!item || !event) return new Response('Not found', { status: 404 });

  const organization = await getOrganization();
  const origin = new URL(serverEnv.appOrigin);
  const location = [event.venueName, event.venueAddress].filter(Boolean).join(', ') || event.onlineUrl;
  const body = buildIcs(
    {
      id: item.id,
      title: item.title,
      description: item.summary,
      url: new URL(item.path, origin).toString(),
      startsAt: event.startsAt,
      endsAt: event.endsAt,
      allDay: event.allDay,
      timezone: event.timezone,
      location,
      status: event.eventStatus,
      updatedAt: item.updatedAt,
    },
    { host: origin.hostname, productName: organization.shortName ?? organization.name },
  );
  return new Response(body, {
    headers: {
      'content-type': 'text/calendar; charset=utf-8',
      'content-disposition': `attachment; filename="${item.slug}.ics"`,
      'cache-control': 'public, max-age=300',
    },
  });
}

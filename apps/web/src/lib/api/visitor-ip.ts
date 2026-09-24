import { isIP } from 'node:net';

/**
 * The visitor's IP as seen by our reverse proxy. Nginx sets X-Real-IP to the connecting
 * address; the last X-Forwarded-For entry is the one our proxy appended (earlier entries
 * are client-supplied and not trusted).
 */
export function visitorIp(incoming: Pick<Headers, 'get'>): string | null {
  const realIp = incoming.get('x-real-ip')?.trim();
  if (realIp && isIP(realIp)) return realIp;
  const last = incoming.get('x-forwarded-for')?.split(',').at(-1)?.trim();
  return last && isIP(last) ? last : null;
}

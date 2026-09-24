'use client';

import type { DeviceSessionDto } from '@church/shared';
import { Badge } from '@church/ui/badge';
import { Button } from '@church/ui/button';
import { toast } from '@church/ui/toast';
import { Laptop, Smartphone } from 'lucide-react';
import { useState } from 'react';
import { api, ensureOk } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { describeUserAgent } from '@/lib/user-agent';

const isMobile = (ua: string | null) => Boolean(ua && /Android|iPhone|iPad|Mobile/.test(ua));

/** Signed-in devices, with sign-out per device and for all others. */
export function DeviceList({ initial }: { initial: DeviceSessionDto[] }) {
  const [devices, setDevices] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const others = devices.filter((d) => !d.current);

  async function signOut(id: string) {
    setBusy(id);
    try {
      ensureOk(await api.DELETE('/api/v1/auth/sessions/{id}', { params: { path: { id } } }));
      setDevices((prev) => prev.filter((d) => d.id !== id));
      toast({ title: 'Device signed out', tone: 'success' });
    } catch {
      toast({ title: 'Could not sign that device out', tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  async function signOutOthers() {
    setBusy('others');
    try {
      ensureOk(await api.POST('/api/v1/auth/sessions/revoke-others'));
      setDevices((prev) => prev.filter((d) => d.current));
      toast({ title: 'All other devices signed out', tone: 'success' });
    } catch {
      toast({ title: 'Could not sign the other devices out', tone: 'error' });
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <ul className="flex flex-col divide-y divide-border">
        {devices.map((device) => {
          const Icon = isMobile(device.userAgent) ? Smartphone : Laptop;
          return (
            <li key={device.id} className="flex items-center gap-3 py-3">
              <Icon aria-hidden="true" className="size-5 shrink-0 text-muted" />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="flex flex-wrap items-center gap-2 font-medium">
                  {describeUserAgent(device.userAgent)}
                  {device.current ? <Badge tone="success">This device</Badge> : null}
                </span>
                <span className="text-sm text-muted">
                  Last active {formatDate(device.lastSeenAt)} · signed in {formatDate(device.createdAt)}
                </span>
              </div>
              {!device.current ? (
                <Button variant="ghost" size="sm" onClick={() => signOut(device.id)} loading={busy === device.id}>
                  Sign out
                </Button>
              ) : null}
            </li>
          );
        })}
      </ul>
      {others.length > 0 ? (
        <Button variant="secondary" onClick={signOutOthers} loading={busy === 'others'} className="self-start">
          Sign out all other devices
        </Button>
      ) : (
        <p className="text-sm text-muted">You are not signed in anywhere else.</p>
      )}
    </div>
  );
}

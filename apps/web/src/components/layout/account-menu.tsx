'use client';

import { Avatar } from '@church/ui/avatar';
import { buttonVariants } from '@church/ui/button';
import {
  Menu,
  MenuContent,
  MenuItem,
  MenuLabel,
  MenuLinkItem,
  MenuSeparator,
  MenuTrigger,
} from '@church/ui/menu';
import { Skeleton } from '@church/ui/skeleton';
import { toast } from '@church/ui/toast';
import {
  Bell,
  LayoutDashboard,
  LogOut,
  MessageSquare,
  Monitor,
  Moon,
  Sun,
  UserRound,
} from 'lucide-react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { api } from '@/lib/api/client';
import { hasAdminAccess, useSession, useSetSession } from '@/lib/hooks/use-session';
import { useUnreadMessages, useUnreadNotifications } from '@/lib/hooks/use-unread-notifications';
import { setTheme, type ThemePreference, useThemePreference } from '@/lib/theme';

const THEMES: { value: ThemePreference; label: string; icon: typeof Sun }[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export function AccountMenu() {
  const { user, isLoading } = useSession();
  const setSession = useSetSession();
  const router = useRouter();
  const pathname = usePathname();
  const theme = useThemePreference();
  const unread = useUnreadNotifications(Boolean(user));
  const unreadMessages = useUnreadMessages(Boolean(user));

  if (isLoading) return <Skeleton className="size-9 rounded-full" />;

  if (!user) {
    const next = pathname && pathname !== '/' ? `?next=${encodeURIComponent(pathname)}` : '';
    return (
      <Link href={`/sign-in${next}`} className={buttonVariants({ variant: 'primary', size: 'sm' })}>
        Sign in
      </Link>
    );
  }

  async function signOut() {
    const { response } = await api.POST('/api/v1/auth/logout');
    if (response.ok || response.status === 401) {
      setSession(null);
      toast({ title: 'Signed out', tone: 'success' });
      router.push('/');
      router.refresh();
    } else {
      toast({ title: 'Could not sign out', description: 'Please try again.', tone: 'error' });
    }
  }

  return (
    <div className="flex items-center gap-1">
      <Link
        href="/notifications"
        aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
        className={buttonVariants({
          variant: 'ghost',
          size: 'icon',
          className: 'relative hidden sm:inline-flex',
        })}
      >
        <Bell aria-hidden="true" />
        {unread > 0 ? (
          <span
            aria-hidden="true"
            className="absolute end-1 top-1 flex min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[0.625rem] leading-4 font-semibold text-primary-foreground"
          >
            {unread > 99 ? '99+' : unread}
          </span>
        ) : null}
      </Link>
      <Menu>
        <MenuTrigger
          aria-label={`Account menu for ${user.displayName}`}
          className="rounded-full focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
        >
          <Avatar name={user.displayName} src={user.avatarUrl} size="sm" />
        </MenuTrigger>
        <MenuContent>
          <div className="px-2.5 py-2">
            <p className="truncate text-sm font-semibold">{user.displayName}</p>
            <p className="truncate text-xs text-muted">{user.email}</p>
          </div>
          <MenuSeparator />
          <MenuLinkItem render={<Link href="/profile" />}>
            <UserRound aria-hidden="true" /> Profile and settings
          </MenuLinkItem>
          <MenuLinkItem render={<Link href="/messages" />}>
            <MessageSquare aria-hidden="true" /> Messages
            {unreadMessages > 0 ? (
              <span className="ms-auto text-xs text-muted">{unreadMessages}</span>
            ) : null}
          </MenuLinkItem>
          <MenuLinkItem render={<Link href="/notifications" />}>
            <Bell aria-hidden="true" /> Notifications
            {unread > 0 ? <span className="ms-auto text-xs text-muted">{unread}</span> : null}
          </MenuLinkItem>
          {hasAdminAccess(user) ? (
            <MenuLinkItem render={<Link href="/admin" />}>
              <LayoutDashboard aria-hidden="true" /> Administration
            </MenuLinkItem>
          ) : null}
          <MenuSeparator />
          <MenuLabel>Appearance</MenuLabel>
          {THEMES.map(({ value, label, icon: Icon }) => (
            <MenuItem
              key={value}
              onClick={() => {
                setTheme(value);
              }}
              aria-checked={theme === value}
              role="menuitemradio"
            >
              <Icon aria-hidden="true" /> {label}
              {theme === value ? <span className="ml-auto text-xs text-muted">Current</span> : null}
            </MenuItem>
          ))}
          <MenuSeparator />
          <MenuItem onClick={signOut}>
            <LogOut aria-hidden="true" /> Sign out
          </MenuItem>
        </MenuContent>
      </Menu>
    </div>
  );
}

import {
  CalendarDays,
  Church,
  Globe,
  Headphones,
  Music,
  House,
  LayoutList,
  Newspaper,
  type LucideIcon,
} from 'lucide-react';

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Keeps the current `?branch=` context when followed. */
  contextual: boolean;
}

export const PRIMARY_NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: House, contextual: true },
  { href: '/feed', label: 'Feed', icon: LayoutList, contextual: true },
  { href: '/events', label: 'Events', icon: CalendarDays, contextual: true },
  { href: '/sermons', label: 'Sermons', icon: Headphones, contextual: true },
  { href: '/songs', label: 'Songs', icon: Music, contextual: true },
  { href: '/news', label: 'News', icon: Newspaper, contextual: true },
  { href: '/branches', label: 'Branches', icon: Church, contextual: false },
  { href: '/globe', label: 'Where we are', icon: Globe, contextual: false },
];

/** Items on the mobile tab bar; the rest live in the "More" sheet. */
export const TAB_BAR_HREFS = ['/', '/feed', '/events', '/sermons'];

/** Pages whose content changes with the branch context. */
export const CONTEXTUAL_PATHS = PRIMARY_NAV.filter((i) => i.contextual).map((i) => i.href);

export function isActive(pathname: string, href: string): boolean {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

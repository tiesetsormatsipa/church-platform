'use client';

import { useSyncExternalStore } from 'react';

export type ThemePreference = 'light' | 'dark' | 'system';

/** Current preference as reflected on <html> (`.light`, `.dark`, or neither = system). */
export function currentTheme(): ThemePreference {
  const root = document.documentElement.classList;
  return root.contains('dark') ? 'dark' : root.contains('light') ? 'light' : 'system';
}

/** Apply immediately and remember it for server rendering (no flash on the next visit). */
export function setTheme(theme: ThemePreference): void {
  const root = document.documentElement.classList;
  root.remove('light', 'dark');
  if (theme === 'system') {
    document.cookie = 'cp_theme=; path=/; max-age=0; samesite=lax';
  } else {
    root.add(theme);
    document.cookie = `cp_theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  }
}

function subscribe(onChange: () => void): () => void {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
  return () => observer.disconnect();
}

/** The active preference, kept in sync with <html> (server render assumes "system"). */
export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, currentTheme, () => 'system');
}

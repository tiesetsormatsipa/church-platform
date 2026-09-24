'use client';

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

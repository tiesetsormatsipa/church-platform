import localFont from 'next/font/local';

// Self-hosted variable fonts (ADR-015): no third-party requests, reproducible offline builds.
export const inter = localFont({
  src: [{ path: '../../node_modules/@fontsource-variable/inter/files/inter-latin-wght-normal.woff2', style: 'normal' }],
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
});

export const sourceSerif = localFont({
  src: [
    { path: '../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-normal.woff2', style: 'normal' },
    { path: '../../node_modules/@fontsource-variable/source-serif-4/files/source-serif-4-latin-wght-italic.woff2', style: 'italic' },
  ],
  variable: '--font-source-serif',
  display: 'swap',
  weight: '200 900',
});

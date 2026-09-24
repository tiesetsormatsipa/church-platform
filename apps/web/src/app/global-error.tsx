'use client';

// Last-resort boundary when the root layout itself fails. Plain HTML: the design system
// and fonts may be unavailable here.
export default function GlobalError({ reset }: { error: Error; reset: () => void }) {
  return (
    <html lang="en-ZA">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          padding: '3rem 1rem',
          textAlign: 'center',
          color: '#1b1f27',
        }}
      >
        <h1 style={{ fontSize: '1.5rem' }}>The site is temporarily unavailable</h1>
        <p style={{ color: '#585e6b' }}>Please try again in a few moments.</p>
        <button type="button" onClick={reset} style={{ marginTop: '1rem', padding: '0.5rem 1rem' }}>
          Try again
        </button>
      </body>
    </html>
  );
}

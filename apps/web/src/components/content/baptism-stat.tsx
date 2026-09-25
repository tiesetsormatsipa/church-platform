import type { BaptismSummary } from '@church/shared';
import { Container } from '@church/ui/container';
import { Droplets } from 'lucide-react';

/**
 * The church's baptism numbers on the home page.
 *
 * Nobody applies to be baptised here: after a service they ask who would like to be, and
 * afterwards the branch records the number. So this is a record of what has happened rather
 * than a call to action, and the figure the church cares about most — the year's total — is
 * the one given the space.
 */
export function BaptismStat({ summary }: { summary: BaptismSummary }) {
  if (summary.allTime === 0) return null;

  const previous = summary.years.find((y) => y.year === summary.year - 1);
  const countries = summary.countries.filter((c) => c.yearTotal > 0);

  return (
    <section aria-labelledby="baptisms-heading" className="border-y border-border bg-surface-muted">
      <Container className="py-10 sm:py-14">
        <div className="grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] lg:items-center lg:gap-12">
          <div>
            <p className="flex items-center gap-2 text-sm font-semibold tracking-wide text-muted uppercase">
              <Droplets aria-hidden="true" className="size-4" />
              Baptisms
            </p>
            <h2 id="baptisms-heading" className="mt-3 text-2xl font-semibold sm:text-3xl">
              <span className="text-4xl font-bold tabular-nums sm:text-5xl">
                {summary.yearTotal.toLocaleString('en-ZA')}
              </span>{' '}
              baptised in {summary.year}
            </h2>
            <p className="mt-3 max-w-prose text-muted">
              {summary.allTime.toLocaleString('en-ZA')} people in all, across every branch the
              church keeps a record for.
              {previous ? (
                <>
                  {' '}
                  In {previous.year} the church baptised{' '}
                  {`${previous.total.toLocaleString('en-ZA')}.`}
                </>
              ) : null}
            </p>
          </div>

          {countries.length > 0 ? (
            <div>
              <h3 className="text-sm font-semibold text-muted">
                Where they were baptised in {summary.year}
              </h3>
              <ul className="mt-4 flex flex-col gap-3">
                {countries.map((country) => {
                  const share =
                    summary.yearTotal > 0
                      ? Math.round((country.yearTotal / summary.yearTotal) * 100)
                      : 0;
                  return (
                    <li key={country.code} className="flex items-center gap-3">
                      <span className="w-32 shrink-0 truncate text-sm font-medium">
                        {country.name}
                      </span>
                      <span
                        aria-hidden="true"
                        className="h-2 min-w-1 rounded-full"
                        // The country's own hue, so a country reads the same here and on the globe.
                        style={{
                          width: `${Math.max(share, 3)}%`,
                          backgroundColor: `hsl(${country.hue} 70% 45%)`,
                        }}
                      />
                      <span className="text-sm text-muted tabular-nums">
                        {country.yearTotal.toLocaleString('en-ZA')}
                        <span className="sr-only"> baptised in {country.name}</span>
                      </span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
        </div>
      </Container>
    </section>
  );
}

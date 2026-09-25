'use client';

import type { BaptismRecordDto, BranchSummary } from '@church/shared';
import { Button } from '@church/ui/button';
import { EmptyState } from '@church/ui/empty-state';
import { Field } from '@church/ui/field';
import { Input } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { Droplets, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import * as React from 'react';
import { api } from '@/lib/api/client';

interface Props {
  branches: Pick<BranchSummary, 'slug' | 'name'>[];
  initialBranch: string;
  records: BaptismRecordDto[];
  total: number;
}

/**
 * Adding to a branch's baptism number.
 *
 * Deliberately the smallest form that can be filled in from a phone after a service: which
 * branch, which day, how many. The date defaults to today because that is when it is
 * normally entered.
 */
export function BaptismRecords({ branches, initialBranch, records, total }: Props) {
  const router = useRouter();
  const today = new Date().toISOString().slice(0, 10);
  const [branch, setBranch] = React.useState(initialBranch);
  const [occurredOn, setOccurredOn] = React.useState(today);
  const [count, setCount] = React.useState('');
  const [note, setNote] = React.useState('');
  const [busy, setBusy] = React.useState(false);

  function changeBranch(slug: string) {
    setBranch(slug);
    router.push(`/admin/records?branch=${encodeURIComponent(slug)}`);
  }

  async function add(event: React.FormEvent) {
    event.preventDefault();
    const people = Number(count);
    if (!Number.isInteger(people) || people < 1) {
      toast({ title: 'How many people were baptised?', tone: 'error' });
      return;
    }
    setBusy(true);
    const { error } = await api.POST('/api/v1/admin/baptism-records', {
      body: { branch, occurredOn, count: people, note: note.trim() || null },
    });
    setBusy(false);
    if (error) {
      toast({ title: 'Could not save that', tone: 'error' });
      return;
    }
    toast({ title: `${people} added to ${branchName(branches, branch)}`, tone: 'success' });
    setCount('');
    setNote('');
    router.refresh();
  }

  async function remove(record: BaptismRecordDto) {
    if (!confirm(`Remove the entry of ${record.count} on ${record.occurredOn}?`)) return;
    const { error } = await api.DELETE('/api/v1/admin/baptism-records/{id}', {
      params: { path: { id: record.id } },
    });
    if (error) {
      toast({ title: 'Could not remove that entry', tone: 'error' });
      return;
    }
    toast({ title: 'Entry removed', tone: 'success' });
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-8">
      <form
        method="post"
        onSubmit={add}
        className="grid grid-cols-[minmax(0,1fr)] gap-4 rounded-xl border border-border bg-surface p-4 sm:grid-cols-4 sm:items-end"
      >
        <Field id="baptism-branch" label="Branch">
          {(props) => (
            <select
              {...props}
              value={branch}
              onChange={(e) => changeBranch(e.target.value)}
              className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm"
            >
              {branches.map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.name}
                </option>
              ))}
            </select>
          )}
        </Field>
        <Field id="baptism-date" label="Date">
          {(props) => (
            <Input
              {...props}
              type="date"
              value={occurredOn}
              max={today}
              onChange={(e) => setOccurredOn(e.target.value)}
              required
            />
          )}
        </Field>
        <Field id="baptism-count" label="How many">
          {(props) => (
            <Input
              {...props}
              type="number"
              inputMode="numeric"
              min={1}
              value={count}
              onChange={(e) => setCount(e.target.value)}
              required
            />
          )}
        </Field>
        <Button type="submit" variant="primary" disabled={busy}>
          {busy ? 'Saving…' : 'Add'}
        </Button>
        <div className="sm:col-span-4">
          <Field id="baptism-note" label="Note (optional)">
            {(props) => (
              <Input
                {...props}
                value={note}
                maxLength={500}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Anything worth remembering about that day"
              />
            )}
          </Field>
        </div>
      </form>

      <section aria-labelledby="entries-heading">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="entries-heading" className="text-lg font-semibold">
            Entries for {branchName(branches, branch)}
          </h2>
          <p className="text-sm text-muted">
            <span className="font-semibold tabular-nums">{total.toLocaleString('en-ZA')}</span>{' '}
            baptised in all
          </p>
        </div>

        {records.length === 0 ? (
          <EmptyState
            className="mt-4"
            icon={<Droplets aria-hidden="true" />}
            title="No entries yet"
            description="After a service, add the number of people who were baptised."
          />
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {records.map((record) => (
              <li
                key={record.id}
                className="flex items-center justify-between gap-4 rounded-lg border border-border bg-surface px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="font-medium">
                    <span className="tabular-nums">{record.count}</span> baptised
                    <span className="ms-2 text-sm font-normal text-muted">{record.occurredOn}</span>
                  </p>
                  {record.note ? (
                    <p className="mt-0.5 truncate text-sm text-muted">{record.note}</p>
                  ) : null}
                </div>
                <Button variant="ghost" size="sm" onClick={() => void remove(record)}>
                  <Trash2 aria-hidden="true" />
                  <span className="sr-only">
                    Remove the entry of {record.count} on {record.occurredOn}
                  </span>
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function branchName(branches: Pick<BranchSummary, 'slug' | 'name'>[], slug: string) {
  return branches.find((b) => b.slug === slug)?.name ?? slug;
}

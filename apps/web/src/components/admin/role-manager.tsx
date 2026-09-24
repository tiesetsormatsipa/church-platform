'use client';

import {
  type AdminUserDetail,
  branchTarget,
  canAssignRole,
  isPermission,
  ORGANIZATION_TARGET,
  type RoleDto,
} from '@church/shared';
import { Button } from '@church/ui/button';
import { Field } from '@church/ui/field';
import { NativeSelect } from '@church/ui/input';
import { toast } from '@church/ui/toast';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { api, ApiError, ensureOk } from '@/lib/api/client';
import { formatDate } from '@/lib/format';
import { grantsOf, useSession } from '@/lib/hooks/use-session';

/** Current roles with revoke buttons, and a form to give a new role (only what you may give). */
export function RoleManager({
  person,
  roles,
  branches,
}: {
  person: AdminUserDetail;
  roles: RoleDto[];
  branches: { id: string; slug: string; name: string }[];
}) {
  const router = useRouter();
  const { user } = useSession();
  const grants = grantsOf(user);
  const [roleKey, setRoleKey] = useState('');
  const [branchSlug, setBranchSlug] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  const permissionsOf = (role: RoleDto) => role.permissions.filter(isPermission);
  const assignable = roles.filter((role) =>
    role.scope === 'ORGANIZATION'
      ? canAssignRole(
          grants,
          { scope: role.scope, permissions: permissionsOf(role) },
          ORGANIZATION_TARGET,
        )
      : branches.some((b) =>
          canAssignRole(
            grants,
            { scope: role.scope, permissions: permissionsOf(role) },
            branchTarget(b.id),
          ),
        ),
  );
  const selected = roles.find((r) => r.key === roleKey);
  const branchOptions =
    selected?.scope === 'BRANCH'
      ? branches.filter((b) =>
          canAssignRole(
            grants,
            { scope: 'BRANCH', permissions: permissionsOf(selected) },
            branchTarget(b.id),
          ),
        )
      : [];

  async function call(key: string, fn: () => Promise<unknown>, success: string) {
    setBusy(key);
    try {
      await fn();
      toast({ title: success, tone: 'success' });
      router.refresh();
    } catch (error) {
      toast({
        title: 'That did not work',
        description: error instanceof ApiError ? error.message : undefined,
        tone: 'error',
      });
    } finally {
      setBusy(null);
    }
  }

  function assign(event: React.FormEvent) {
    event.preventDefault();
    if (!selected) return;
    void call(
      'assign',
      async () =>
        ensureOk(
          await api.POST('/api/v1/admin/users/{id}/roles', {
            params: { path: { id: person.id } },
            body: { role: selected.key, branch: selected.scope === 'BRANCH' ? branchSlug : null },
          }),
        ),
      `${selected.name} given to ${person.name}`,
    );
    setRoleKey('');
    setBranchSlug('');
  }

  return (
    <div className="flex flex-col gap-5">
      {person.assignments.length === 0 ? (
        <p className="text-sm text-muted">No roles: {person.name} is a regular member.</p>
      ) : (
        <ul className="flex flex-col divide-y divide-border">
          {person.assignments.map((a) => (
            <li key={a.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="flex flex-col">
                <span className="font-medium">
                  {a.role.name}
                  {a.branch ? (
                    <span className="text-muted"> · {a.branch.name}</span>
                  ) : (
                    <span className="text-muted"> · whole church</span>
                  )}
                </span>
                <span className="text-xs text-subtle">
                  Given {formatDate(a.grantedAt)}
                  {a.grantedBy ? ` by ${a.grantedBy}` : ''}
                </span>
              </div>
              {a.revocable ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-danger"
                  loading={busy === a.id}
                  onClick={() =>
                    call(
                      a.id,
                      async () =>
                        ensureOk(
                          await api.DELETE('/api/v1/admin/users/{id}/roles/{assignmentId}', {
                            params: { path: { id: person.id, assignmentId: a.id } },
                          }),
                        ),
                      'Role removed',
                    )
                  }
                >
                  Remove
                </Button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {assignable.length > 0 && person.status === 'ACTIVE' ? (
        <form
          onSubmit={assign}
          className="grid gap-3 border-t border-border pt-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end"
        >
          <Field id="assign-role" label="Give a role">
            {(props) => (
              <NativeSelect
                {...props}
                value={roleKey}
                onChange={(e) => {
                  setRoleKey(e.target.value);
                  setBranchSlug('');
                }}
              >
                <option value="" disabled>
                  Choose a role
                </option>
                {assignable.map((r) => (
                  <option key={r.key} value={r.key}>
                    {r.name}
                  </option>
                ))}
              </NativeSelect>
            )}
          </Field>
          {selected?.scope === 'BRANCH' ? (
            <Field id="assign-branch" label="For branch">
              {(props) => (
                <NativeSelect
                  {...props}
                  value={branchSlug}
                  onChange={(e) => setBranchSlug(e.target.value)}
                >
                  <option value="" disabled>
                    Choose a branch
                  </option>
                  {branchOptions.map((b) => (
                    <option key={b.slug} value={b.slug}>
                      {b.name}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          ) : (
            <p className="pb-2.5 text-sm text-muted">
              {selected ? 'Applies to the whole church.' : ''}
            </p>
          )}
          <Button
            type="submit"
            loading={busy === 'assign'}
            disabled={!selected || (selected.scope === 'BRANCH' && !branchSlug)}
          >
            Give role
          </Button>
          {selected?.description ? (
            <p className="text-xs text-muted sm:col-span-3">{selected.description}</p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

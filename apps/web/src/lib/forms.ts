'use client';

import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import { ApiError } from './api/client';

/**
 * Show API field errors next to their fields and return a message for the form-level alert.
 * `fields` lists the form's field names; errors for anything else go into the message.
 */
export function applyApiError<T extends FieldValues>(error: unknown, setError: UseFormSetError<T>, fields: readonly string[]): string {
  if (!(error instanceof ApiError)) return 'We could not reach the server. Check your connection and try again.';
  if (error.status === 429) return 'You have tried this too many times. Please wait a while and try again.';
  let matched = 0;
  for (const fieldError of error.fieldErrors) {
    const field = fieldError.path.split('.')[0] ?? '';
    if (fields.includes(field)) {
      setError(field as Path<T>, { type: 'server', message: fieldError.message });
      matched += 1;
    }
  }
  return matched > 0 && matched === error.fieldErrors.length ? 'Please check the highlighted fields.' : error.message;
}
